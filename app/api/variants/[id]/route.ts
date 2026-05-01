import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { variantSchema } from "@/lib/schemas";
import { withErrorHandler, parseBody } from "@/lib/api-wrapper";
import { ApiError } from "@/lib/errors";

type Params = Promise<{ id: string }>;

const updateSchema = variantSchema.partial();

export const PATCH = withErrorHandler(async (req: NextRequest, { params }: { params: Params }) => {
  const { id } = await params;
  const data = await parseBody(req, updateSchema);

  const variant = await db.productVariant.update({
    where: { id },
    data,
    include: { product: true },
  });

  return NextResponse.json(variant);
});

export const DELETE = withErrorHandler(async (_req: NextRequest, { params }: { params: Params }) => {
  const { id } = await params;

  const movementCount = await db.stockMovement.count({ where: { variantId: id } });

  if (movementCount > 0) {
    throw new ApiError(
      409,
      "Cannot delete variant with stock history",
      { movementCount, suggestion: "Use ADJUSTMENT to zero out instead" }
    );
  }

  await db.productVariant.delete({ where: { id } });

  return NextResponse.json({ success: true });
});
