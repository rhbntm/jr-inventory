import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { variantSchema } from "@/lib/schemas";

type Params = Promise<{ id: string }>;

const updateSchema = variantSchema.partial();

export async function PATCH(req: NextRequest, { params }: { params: Params }) {
  try {
    const { id } = await params;
    const json = await req.json();
    const result = updateSchema.safeParse(json);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.format() },
        { status: 400 }
      );
    }

    const variant = await db.productVariant.update({
      where: { id },
      data: result.data,
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
