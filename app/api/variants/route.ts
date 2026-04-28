import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { CreateVariantInput } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const body: CreateVariantInput = await req.json();
    if (!body.productId) return NextResponse.json({ error: "productId is required" }, { status: 400 });
    if (body.price === undefined || body.price < 0) return NextResponse.json({ error: "price must be non-negative" }, { status: 400 });
    if (body.costPrice !== undefined && body.costPrice < 0) return NextResponse.json({ error: "costPrice must be non-negative" }, { status: 400 });

    const variant = await db.productVariant.create({
      data: {
        productId: body.productId,
        sku: body.sku?.trim() ?? null,
        size: body.size?.trim() ?? null,
        color: body.color?.trim() ?? null,
        fabric: body.fabric?.trim() ?? null,
        costPrice: body.costPrice ?? 0,
        price: body.price,
        lowStockAt: body.lowStockAt ?? 5,
        currentStock: 0,
      },
      include: { product: true },
    });
    return NextResponse.json(variant, { status: 201 });
  } catch (err: any) {
    if (err?.code === "P2002") return NextResponse.json({ error: "SKU already exists" }, { status: 409 });
    console.error("[POST /api/variants]", err);
    return NextResponse.json({ error: "Failed to create variant" }, { status: 500 });
  }
}
