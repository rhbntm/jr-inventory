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
      // Archived products hide from the list, so say they're part of why it's locked.
      // Deleting anyway would bring them back with no category when restored.
      const archivedCount = await db.product.count({ where: { categoryId: id, isArchived: true } });
      const usedBy = `${productsCount} product${productsCount === 1 ? "" : "s"}`;
      throw new ApiError(
        409,
        archivedCount > 0
          ? `Cannot delete category: used by ${usedBy}, including ${archivedCount} archived`
          : "Cannot delete category with existing products",
        { productsCount, archivedCount }
      );
    }

    await db.category.delete({ where: { id } });
  }
}
