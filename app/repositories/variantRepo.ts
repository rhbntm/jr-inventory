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
   * Corrects good stock on hand and/or moves good units to the stained or damaged buckets.
   * Stock in/out would count as receiving or selling, so a correction is an ADJUSTMENT,
   * which sales totals ignore. Each kind of change gets its own audit entry.
   *
   * The change is applied to whatever the stock is now, in one statement, so a sale made
   * while someone is counting isn't overwritten. Units held for reservations are off limits.
   */
  static async adjustConditionStock(
    id: string,
    {
      stockChange = 0,
      toStained,
      toDamaged,
      note,
    }: { stockChange?: number; toStained: number; toDamaged: number; note?: string | null },
    userId: string,
  ) {
    const moved = toStained + toDamaged;
    if (stockChange === 0 && moved <= 0) throw new ApiError(400, "Nothing to change");

    return db.$transaction(async (tx) => {
      const updated = await tx.$queryRaw<
        Array<{ currentStock: number; price: unknown; costPrice: unknown }>
      >`
        UPDATE product_variants
        SET "currentStock" = "currentStock" + ${stockChange} - ${moved},
            "stainedStock" = "stainedStock" + ${toStained},
            "damagedStock" = "damagedStock" + ${toDamaged},
            "updatedAt" = NOW() AT TIME ZONE 'UTC'
        WHERE id = ${id} AND "currentStock" + ${stockChange} - "reservedStock" >= ${moved}
        RETURNING "currentStock", price, "costPrice"
      `;

      if (updated.length === 0) {
        const variant = await tx.productVariant.findUnique({ where: { id } });
        if (!variant) throw new ApiError(404, "Variant not found");
        const available = variant.currentStock - variant.reservedStock;
        throw new ApiError(
          409,
          `Not enough available stock. Available: ${available}, Reserved: ${variant.reservedStock}`,
        );
      }

      const { currentStock, price, costPrice } = updated[0];
      const suffix = note ? ` — ${note}` : "";
      const audit = { variantId: id, type: "ADJUSTMENT" as const, priceAtMovement: Number(price), costPriceAtMovement: Number(costPrice), userId };

      if (stockChange !== 0) {
        const signed = stockChange > 0 ? `+${stockChange}` : `${stockChange}`;
        const onHand = currentStock + moved;
        await tx.stockMovement.create({
          data: {
            ...audit,
            // For an adjustment the quantity is the new stock level.
            quantity: onHand,
            note: `Stock adjustment: ${signed}, now ${onHand}${suffix}`,
          },
        });
      }

      if (moved > 0) {
        const parts: string[] = [];
        if (toStained > 0) parts.push(`${toStained} → Stained`);
        if (toDamaged > 0) parts.push(`${toDamaged} → Damaged`);
        await tx.stockMovement.create({
          data: {
            ...audit,
            quantity: moved,
            note: `Condition adjustment: ${parts.join(", ")}${suffix}`,
          },
        });
      }

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
