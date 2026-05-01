import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withErrorHandler } from "@/lib/api-wrapper";
import { ApiError } from "@/lib/errors";

type Params = Promise<{ id: string }>;

export const DELETE = withErrorHandler(async (_req: NextRequest, { params }: { params: Params }) => {
  const { id } = await params;

  // Check if category has products
  const productsCount = await db.product.count({ where: { categoryId: id } });

  if (productsCount > 0) {
    throw new ApiError(
      409,
      "Cannot delete category with existing products",
      { productsCount }
    );
  }

  await db.category.delete({ where: { id } });

  return NextResponse.json({ success: true });
});
