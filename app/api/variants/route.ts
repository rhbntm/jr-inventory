import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { variantSchema } from "@/lib/schemas";

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const result = variantSchema.safeParse(json);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.format() },
        { status: 400 }
      );
    }

    const { productId, sku, size, color, fabric, costPrice, price, lowStockAt } = result.data;

    const variant = await db.productVariant.create({
      data: {
        productId,
        sku: sku || null,
        size: size || null,
        color: color || null,
        fabric: fabric || null,
        costPrice,
        price,
        lowStockAt,
        currentStock: 0,
      },
      include: { product: true },
    });

    return NextResponse.json(variant, { status: 201 });
  } catch (err: any) {
    if (err?.code === "P2002") {
      return NextResponse.json({ error: "SKU already exists" }, { status: 409 });
    }
    console.error("[POST /api/variants]", err);
    return NextResponse.json({ error: "Failed to create variant" }, { status: 500 });
  }
}
