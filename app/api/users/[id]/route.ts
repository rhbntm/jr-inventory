import { NextRequest, NextResponse } from "next/server";
import { updateUserSchema } from "@/lib/schemas";
import { withErrorHandler, parseBody } from "@/lib/api-wrapper";
import { requireRole } from "@/lib/auth";
import { UserRepo } from "@/app/repositories/userRepo";

type Params = Promise<{ id: string }>;

// PATCH /api/users/[id] — change a user's role (OWNER only)
export const PATCH = withErrorHandler(async (req: NextRequest, { params }: { params: Params }) => {
  const session = await requireRole("OWNER");
  const { id } = await params;
  const { role } = await parseBody(req, updateUserSchema);

  const user = await UserRepo.updateRole(session.user.id, id, role);
  return NextResponse.json(user);
});

// DELETE /api/users/[id] — remove a user's access (OWNER only)
export const DELETE = withErrorHandler(async (_req: NextRequest, { params }: { params: Params }) => {
  const session = await requireRole("OWNER");
  const { id } = await params;

  await UserRepo.removeUser(session.user.id, id);
  return NextResponse.json({ success: true });
});
