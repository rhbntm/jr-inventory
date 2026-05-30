import { NextResponse } from "next/server";
import { withErrorHandler } from "@/lib/api-wrapper";
import { requireAuth } from "@/lib/auth";
import { BatchRepo } from "@/app/repositories/batchRepo";

// GET /api/batches/analytics — top 5 by profit + highest damage %
export const GET = withErrorHandler(async () => {
  await requireAuth();

  const analytics = await BatchRepo.getBatchAnalytics();

  return NextResponse.json(analytics);
});
