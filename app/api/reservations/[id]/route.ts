import { NextRequest, NextResponse } from "next/server";
import { updateReservationSchema } from "@/lib/schemas";
import { withErrorHandler, parseBody } from "@/lib/api-wrapper";
import { requireAuth } from "@/lib/auth";
import { ReservationRepo } from "@/app/repositories/reservationRepo";

export const PATCH = withErrorHandler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const session = await requireAuth();
  const resolvedParams = await params;
  const id = resolvedParams.id;
  const data = await parseBody(req, updateReservationSchema);

  const reservation = await ReservationRepo.transitionState(id, data.action, session.user.id, { restock: data.restock });

  return NextResponse.json(reservation);
});
