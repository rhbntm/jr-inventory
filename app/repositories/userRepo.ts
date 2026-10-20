import { hash } from "bcryptjs";
import { db } from "@/lib/db";
import { ApiError } from "@/lib/errors";
import type { InviteUserInput } from "@/lib/schemas";

// Never select the password hash into a response; only whether one exists.
const USER_FIELDS = {
  id: true,
  email: true,
  name: true,
  role: true,
  createdAt: true,
  password: true,
  accounts: { select: { provider: true } },
} as const;

type UserRow = {
  id: string;
  email: string;
  name: string;
  role: "OWNER" | "PARTNER";
  createdAt: Date;
  password: string | null;
  accounts: { provider: string }[];
};

function toPublicUser({ password, accounts, ...user }: UserRow) {
  return {
    ...user,
    hasPassword: password !== null,
    // e.g. ["google"] once they've signed in with Google at least once
    providers: accounts.map((a) => a.provider),
  };
}

export type PublicUser = ReturnType<typeof toPublicUser>;

/**
 * User management for owners. Callers must already have checked that the actor
 * is an OWNER (requireRole). Because of that, blocking self-demotion and
 * self-removal is enough to guarantee at least one OWNER always remains.
 */
export class UserRepo {
  static async listUsers(): Promise<PublicUser[]> {
    const users = await db.user.findMany({
      select: USER_FIELDS,
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    });
    return users.map(toPublicUser);
  }

  /** Creates a user. Without a password they can only sign in with Google. */
  static async inviteUser(data: InviteUserInput): Promise<PublicUser> {
    const existing = await db.user.findUnique({ where: { email: data.email } });
    if (existing) {
      throw new ApiError(409, `${data.email} already has access`);
    }

    const user = await db.user.create({
      data: {
        email: data.email,
        name: data.name,
        role: data.role,
        password: data.password ? await hash(data.password, 12) : null,
      },
      select: USER_FIELDS,
    });
    return toPublicUser(user);
  }

  static async updateRole(actorId: string, userId: string, role: "OWNER" | "PARTNER"): Promise<PublicUser> {
    if (actorId === userId) {
      throw new ApiError(400, "You can't change your own role");
    }

    const target = await db.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!target) throw new ApiError(404, "User not found");

    const user = await db.user.update({
      where: { id: userId },
      data: { role },
      select: USER_FIELDS,
    });
    return toPublicUser(user);
  }

  /**
   * Removes a user's access. Their past stock movements and reservation updates
   * stay in the history with no user attached (onDelete: SetNull); their Google
   * link and sessions are deleted with them (onDelete: Cascade).
   */
  static async removeUser(actorId: string, userId: string): Promise<void> {
    if (actorId === userId) {
      throw new ApiError(400, "You can't remove yourself");
    }

    const target = await db.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!target) throw new ApiError(404, "User not found");

    await db.user.delete({ where: { id: userId } });
  }
}
