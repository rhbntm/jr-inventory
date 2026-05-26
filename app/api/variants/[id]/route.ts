import { NextRequest, NextResponse } from "next/server";
import { variantSchema } from "@/lib/schemas";
import { withErrorHandler, parseBody } from "@/lib/api-wrapper";
import { requireAuth } from "@/lib/auth";
import { VariantRepo } from "@/app/repositories/variantRepo";

type Params = Promise<{ id: string }>;

const updateSchema = variantSchema.partial();

export const PATCH = withErrorHandler(async (req: NextRequest, { params }: { params: Params }) => {
  await requireAuth();
  const { id } = await params;
  const data = await parseBody(req, updateSchema);

  const variant = await VariantRepo.updateVariant(id, data);

  return NextResponse.json(variant);
});

export const DELETE = withErrorHandler(async (_req: NextRequest, { params }: { params: Params }) => {
  await requireAuth();
  const { id } = await params;

  await VariantRepo.deleteVariant(id);

  return NextResponse.json({ success: true });
});
