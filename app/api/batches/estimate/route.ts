import { NextRequest, NextResponse } from "next/server";
import { estimateSchema } from "@/lib/schemas";
import { withErrorHandler, parseBody } from "@/lib/api-wrapper";
import { requireAuth } from "@/lib/auth";
import { estimateBatchQuantity } from "@/app/repositories/batchRepo";

// POST /api/batches/estimate
// Body: { sampleWeight, sampleQty, totalWeight }
// Returns: { estimatedTotalQty, weightPerUnit }
export const POST = withErrorHandler(async (req: NextRequest) => {
  await requireAuth();
  const { sampleWeight, sampleQty, totalWeight } = await parseBody(req, estimateSchema);

  const { estimatedTotalQty, weightPerUnit } = estimateBatchQuantity({
    sampleWeight,
    sampleQty,
    totalWeight,
  });

  return NextResponse.json({ estimatedTotalQty, weightPerUnit: Number(weightPerUnit.toFixed(4)) });
});
