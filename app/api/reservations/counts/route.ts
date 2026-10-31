import { NextResponse } from "next/server";
import { withErrorHandler } from "@/lib/api-wrapper";
import { requireAuth } from "@/lib/auth";
import { ReservationRepo } from "@/app/repositories/reservationRepo";

// GET /api/reservations/counts — reservations per state, for tabs and the Today page
export const GET = withErrorHandler(async () => {
  await requireAuth();
  return NextResponse.json(await ReservationRepo.getStateCounts());
});
