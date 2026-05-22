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
}
