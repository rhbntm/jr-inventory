import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withErrorHandler, parseBody } from "@/lib/api-wrapper";
import { requireAuth } from "@/lib/auth";
import { CategoryRepo } from "@/app/repositories/categoryRepo";

const categorySchema = z.object({
  name: z.string().min(1, "Category name is required").transform(s => s.trim()),
});

// GET /api/categories — return all categories ordered by name
export const GET = withErrorHandler(async () => {
  await requireAuth();
  const categories = await CategoryRepo.getCategories();
  return NextResponse.json(categories);
});

// POST /api/categories — create category, validate unique name
export const POST = withErrorHandler(async (req: NextRequest) => {
  await requireAuth();
  const { name } = await parseBody(req, categorySchema);

  const category = await CategoryRepo.createCategory(name);

  return NextResponse.json(category, { status: 201 });
});
