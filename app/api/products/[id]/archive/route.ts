import { NextRequest, NextResponse } from "next/server";
import { productArchiveSchema } from "@/lib/schemas";
import { withErrorHandler, parseBody } from "@/lib/api-wrapper";
import { requireAuth } from "@/lib/auth";
import { ProductRepo } from "@/app/repositories/productRepo";

type Params = Promise<{ id: string }>;

// PATCH /api/products/[id]/archive — separate from the normal edit route so nothing can
// archive a product without going through the reservation check.
export const PATCH = withErrorHandler(async (req: NextRequest, { params }: { params: Params }) => {
  await requireAuth();
  const { id } = await params;
  const { archived } = await parseBody(req, productArchiveSchema);

  const product = await ProductRepo.setArchived(id, archived);

  return NextResponse.json(product);
});
