import { db } from "@/lib/db";
import { ApiError } from "@/lib/errors";

export class CategoryRepo {
  static async getCategories() {
    return db.category.findMany({
      orderBy: { name: "asc" },
    });
  }

  static async createCategory(name: string) {
    return db.category.create({
      data: { name },
    });
  }

  static async deleteCategory(id: string) {
    const productsCount = await db.product.count({ where: { categoryId: id } });

    if (productsCount > 0) {
      throw new ApiError(
        409,
        "Cannot delete category with existing products",
        { productsCount }
      );
    }

    await db.category.delete({ where: { id } });
  }
}
