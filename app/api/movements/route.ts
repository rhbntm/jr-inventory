import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { CreateMovementInput } from "@/lib/types";

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
    const body: CreateMovementInput = await req.json();

    if (!body.variantId) return NextResponse.json({ error: "variantId is required" }, { status: 400 });
    if (!["IN", "OUT", "ADJUSTMENT"].includes(body.type)) return NextResponse.json({ error: "type must be IN, OUT, or ADJUSTMENT" }, { status: 400 });
    if (!body.quantity || body.quantity < 1) return NextResponse.json({ error: "quantity must be a positive integer" }, { status: 400 });

    const variant = await db.productVariant.findUnique({ where: { id: body.variantId } });
    if (!variant) return NextResponse.json({ error: "Variant not found" }, { status: 404 });

    // Prevent negative stock on OUT
    if (body.type === "OUT" && variant.currentStock < body.quantity) {
      return NextResponse.json(
        { error: "Insufficient stock", details: `Current stock is ${variant.currentStock}, cannot remove ${body.quantity}.` },
        { status: 422 }
      );
    }

    const delta = body.type === "IN" ? body.quantity : body.type === "OUT" ? -body.quantity : 0;

    const [movement] = await db.$transaction([
      db.stockMovement.create({
        data: {
          variantId: body.variantId,
          type: body.type,
          quantity: body.quantity,
          note: body.note?.trim() ?? null,
          // userId: wire up from NextAuth session
        },
        include: { variant: { include: { product: true } }, user: true },
      }),
      db.productVariant.update({
        where: { id: body.variantId },
        data: {
          currentStock: body.type === "ADJUSTMENT"
            ? body.quantity
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
