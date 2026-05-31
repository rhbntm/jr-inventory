import { NextRequest, NextResponse } from "next/server";
import { productSchema } from "@/lib/schemas";
import { withErrorHandler, parseBody } from "@/lib/api-wrapper";
import { ApiError } from "@/lib/errors";
import { requireAuth } from "@/lib/auth";
import { ProductRepo } from "@/app/repositories/productRepo";

type Params = Promise<{ id: string }>;

const updateSchema = productSchema.partial();

export const GET = withErrorHandler(async (req: NextRequest, { params }: { params: Params }) => {
  await requireAuth();
  const { id } = await params;
  const showArchived = req.nextUrl.searchParams.get("showArchived") === "true";
  const product = await ProductRepo.getProductWithVariants(id, showArchived);

  if (!product) {
    throw new ApiError(404, "Product not found");
  }

  return NextResponse.json(product);
});

export const PATCH = withErrorHandler(async (req: NextRequest, { params }: { params: Params }) => {
  await requireAuth();
  const { id } = await params;
  const data = await parseBody(req, updateSchema);

  const product = await ProductRepo.updateProduct(id, data);

  return NextResponse.json(product);
});

export const DELETE = withErrorHandler(async (_req: NextRequest, { params }: { params: Params }) => {
  await requireAuth();
  const { id } = await params;

  await ProductRepo.deleteProduct(id);

  return NextResponse.json({ success: true });
});
