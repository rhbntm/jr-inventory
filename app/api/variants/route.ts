import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { variantSchema } from "@/lib/schemas";
import { withErrorHandler, parseBody } from "@/lib/api-wrapper";
import { requireAuth } from "@/lib/auth";

export const POST = withErrorHandler(async (req: NextRequest) => {
  await requireAuth();
  const data = await parseBody(req, variantSchema);

  const variant = await db.productVariant.create({
    data: {
      productId: data.productId,
      sku: data.sku ?? null,
      size: data.size ?? null,
      color: data.color ?? null,
      fabric: data.fabric ?? null,
      costPrice: data.costPrice,
      price: data.price,
      lowStockAt: data.lowStockAt,
      currentStock: 0,
    },
    include: { product: true },
  });

  return NextResponse.json(variant, { status: 201 });
});
