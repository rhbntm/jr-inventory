import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler } from "@/lib/api-wrapper";
import { requireAuth } from "@/lib/auth";
import { MovementRepo } from "@/app/repositories/movementRepo";

// POST /api/movements/:id/undo — reverses a plain stock in/out recorded by this user
export const POST = withErrorHandler(async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const session = await requireAuth();
  const { id } = await params;

  const reversal = await MovementRepo.undoMovement(id, session.user.id);

  return NextResponse.json(reversal, { status: 201 });
});
