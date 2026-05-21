import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { movementSchema } from "@/lib/schemas";
import { withErrorHandler, parseBody } from "@/lib/api-wrapper";
import { ApiError } from "@/lib/errors";
import { requireAuth } from "@/lib/auth";

// GET /api/movements — query: variantId, productId, type, startDate, endDate, page, pageSize
export const GET = withErrorHandler(async (req: NextRequest) => {
  await requireAuth();
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
});

// POST /api/movements — atomically creates movement + updates currentStock
export const POST = withErrorHandler(async (req: NextRequest) => {
  const session = await requireAuth();
  const { variantId, type, quantity, note, priceAtMovement } = await parseBody(req, movementSchema);

  const variant = await db.productVariant.findUnique({ where: { id: variantId } });
  if (!variant) {
    throw new ApiError(404, "Variant not found");
  }

  // Fallback price logic if priceAtMovement isn't explicitly provided
  let finalPrice: number | null | undefined = priceAtMovement;
  if (finalPrice === undefined || finalPrice === null) {
    if (type === "OUT") {
      // Use salePrice if active, otherwise normal price
      finalPrice = variant.salePrice ? Number(variant.salePrice) : Number(variant.price);
    } else {
      finalPrice = Number(variant.price);
    }
  }

  // Perform transaction with atomic safety
  const movement = await db.$transaction(async (tx) => {
    if (type === "OUT") {
      const updated = await tx.productVariant.updateMany({
        where: { id: variantId, currentStock: { gte: quantity } },
        data: { currentStock: { decrement: quantity } }
      });
      if (updated.count === 0) {
        // Fetch fresh variant inside transaction to report actual stock
        const freshVariant = await tx.productVariant.findUnique({ where: { id: variantId } });
        throw new ApiError(
          422,
          "Insufficient stock",
          { currentStock: freshVariant?.currentStock ?? 0, requestedQuantity: quantity }
        );
      }
    } else {
      await tx.productVariant.update({
        where: { id: variantId },
        data: {
          currentStock: type === "ADJUSTMENT"
            ? quantity
            : { increment: quantity },
        },
      });
    }

    return await tx.stockMovement.create({
      data: {
        variantId,
        type,
        quantity,
        priceAtMovement: finalPrice,
        costPriceAtMovement: Number(variant.costPrice),
        note: note ?? null,
        userId: session.user.id,
      },
      include: { variant: { include: { product: true } }, user: true },
    });
  });

  return NextResponse.json(movement, { status: 201 });
});
