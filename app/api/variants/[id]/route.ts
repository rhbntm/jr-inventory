import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

type Params = Promise<{ id: string }>;

export async function PATCH(req: NextRequest, { params }: { params: Params }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const variant = await db.productVariant.update({
      where: { id },
      data: {
        ...(body.sku !== undefined && { sku: body.sku?.trim() ?? null }),
        ...(body.size !== undefined && { size: body.size?.trim() ?? null }),
        ...(body.color !== undefined && { color: body.color?.trim() ?? null }),
        ...(body.fabric !== undefined && { fabric: body.fabric?.trim() ?? null }),
        ...(body.price !== undefined && { price: body.price }),
        ...(body.lowStockAt !== undefined && { lowStockAt: body.lowStockAt }),
      },
      include: { product: true },
    });
    return NextResponse.json(variant);
  } catch (err: any) {
    if (err?.code === "P2025") return NextResponse.json({ error: "Variant not found" }, { status: 404 });
    if (err?.code === "P2002") return NextResponse.json({ error: "SKU already exists" }, { status: 409 });
    console.error("[PATCH /api/variants/[id]]", err);
    return NextResponse.json({ error: "Failed to update variant" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Params }) {
  try {
    const { id } = await params;
    const movementCount = await db.stockMovement.count({ where: { variantId: id } });
    if (movementCount > 0) {
      return NextResponse.json(
        { error: "Cannot delete variant with stock history.", details: `${movementCount} movement(s) exist. Use ADJUSTMENT to zero out instead.` },
        { status: 409 }
      );
    }
    await db.productVariant.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    if (err?.code === "P2025") return NextResponse.json({ error: "Variant not found" }, { status: 404 });
    console.error("[DELETE /api/variants/[id]]", err);
    return NextResponse.json({ error: "Failed to delete variant" }, { status: 500 });
  }
}
