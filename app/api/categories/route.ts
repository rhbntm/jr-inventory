import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/categories — return all categories ordered by name
export async function GET() {
  try {
    const categories = await db.category.findMany({
      orderBy: { name: "asc" },
    });
    return NextResponse.json(categories);
  } catch (err) {
    console.error("[GET /api/categories]", err);
    return NextResponse.json({ error: "Failed to fetch categories" }, { status: 500 });
  }
}

// POST /api/categories — create category, validate unique name
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.name?.trim()) {
      return NextResponse.json({ error: "Category name is required" }, { status: 400 });
    }

    const category = await db.category.create({
      data: { name: body.name.trim() },
    });
    return NextResponse.json(category, { status: 201 });
  } catch (err: any) {
    if (err?.code === "P2002") {
      return NextResponse.json({ error: "Category name already exists" }, { status: 409 });
    }
    console.error("[POST /api/categories]", err);
    return NextResponse.json({ error: "Failed to create category" }, { status: 500 });
  }
}
