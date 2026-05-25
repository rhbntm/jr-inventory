import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withErrorHandler } from "@/lib/api-wrapper";
import { requireAuth } from "@/lib/auth";

// GET /api/batches/analytics — top 5 by profit + highest damage %
export const GET = withErrorHandler(async (_req: NextRequest) => {
  await requireAuth();

  const batches = await db.batch.findMany({
    where: { actualQty: { not: null } },
    include: {
      movements: {
        include: {
          variant: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  type BatchRow = typeof batches[number];

  const withProfit = batches.map((b: BatchRow) => {
    const revenue = b.movements.reduce(
      (sum, m) => sum + m.quantity * Number(m.variant.price),
      0
    );
    const cost = Number(b.totalCost ?? 0);
    const estimatedProfit = revenue - cost;
    const damagedQty = b.damagedQty ?? 0;
    const actualQty = b.actualQty ?? 0;
    const damagePercent = actualQty > 0 ? Math.round((damagedQty / actualQty) * 100) : 0;
    return { ...b, estimatedProfit, damagePercent };
  });

  const topBatchesByProfit = [...withProfit]
    .sort((a, b) => b.estimatedProfit - a.estimatedProfit)
    .slice(0, 5)
    .map(({ id, supplierName, purchaseDate, totalCost, estimatedProfit, damagedQty, damagePercent }) => ({
      id,
      supplierName,
      purchaseDate,
      totalCost: totalCost ? Number(totalCost) : null,
      estimatedProfit,
      damagedQty,
      damagePercent,
    }));

  const highestDamageBatches = [...withProfit]
    .sort((a, b) => b.damagePercent - a.damagePercent)
    .slice(0, 5)
    .map(({ id, supplierName, purchaseDate, damagedQty, actualQty, damagePercent }) => ({
      id,
      supplierName,
      purchaseDate,
      damagedQty,
      actualQty,
      damagePercent,
    }));

  return NextResponse.json({ topBatchesByProfit, highestDamageBatches });
});
