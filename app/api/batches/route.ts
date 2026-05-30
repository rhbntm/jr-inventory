import { NextRequest, NextResponse } from "next/server";
import { batchSchema } from "@/lib/schemas";
import { withErrorHandler, parseBody } from "@/lib/api-wrapper";
import { requireAuth } from "@/lib/auth";
import { BatchRepo } from "@/app/repositories/batchRepo";

// GET /api/batches — list all batches, newest first
export const GET = withErrorHandler(async (req: NextRequest) => {
  await requireAuth();
  const { searchParams } = req.nextUrl;
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize") ?? 20)));

  const result = await BatchRepo.getBatches(page, pageSize);

  return NextResponse.json(result);
});

// POST /api/batches — create a new batch (header info only; process separately)
export const POST = withErrorHandler(async (req: NextRequest) => {
  await requireAuth();
  const data = await parseBody(req, batchSchema);

  const batch = await BatchRepo.createBatch(data);

  return NextResponse.json(batch, { status: 201 });
});
