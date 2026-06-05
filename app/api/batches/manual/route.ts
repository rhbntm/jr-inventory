import { NextRequest, NextResponse } from "next/server";
import { manualBatchSchema } from "@/lib/schemas";
import { withErrorHandler, parseBody } from "@/lib/api-wrapper";
import { requireAuth } from "@/lib/auth";
import { BatchRepo } from "@/app/repositories/batchRepo";

// POST /api/batches/manual
export const POST = withErrorHandler(async (req: NextRequest) => {
  const session = await requireAuth();
  const data = await parseBody(req, manualBatchSchema);

  const batch = await BatchRepo.createManualBatch(data, session.user.id);

  return NextResponse.json(batch, { status: 201 });
});
