import { db } from "@/lib/db";
import { ApiError } from "@/lib/errors";
import type { VariantInput } from "@/lib/schemas";

export class VariantRepo {
  static async createVariant(data: VariantInput) {
    return db.productVariant.create({
      data: {
        productId: data.productId,
        sku: data.sku ?? null,
        size: data.size ?? null,
        color: data.color ?? null,
        fabric: data.fabric ?? null,
        costPrice: data.costPrice,
        price: data.price,
        salePrice: data.salePrice ?? null,
        lowStockAt: data.lowStockAt,
        currentStock: 0,
      },
      include: { product: true },
    });
  }

  static async updateVariant(id: string, data: Partial<VariantInput>) {
    return db.productVariant.update({
      where: { id },
      data,
      include: { product: true },
    });
  }

  /**
   * Transfer good-condition units to stained or damaged buckets.
   * Creates an ADJUSTMENT StockMovement for the audit trail.
   * The total of (toStained + toDamaged) must not exceed available currentStock.
   */
  static async adjustConditionStock(
    id: string,
    { toStained, toDamaged, note }: { toStained: number; toDamaged: number; note?: string | null },
    userId: string,
  ) {
    const total = toStained + toDamaged;
    if (total <= 0) throw new ApiError(400, "Nothing to transfer");

    const variant = await db.productVariant.findUnique({ where: { id } });
    if (!variant) throw new ApiError(404, "Variant not found");

    const available = variant.currentStock - variant.reservedStock;
    if (available < total) {
      throw new ApiError(
        409,
        `Not enough available stock. Available: ${available}, Requested: ${total}`,
      );
    }

    return db.$transaction(async (tx) => {
      // Decrement good stock and increment condition buckets
      await tx.productVariant.update({
        where: { id },
        data: {
          currentStock: { decrement: total },
          stainedStock: { increment: toStained },
          damagedStock: { increment: toDamaged },
        },
      });

      // Write a single ADJUSTMENT movement to record the transfer
      const parts: string[] = [];
      if (toStained > 0) parts.push(`${toStained} → Stained`);
      if (toDamaged > 0) parts.push(`${toDamaged} → Damaged`);
      const autoNote = `Condition adjustment: ${parts.join(", ")}${note ? ` — ${note}` : ""}`;

      await tx.stockMovement.create({
        data: {
          variantId: id,
          type: "ADJUSTMENT",
          quantity: total,
          priceAtMovement: Number(variant.price),
          costPriceAtMovement: Number(variant.costPrice),
          note: autoNote,
          userId,
        },
      });

      return tx.productVariant.findUnique({
        where: { id },
        include: { product: true },
      });
    });
  }

  static async deleteVariant(id: string) {
    const movementCount = await db.stockMovement.count({ where: { variantId: id } });

    if (movementCount > 0) {
      throw new ApiError(
        409,
        "Cannot delete variant with stock history",
        { movementCount, suggestion: "Use ADJUSTMENT to zero out instead" }
      );
    }

    const reservationCount = await db.reservation.count({ where: { variantId: id } });

    if (reservationCount > 0) {
      throw new ApiError(
        409,
        "Cannot delete variant with reservation history",
        { reservationCount, suggestion: "Archive the variant instead, or delete reservations manually if allowed." }
      );
    }

    await db.productVariant.delete({ where: { id } });
  }
}
