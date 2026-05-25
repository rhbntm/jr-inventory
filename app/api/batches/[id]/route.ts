import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withErrorHandler } from "@/lib/api-wrapper";
import { requireAuth } from "@/lib/auth";
import { ApiError } from "@/lib/errors";

// GET /api/batches/[id]
export const GET = withErrorHandler(async (req: NextRequest, context: { params: Promise<{ id: string }> }) => {
  await requireAuth();
  const { id } = await context.params;

  const batch = await db.batch.findUnique({
    where: { id },
    include: {
      movements: {
        include: { variant: { include: { product: true } } },
        orderBy: { id: "asc" },
      },
    },
  });

  if (!batch) throw new ApiError(404, "Batch not found");

  return NextResponse.json(batch);
});
