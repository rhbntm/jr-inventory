import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { batchSchema } from "@/lib/schemas";
import { withErrorHandler, parseBody } from "@/lib/api-wrapper";
import { requireAuth } from "@/lib/auth";

// GET /api/batches — list all batches, newest first
export const GET = withErrorHandler(async (req: NextRequest) => {
  await requireAuth();
  const { searchParams } = req.nextUrl;
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize") ?? 20)));

  const [batches, total] = await db.$transaction([
    db.batch.findMany({
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        movements: {
          include: { variant: { include: { product: true } } },
        },
      },
    }),
    db.batch.count(),
  ]);

  return NextResponse.json({ data: batches, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
});

// POST /api/batches — create a new batch (header info only; process separately)
export const POST = withErrorHandler(async (req: NextRequest) => {
  await requireAuth();
  const data = await parseBody(req, batchSchema);

  const batch = await db.batch.create({
    data: {
      supplierName: data.supplierName ?? null,
      purchaseDate: data.purchaseDate ?? null,
      totalCost: data.totalCost ?? null,
      estimatedQty: data.estimatedQty ?? null,
      category: data.category ?? null,
      notes: data.notes ?? null,
    },
  });

  return NextResponse.json(batch, { status: 201 });
});
