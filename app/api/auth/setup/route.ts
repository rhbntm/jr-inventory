import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { z } from "zod";
import { db as prisma } from "@/lib/db";
import { withErrorHandler, parseBody } from "@/lib/api-wrapper";
import { ApiError } from "@/lib/errors";

const setupSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().min(1, "Name is required"),
});

export const POST = withErrorHandler(async (req: NextRequest) => {
  // Check if any users exist
  const userCount = await prisma.user.count();

  if (userCount > 0) {
    throw new ApiError(400, "Setup already completed. Users already exist.");
  }

  const { email, password, name } = await parseBody(req, setupSchema);

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
});

export const GET = withErrorHandler(async () => {
  const userCount = await prisma.user.count();
  return NextResponse.json({ setupComplete: userCount > 0 });
});
