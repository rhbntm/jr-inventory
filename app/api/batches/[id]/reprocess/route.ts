import { NextRequest, NextResponse } from "next/server";
import { batchProcessSchema } from "@/lib/schemas";
import { withErrorHandler, parseBody } from "@/lib/api-wrapper";
import { requireAuth } from "@/lib/auth";
import { BatchRepo } from "@/app/repositories/batchRepo";
import { ApiError } from "@/lib/errors";

type Params = Promise<{ id: string }>;

export const POST = withErrorHandler(async (req: NextRequest, { params }: { params: Params }) => {
  const session = await requireAuth();
  
  if (session.user.role !== "OWNER") {
    throw new ApiError(403, "Only owners can reprocess batches");
  }

  const { id } = await params;
  const data = await parseBody(req, batchProcessSchema);

  const batch = await BatchRepo.reprocessBatch(id, data, session.user.id);

  return NextResponse.json(batch);
});
