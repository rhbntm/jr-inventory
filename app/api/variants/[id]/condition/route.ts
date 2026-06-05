import { NextRequest, NextResponse } from "next/server";
import { conditionAdjustSchema } from "@/lib/schemas";
import { withErrorHandler, parseBody } from "@/lib/api-wrapper";
import { requireAuth } from "@/lib/auth";
import { VariantRepo } from "@/app/repositories/variantRepo";

type Params = Promise<{ id: string }>;

// PATCH /api/variants/[id]/condition
// Transfers good-condition units into the stained or damaged buckets.
export const PATCH = withErrorHandler(async (req: NextRequest, { params }: { params: Params }) => {
  const session = await requireAuth();
  const { id } = await params;
  const data = await parseBody(req, conditionAdjustSchema);

  const variant = await VariantRepo.adjustConditionStock(
    id,
    { toStained: data.toStained, toDamaged: data.toDamaged, note: data.note },
    session.user.id,
  );

  return NextResponse.json(variant);
});
