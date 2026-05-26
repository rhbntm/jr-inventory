import { NextRequest, NextResponse } from "next/server";
import { variantSchema } from "@/lib/schemas";
import { withErrorHandler, parseBody } from "@/lib/api-wrapper";
import { requireAuth } from "@/lib/auth";
import { VariantRepo } from "@/app/repositories/variantRepo";

export const POST = withErrorHandler(async (req: NextRequest) => {
  await requireAuth();
  const data = await parseBody(req, variantSchema);

  const variant = await VariantRepo.createVariant(data);

  return NextResponse.json(variant, { status: 201 });
});
