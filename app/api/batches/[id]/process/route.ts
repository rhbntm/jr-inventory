import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { batchProcessSchema } from "@/lib/schemas";
import { withErrorHandler, parseBody } from "@/lib/api-wrapper";
import { requireAuth } from "@/lib/auth";
import { ApiError } from "@/lib/errors";

// POST /api/batches/[id]/process
// Finalises the batch: records BatchMovements, creates IN StockMovements, updates stock.
export const POST = withErrorHandler(async (req: NextRequest, context: { params: Promise<{ id: string }> }) => {
  const session = await requireAuth();
  const { id } = await context.params;
  const { assignments, damagedQty, actualQty } = await parseBody(req, batchProcessSchema);

  const batch = await db.batch.findUnique({ where: { id } });
  if (!batch) throw new ApiError(404, "Batch not found");

  // Validate all variant IDs exist
  const variantIds = assignments.map((a) => a.variantId);
  const variants = await db.productVariant.findMany({ where: { id: { in: variantIds } } });
  if (variants.length !== variantIds.length) throw new ApiError(422, "One or more variant IDs are invalid");

  const variantMap = new Map(variants.map((v) => [v.id, v]));
  const computedActualQty = actualQty ?? assignments.reduce((sum, a) => sum + a.quantity, 0);

  await db.$transaction(async (tx) => {
    // Update batch with final quantities
    await tx.batch.update({
      where: { id },
      data: { actualQty: computedActualQty, damagedQty },
    });

    for (const { variantId, quantity, costPerUnit } of assignments) {
      if (quantity <= 0) continue;

      const variant = variantMap.get(variantId)!;
      const resolvedCostPerUnit =
        costPerUnit != null ? costPerUnit
        : batch.totalCost && computedActualQty > 0
          ? Number(batch.totalCost) / computedActualQty
          : Number(variant.costPrice);

      // Upsert BatchMovement
      await tx.batchMovement.create({
        data: {
          batchId: id,
          variantId,
          quantity,
          costPerUnit: resolvedCostPerUnit,
        },
      });

      // Increment stock
      await tx.productVariant.update({
        where: { id: variantId },
        data: { currentStock: { increment: quantity } },
      });

      // Create a StockMovement record (IN)
      await tx.stockMovement.create({
        data: {
          variantId,
          type: "IN",
          quantity,
          priceAtMovement: Number(variant.price),
          costPriceAtMovement: resolvedCostPerUnit,
          note: `Batch #${id.slice(-6)} – ${batch.supplierName ?? "supplier"}`,
          userId: session.user.id,
        },
      });
    }
  });

  const updated = await db.batch.findUnique({
    where: { id },
    include: {
      movements: { include: { variant: { include: { product: true } } } },
    },
  });

  return NextResponse.json(updated);
});
