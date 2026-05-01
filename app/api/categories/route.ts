import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { withErrorHandler, parseBody } from "@/lib/api-wrapper";

const categorySchema = z.object({
  name: z.string().min(1, "Category name is required").transform(s => s.trim()),
});

// GET /api/categories — return all categories ordered by name
export const GET = withErrorHandler(async () => {
  const categories = await db.category.findMany({
    orderBy: { name: "asc" },
  });
  return NextResponse.json(categories);
});

// POST /api/categories — create category, validate unique name
export const POST = withErrorHandler(async (req: NextRequest) => {
  const { name } = await parseBody(req, categorySchema);

  const category = await db.category.create({
    data: { name },
  });

  return NextResponse.json(category, { status: 201 });
});
