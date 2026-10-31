import { db } from '@/lib/db';
import { ApiError } from '@/lib/errors';
import type { MovementInput } from '@/lib/schemas';

/** How long after recording a movement its author can still undo it. */
export const UNDO_WINDOW_MS = 12 * 60 * 60 * 1000;

export class MovementRepo {
  /**
   * Reverses a stock movement recorded by mistake. The original row stays in the audit
   * trail, a reversing row is added, and both are marked voided so totals skip them.
   * Only plain stock in/out can be undone: batch and reservation movements are owned by
   * those flows, and reversing them here would leave those records wrong.
   */
  static async undoMovement(id: string, userId: string) {
    return await db.$transaction(async (tx) => {
      const original = await tx.stockMovement.findUnique({ where: { id } });
      if (!original) {
        throw new ApiError(404, 'Movement not found');
      }
      if (original.userId !== userId) {
        throw new ApiError(403, 'You can only undo movements you recorded');
      }
      const note = original.note ?? '';
      const ownedByAnotherFlow =
        original.batchId !== null ||
        note.startsWith('Reservation #') ||
        note.startsWith('Return from Reservation #');
      if (original.type === 'ADJUSTMENT' || ownedByAnotherFlow) {
        throw new ApiError(422, 'This movement cannot be undone');
      }
      if (Date.now() - original.createdAt.getTime() > UNDO_WINDOW_MS) {
        throw new ApiError(422, 'This movement is too old to undo. Record an adjustment instead.');
      }

      // Claiming the row first means two undo requests can't both reverse it.
      const now = new Date();
      const claimed = await tx.stockMovement.updateMany({
        where: { id, voidedAt: null },
        data: { voidedAt: now },
      });
      if (claimed.count === 0) {
        throw new ApiError(409, 'This movement was already undone');
      }

      const { variantId, quantity } = original;
      if (original.type === 'OUT') {
        await tx.productVariant.update({
          where: { id: variantId },
          data: { currentStock: { increment: quantity } },
        });
      } else {
        // Removing received stock must not eat into units sold or held since then.
        const updated = await tx.$executeRaw`
          UPDATE product_variants
          SET "currentStock" = "currentStock" - ${quantity}, "updatedAt" = NOW() AT TIME ZONE 'UTC'
          WHERE id = ${variantId} AND "currentStock" - "reservedStock" >= ${quantity}
        `;
        if (updated === 0) {
          throw new ApiError(422, 'Cannot undo: some of this stock has already been sold or reserved');
        }
      }

      return await tx.stockMovement.create({
        data: {
          variantId,
          type: original.type === 'OUT' ? 'IN' : 'OUT',
          quantity,
          priceAtMovement: original.priceAtMovement,
          costPriceAtMovement: original.costPriceAtMovement,
          note: `Undo of movement ${id}`,
          userId,
          voidedAt: now,
        },
        include: { variant: { include: { product: true } }, user: true },
      });
    });
  }

  /**
   * Creates a stock movement and updates the variant's current stock atomically.
   * Mirrors the logic that currently lives in `app/api/movements/route.ts`.
   */
  static async createMovement(data: MovementInput, userId: string) {
    const { variantId, type, quantity, priceAtMovement, note } = data;

    const variant = await db.productVariant.findUnique({ where: { id: variantId } });
    if (!variant) {
      throw new ApiError(404, 'Variant not found');
    }

    // Resolve final price if not supplied – same fallback logic as before
    let finalPrice: number | null | undefined = priceAtMovement;
    if (finalPrice === undefined || finalPrice === null) {
      if (type === 'OUT') {
        finalPrice = variant.salePrice ? Number(variant.salePrice) : Number(variant.price);
      } else {
        finalPrice = Number(variant.price);
      }
    }

    // Perform the whole operation in a transaction for atomicity
    const movement = await db.$transaction(async (tx) => {
      if (type === 'OUT') {
        // Only Available Stock (currentStock − reservedStock) can be sold; units held
        // for reservations are off limits. The check and decrement are one statement
        // so concurrent sales can't oversell.
        const updated = await tx.$executeRaw`
          UPDATE product_variants
          SET "currentStock" = "currentStock" - ${quantity}, "updatedAt" = NOW() AT TIME ZONE 'UTC'
          WHERE id = ${variantId} AND "currentStock" - "reservedStock" >= ${quantity}
        `;
        if (updated === 0) {
          const fresh = await tx.productVariant.findUnique({ where: { id: variantId } });
          const availableStock = fresh ? fresh.currentStock - fresh.reservedStock : 0;
          throw new ApiError(
            422,
            `Insufficient available stock. Available: ${availableStock}, Requested: ${quantity}`,
            {
              currentStock: fresh?.currentStock ?? 0,
              reservedStock: fresh?.reservedStock ?? 0,
              availableStock,
              requestedQuantity: quantity,
            }
          );
        }
      } else if (type === 'ADJUSTMENT') {
        // Stock can't be set below what is already promised to reservations.
        const updated = await tx.productVariant.updateMany({
          where: { id: variantId, reservedStock: { lte: quantity } },
          data: { currentStock: quantity },
        });
        if (updated.count === 0) {
          const fresh = await tx.productVariant.findUnique({ where: { id: variantId } });
          throw new ApiError(
            422,
            `Cannot set stock below reserved quantity (${fresh?.reservedStock ?? 0}). Release or cancel reservations first.`,
            { reservedStock: fresh?.reservedStock ?? 0, requestedQuantity: quantity }
          );
        }
      } else {
        await tx.productVariant.update({
          where: { id: variantId },
          data: { currentStock: { increment: quantity } },
        });
      }

      return await tx.stockMovement.create({
        data: {
          variantId,
          type,
          quantity,
          priceAtMovement: finalPrice,
          costPriceAtMovement: Number(variant.costPrice),
          note: note ?? null,
          userId,
        },
        include: { variant: { include: { product: true } }, user: true },
      });
    });

    return movement;
  }

  /**
   * Get filtered, paginated stock movements.
   */
  static async getMovements(filters: {
    variantId?: string;
    productId?: string;
    type?: "IN" | "OUT" | "ADJUSTMENT" | null;
    startDate?: string | null;
    endDate?: string | null;
    page?: number;
    pageSize?: number;
  }) {
    const page = Math.max(1, filters.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 30));

    const where = {
      ...(filters.variantId && { variantId: filters.variantId }),
      ...(filters.productId && { variant: { productId: filters.productId } }),
      ...(filters.type && { type: filters.type }),
      ...((filters.startDate || filters.endDate) && {
        createdAt: {
          ...(filters.startDate && { gte: new Date(filters.startDate) }),
          ...(filters.endDate && { lte: new Date(filters.endDate) }),
        },
      }),
    };

    const [movements, total] = await db.$transaction([
      db.stockMovement.findMany({
        where,
        include: { variant: { include: { product: true } }, user: true },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.stockMovement.count({ where }),
    ]);

    return {
      data: movements,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }
}
