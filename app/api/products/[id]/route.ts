import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { productSchema } from "@/lib/schemas";

type Params = Promise<{ id: string }>;

const updateSchema = productSchema.partial();

export async function GET(_req: NextRequest, { params }: { params: Params }) {
  try {
    const { id } = await params;
    const product = await db.product.findUnique({
      where: { id },
      include: { category: true, variants: { orderBy: { createdAt: "asc" } } },
    });
    if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });
    return NextResponse.json(product);
  } catch (err) {
    console.error("[GET /api/products/[id]]", err);
    return NextResponse.json({ error: "Failed to fetch product" }, { status: 500 });
  }
}

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

    const product = await db.product.update({
      where: { id },
      data: result.data,
      include: { category: true, variants: true },
    });
    return NextResponse.json(product);
  } catch (err: any) {
    if (err?.code === "P2025") return NextResponse.json({ error: "Product not found" }, { status: 404 });
    console.error("[PATCH /api/products/[id]]", err);
    return NextResponse.json({ error: "Failed to update product" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Params }) {
  try {
    const { id } = await params;
    const movementCount = await db.stockMovement.count({
      where: { variant: { productId: id } },
    });
    if (movementCount > 0) {
      return NextResponse.json(
        { error: "Cannot delete product with stock history. Archive it instead.", details: `${movementCount} movement(s) exist.` },
        { status: 409 }
      );
    }
    await db.product.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    if (err?.code === "P2025") return NextResponse.json({ error: "Product not found" }, { status: 404 });
    console.error("[DELETE /api/products/[id]]", err);
    return NextResponse.json({ error: "Failed to delete product" }, { status: 500 });
  }
}
