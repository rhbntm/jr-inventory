import { db } from '@/lib/db';
import type { ProductWithVariants, VariantWithProduct } from '@/lib/types';
import type { ProductInput } from '@/lib/schemas';
import { ApiError } from '@/lib/errors';

export class ProductRepo {
  static async getProducts(search: string = "", categoryId?: string, showArchived: boolean = false, page: number = 1, pageSize: number = 20) {
    const where = {
      ...(search && { name: { contains: search, mode: "insensitive" as const } }),
      ...(categoryId && { categoryId }),
    };

    const [products, total] = await db.$transaction([
      db.product.findMany({
        where,
        include: { 
          category: true, 
          variants: { 
            where: showArchived ? undefined : { isArchived: false },
            orderBy: { createdAt: "asc" } 
          } 
        },
        orderBy: { updatedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.product.count({ where }),
    ]);

    return { data: products, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  static async createProduct(data: ProductInput) {
    return db.product.create({
      data: {
        name: data.name,
        description: data.description ?? null,
        categoryId: data.categoryId ?? null,
      },
      include: { category: true, variants: true },
    });
  }

  static async updateProduct(id: string, data: Partial<ProductInput>) {
    return db.product.update({
      where: { id },
      data,
      include: { category: true, variants: true },
    });
  }

  static async deleteProduct(id: string) {
    const movementCount = await db.stockMovement.count({
      where: { variant: { productId: id } },
    });

    if (movementCount > 0) {
      throw new ApiError(
        409,
        "Cannot delete product with stock history. Archive it instead.",
        { movementCount }
      );
    }

    await db.product.delete({ where: { id } });
  }

  /**
   * Retrieves a product together with its variants.
   */
  static async getProductWithVariants(productId: string, showArchived: boolean = false): Promise<ProductWithVariants | null> {
    return db.product.findUnique({
      where: { id: productId },
      include: { 
        category: true, 
        variants: { 
          where: showArchived ? undefined : { isArchived: false },
          orderBy: { createdAt: "asc" } 
        } 
      },
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
