import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { movementSchema } from "@/lib/schemas";

// GET /api/movements — query: variantId, productId, type, startDate, endDate, page, pageSize
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const variantId = searchParams.get("variantId") ?? undefined;
    const productId = searchParams.get("productId") ?? undefined;
    const type = searchParams.get("type") as "IN" | "OUT" | "ADJUSTMENT" | null;
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const page = Math.max(1, Number(searchParams.get("page") ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize") ?? 30)));

    const where = {
      ...(variantId && { variantId }),
      ...(productId && { variant: { productId } }),
      ...(type && { type }),
      ...((startDate || endDate) && {
        createdAt: {
          ...(startDate && { gte: new Date(startDate) }),
          ...(endDate && { lte: new Date(endDate) }),
        },
      }),
    };

    const [movements, total] = await db.$transaction([
      db.stockMovement.findMany({
        where,
        include: { variant: { include: { product: true } }, user: true },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.stockMovement.count({ where }),
    ]);

    return NextResponse.json({ data: movements, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
  } catch (err) {
    console.error("[GET /api/movements]", err);
    return NextResponse.json({ error: "Failed to fetch movements" }, { status: 500 });
  }
}

// POST /api/movements — atomically creates movement + updates currentStock
export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const result = movementSchema.safeParse(json);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.format() },
        { status: 400 }
      );
    }

    const { variantId, type, quantity, note } = result.data;

    const variant = await db.productVariant.findUnique({ where: { id: variantId } });
    if (!variant) return NextResponse.json({ error: "Variant not found" }, { status: 404 });

    // Prevent negative stock on OUT
    if (type === "OUT" && variant.currentStock < quantity) {
      return NextResponse.json(
        { error: "Insufficient stock", details: `Current stock is ${variant.currentStock}, cannot remove ${quantity}.` },
        { status: 422 }
      );
    }

    const delta = type === "IN" ? quantity : type === "OUT" ? -quantity : 0;

    const [movement] = await db.$transaction([
      db.stockMovement.create({
        data: {
          variantId,
          type,
          quantity,
          note: note || null,
          // userId: wire up from NextAuth session
        },
        include: { variant: { include: { product: true } }, user: true },
      }),
      db.productVariant.update({
        where: { id: variantId },
        data: {
          currentStock: type === "ADJUSTMENT"
            ? quantity
            : { increment: delta },
        },
      }),
    ]);

    return NextResponse.json(movement, { status: 201 });
  } catch (err) {
    console.error("[POST /api/movements]", err);
    return NextResponse.json({ error: "Failed to record movement" }, { status: 500 });
  }
}
