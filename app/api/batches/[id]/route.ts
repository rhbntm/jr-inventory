import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler } from "@/lib/api-wrapper";
import { requireAuth } from "@/lib/auth";
import { BatchRepo } from "@/app/repositories/batchRepo";

// GET /api/batches/[id]
export const GET = withErrorHandler(async (_req: NextRequest, context: { params: Promise<{ id: string }> }) => {
  await requireAuth();
  const { id } = await context.params;

  const batch = await BatchRepo.getBatch(id);

  return NextResponse.json(batch);
});
