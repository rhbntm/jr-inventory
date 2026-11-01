import { db } from '@/lib/db';
import type { ProductWithVariants, VariantWithProduct } from '@/lib/types';
import type { ProductInput } from '@/lib/schemas';
import { ApiError } from '@/lib/errors';
import { reservedBlockMessage } from '@/lib/archive';

export class ProductRepo {
  /**
   * `archived` picks which products are listed; `showArchived` picks whether each one's
   * archived variants come along.
   */
  static async getProducts(search: string = "", categoryId?: string, showArchived: boolean = false, page: number = 1, pageSize: number = 20, archived: boolean = false) {
    const where = {
      isArchived: archived,
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
    // Each of these blocks the delete at the database level, so check them all up front.
    const productVariants = { variant: { productId: id } };
    const [movementCount, reservationCount, batchMovementCount] = await Promise.all([
      db.stockMovement.count({ where: productVariants }),
      db.reservation.count({ where: productVariants }),
      db.batchMovement.count({ where: productVariants }),
    ]);

    if (movementCount > 0 || reservationCount > 0 || batchMovementCount > 0) {
      throw new ApiError(
        409,
        "Cannot delete product with stock history. Archive it instead.",
        { movementCount, reservationCount, batchMovementCount }
      );
    }

    await db.product.delete({ where: { id } });
  }

  /**
   * Archives or restores a product, leaving each variant's own flag alone so variants
   * retired one by one stay retired after a restore.
   *
   * Archiving locks the variants, and creating a reservation locks its variant before
   * checking the product, so the two can't slip past each other. reservedStock covers
   * both Reserved and Shipping reservations.
   */
  static async setArchived(id: string, archived: boolean) {
    return db.$transaction(async (tx) => {
      const product = await tx.product.findUnique({ where: { id }, select: { id: true } });
      if (!product) {
        throw new ApiError(404, "Product not found");
      }

      if (archived) {
        const variants = await tx.$queryRaw<Array<{ reservedStock: number }>>`
          SELECT "reservedStock" FROM product_variants WHERE "productId" = ${id} FOR UPDATE
        `;
        const reserved = variants.reduce((sum, variant) => sum + variant.reservedStock, 0);
        if (reserved > 0) {
          throw new ApiError(409, reservedBlockMessage(reserved), { reserved });
        }
      }

      return tx.product.update({
        where: { id },
        data: { isArchived: archived },
        include: { category: true, variants: true },
      });
    });
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
