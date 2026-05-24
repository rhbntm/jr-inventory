import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { movementSchema } from "@/lib/schemas";
import { withErrorHandler, parseBody } from "@/lib/api-wrapper";
import { ApiError } from "@/lib/errors";
import { requireAuth } from "@/lib/auth";
import { MovementRepo } from "@/app/repositories/movementRepo";

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
  const data = await parseBody(req, movementSchema);

  const movement = await MovementRepo.createMovement(data, session.user.id);

  return NextResponse.json(movement, { status: 201 });
});
