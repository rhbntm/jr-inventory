import { db } from '@/lib/db';
import type { ProductWithVariants, VariantWithProduct } from '@/lib/types';

export class ProductRepo {
  /**
   * Retrieves a product together with its variants.
   */
  static async getProductWithVariants(productId: string): Promise<ProductWithVariants | null> {
    return db.product.findUnique({
      where: { id: productId },
      include: { category: true, variants: true },
    }) as Promise<ProductWithVariants | null>;
  }

  /**
   * Retrieves a variant together with its parent product.
   */
  static async getVariantWithProduct(variantId: string): Promise<VariantWithProduct | null> {
    return db.productVariant.findUnique({
      where: { id: variantId },
      include: { product: { include: { category: true } } },
    }) as Promise<VariantWithProduct | null>;
  }
}
