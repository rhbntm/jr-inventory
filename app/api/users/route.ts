import { NextRequest, NextResponse } from "next/server";
import { inviteUserSchema } from "@/lib/schemas";
import { withErrorHandler, parseBody } from "@/lib/api-wrapper";
import { requireRole } from "@/lib/auth";
import { UserRepo } from "@/app/repositories/userRepo";

// GET /api/users — everyone with access (OWNER only)
export const GET = withErrorHandler(async () => {
  await requireRole("OWNER");
  const users = await UserRepo.listUsers();
  return NextResponse.json(users);
});

// POST /api/users — invite a user by email (OWNER only)
export const POST = withErrorHandler(async (req: NextRequest) => {
  await requireRole("OWNER");
  const data = await parseBody(req, inviteUserSchema);
  const user = await UserRepo.inviteUser(data);
  return NextResponse.json(user, { status: 201 });
});
