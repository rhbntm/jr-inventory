import { db } from '@/lib/db';
import { ApiError } from '@/lib/errors';
import type { CreateMovementInput } from '@/lib/types';

export class MovementRepo {
  /**
   * Creates a stock movement and updates the variant's current stock atomically.
   * Mirrors the logic that currently lives in `app/api/movements/route.ts`.
   */
  static async createMovement(data: CreateMovementInput, userId: string) {
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
        const updated = await tx.productVariant.updateMany({
          where: { id: variantId, currentStock: { gte: quantity } },
          data: { currentStock: { decrement: quantity } },
        });
        if (updated.count === 0) {
          const fresh = await tx.productVariant.findUnique({ where: { id: variantId } });
          throw new ApiError(
            422,
            'Insufficient stock',
            { currentStock: fresh?.currentStock ?? 0, requestedQuantity: quantity }
          );
        }
      } else {
        await tx.productVariant.update({
          where: { id: variantId },
          data: {
            currentStock: type === 'ADJUSTMENT' ? quantity : { increment: quantity },
          },
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
