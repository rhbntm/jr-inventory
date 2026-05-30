import { NextRequest, NextResponse } from "next/server";
import { batchProcessSchema } from "@/lib/schemas";
import { withErrorHandler, parseBody } from "@/lib/api-wrapper";
import { requireAuth } from "@/lib/auth";
import { BatchRepo } from "@/app/repositories/batchRepo";

// POST /api/batches/[id]/process
// Finalises the batch: records BatchMovements, creates IN StockMovements, updates stock.
export const POST = withErrorHandler(async (req: NextRequest, context: { params: Promise<{ id: string }> }) => {
  const session = await requireAuth();
  const { id } = await context.params;
  const data = await parseBody(req, batchProcessSchema);

  const updated = await BatchRepo.processBatch(id, data, session.user.id);

  return NextResponse.json(updated);
});
