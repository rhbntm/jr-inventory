import { NextRequest, NextResponse } from "next/server";
import { productSchema } from "@/lib/schemas";
import { withErrorHandler, parseBody } from "@/lib/api-wrapper";
import { requireAuth } from "@/lib/auth";
import { ProductRepo } from "@/app/repositories/productRepo";

// GET /api/products — query: search, categoryId, page, pageSize
export const GET = withErrorHandler(async (req: NextRequest) => {
  await requireAuth();
  const { searchParams } = req.nextUrl;
  const search = searchParams.get("search") ?? "";
  const categoryId = searchParams.get("categoryId") ?? undefined;
  const showArchived = searchParams.get("showArchived") === "true";
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize") ?? 20)));

  const result = await ProductRepo.getProducts(search, categoryId, showArchived, page, pageSize);

  return NextResponse.json(result);
});

// POST /api/products
export const POST = withErrorHandler(async (req: NextRequest) => {
  await requireAuth();
  const data = await parseBody(req, productSchema);

  const product = await ProductRepo.createProduct(data);

  return NextResponse.json(product, { status: 201 });
});
