import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { productSchema } from "@/lib/schemas";
import { withErrorHandler, parseBody } from "@/lib/api-wrapper";
import { requireAuth } from "@/lib/auth";

// GET /api/products — query: search, categoryId, page, pageSize
export const GET = withErrorHandler(async (req: NextRequest) => {
  await requireAuth();
  const { searchParams } = req.nextUrl;
  const search = searchParams.get("search") ?? "";
  const categoryId = searchParams.get("categoryId") ?? undefined;
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize") ?? 20)));

  const where = {
    ...(search && { name: { contains: search, mode: "insensitive" as const } }),
    ...(categoryId && { categoryId }),
  };

  const [products, total] = await db.$transaction([
    db.product.findMany({
      where,
      include: { category: true, variants: { orderBy: { createdAt: "asc" } } },
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.product.count({ where }),
  ]);

  return NextResponse.json({ data: products, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
});

// POST /api/products
export const POST = withErrorHandler(async (req: NextRequest) => {
  await requireAuth();
  const { name, description, categoryId } = await parseBody(req, productSchema);

  const product = await db.product.create({
    data: {
      name,
      description: description ?? null,
      categoryId: categoryId ?? null,
    },
    include: { category: true, variants: true },
  });

  return NextResponse.json(product, { status: 201 });
});
