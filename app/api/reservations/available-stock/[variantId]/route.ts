import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler } from "@/lib/api-wrapper";
import { requireAuth } from "@/lib/auth";
import { ReservationRepo } from "@/app/repositories/reservationRepo";

export const GET = withErrorHandler(async (req: NextRequest, { params }: { params: Promise<{ variantId: string }> }) => {
  await requireAuth();
  const resolvedParams = await params;
  const variantId = resolvedParams.variantId;

  const stock = await ReservationRepo.getAvailableStock(variantId);

  return NextResponse.json(stock);
});
