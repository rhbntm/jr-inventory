import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { db as prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    // Check if any users exist
    const userCount = await prisma.user.count();
    
    if (userCount > 0) {
      return NextResponse.json(
        { error: "Setup already completed. Users already exist." },
        { status: 400 }
      );
    }

    const { email, password, name } = await req.json();

    if (!email || !password || !name) {
      return NextResponse.json(
        { error: "Email, password, and name are required" },
        { status: 400 }
      );
    }

    const hashedPassword = await hash(password, 12);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role: "OWNER",
      },
    });

    return NextResponse.json({
      message: "Initial user created successfully",
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });
  } catch (error) {
    console.error("Setup error:", error);
    return NextResponse.json(
      { error: "Failed to create user" },
      { status: 500 }
    );
  }
}

export async function GET() {
  const userCount = await prisma.user.count();
  return NextResponse.json({ setupComplete: userCount > 0 });
}
