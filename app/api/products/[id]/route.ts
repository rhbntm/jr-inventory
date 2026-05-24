import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { productSchema } from "@/lib/schemas";
import { withErrorHandler, parseBody } from "@/lib/api-wrapper";
import { ApiError } from "@/lib/errors";
import { requireAuth } from "@/lib/auth";
import { ProductRepo } from "@/app/repositories/productRepo";

type Params = Promise<{ id: string }>;

const updateSchema = productSchema.partial();

export const GET = withErrorHandler(async (_req: NextRequest, { params }: { params: Params }) => {
  await requireAuth();
  const { id } = await params;
  const product = await ProductRepo.getProductWithVariants(id);

  if (!product) {
    throw new ApiError(404, "Product not found");
  }

  return NextResponse.json(product);
});

export const PATCH = withErrorHandler(async (req: NextRequest, { params }: { params: Params }) => {
  await requireAuth();
  const { id } = await params;
  const data = await parseBody(req, updateSchema);

  const product = await db.product.update({
    where: { id },
    data,
    include: { category: true, variants: true },
  });

  return NextResponse.json(product);
});

export const DELETE = withErrorHandler(async (_req: NextRequest, { params }: { params: Params }) => {
  await requireAuth();
  const { id } = await params;

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

  return NextResponse.json({ success: true });
});
