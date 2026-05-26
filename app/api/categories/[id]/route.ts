import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler } from "@/lib/api-wrapper";
import { requireAuth } from "@/lib/auth";
import { CategoryRepo } from "@/app/repositories/categoryRepo";

type Params = Promise<{ id: string }>;

export const DELETE = withErrorHandler(async (_req: NextRequest, { params }: { params: Params }) => {
  await requireAuth();
  const { id } = await params;

  await CategoryRepo.deleteCategory(id);

  return NextResponse.json({ success: true });
});
