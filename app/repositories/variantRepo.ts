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

  static async deleteVariant(id: string) {
    const movementCount = await db.stockMovement.count({ where: { variantId: id } });

    if (movementCount > 0) {
      throw new ApiError(
        409,
        "Cannot delete variant with stock history",
        { movementCount, suggestion: "Use ADJUSTMENT to zero out instead" }
      );
    }

    await db.productVariant.delete({ where: { id } });
  }
}
