import { NextRequest, NextResponse } from "next/server";
import { createReservationSchema } from "@/lib/schemas";
import { withErrorHandler, parseBody } from "@/lib/api-wrapper";
import { requireAuth } from "@/lib/auth";
import { ReservationRepo } from "@/app/repositories/reservationRepo";
import { ReservationState } from "@prisma/client";
import { ApiError } from "@/lib/errors";

export const GET = withErrorHandler(async (req: NextRequest) => {
  await requireAuth();
  const { searchParams } = req.nextUrl;
  
  // One state, or several separated by commas.
  const stateNames = (searchParams.get("state") ?? "").split(",").filter(Boolean);
  for (const name of stateNames) {
    if (!(Object.values(ReservationState) as string[]).includes(name)) {
      throw new ApiError(400, `Invalid reservation state: ${name}`);
    }
  }
  const states = stateNames as ReservationState[];

  const search = searchParams.get("search") ?? undefined;
  const oldestFirst = searchParams.get("sort") === "oldest";

  const variantId = searchParams.get("variantId") ?? undefined;
  const startDate = searchParams.get("startDate") ?? undefined;
  const endDate = searchParams.get("endDate") ?? undefined;
  const customerName = searchParams.get("customerName") ?? undefined;
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize") ?? 30)));

  const result = await ReservationRepo.getReservations({
    states,
    variantId,
    startDate,
    endDate,
    customerName,
    search,
    oldestFirst,
    page,
    pageSize,
  });

  return NextResponse.json(result);
});

export const POST = withErrorHandler(async (req: NextRequest) => {
  const session = await requireAuth();
  const data = await parseBody(req, createReservationSchema);

  const reservation = await ReservationRepo.createReservation(data, session.user.id);

  return NextResponse.json(reservation, { status: 201 });
});
