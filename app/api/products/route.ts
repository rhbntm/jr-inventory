import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { CreateProductInput } from "@/lib/types";

// GET /api/products — query: search, categoryId, page, pageSize
export async function GET(req: NextRequest) {
  try {
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
  } catch (err) {
    console.error("[GET /api/products]", err);
    return NextResponse.json({ error: "Failed to fetch products" }, { status: 500 });
  }
}

// POST /api/products
export async function POST(req: NextRequest) {
  try {
    const body: CreateProductInput = await req.json();
    if (!body.name?.trim()) {
      return NextResponse.json({ error: "Product name is required" }, { status: 400 });
    }
    const product = await db.product.create({
      data: {
        name: body.name.trim(),
        description: body.description?.trim() ?? null,
        categoryId: body.categoryId ?? null,
      },
      include: { category: true, variants: true },
    });
    return NextResponse.json(product, { status: 201 });
  } catch (err) {
    console.error("[POST /api/products]", err);
    return NextResponse.json({ error: "Failed to create product" }, { status: 500 });
  }
}
