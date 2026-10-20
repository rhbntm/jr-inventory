import "dotenv/config";
import { parseArgs } from "node:util";
import { db } from "./lib/db";
import bcrypt from "bcryptjs";

const USAGE = `Usage:
  npm run create-user -- --email <email> --name <name> [--role OWNER|PARTNER] [--password <password>] [--update]

  Without --password the user can only sign in with Google (an invite).
  --update changes the role/name/password of an existing user instead of failing.`;

async function main() {
  const { values } = parseArgs({
    options: {
      email: { type: "string" },
      name: { type: "string" },
      role: { type: "string", default: "PARTNER" },
      password: { type: "string" },
      update: { type: "boolean", default: false },
    },
  });

  const email = values.email?.trim().toLowerCase();
  const name = values.name?.trim();
  const role = values.role?.toUpperCase();

  if (!email || !name) throw new Error(`--email and --name are required.\n\n${USAGE}`);
  if (role !== "OWNER" && role !== "PARTNER") throw new Error(`--role must be OWNER or PARTNER.\n\n${USAGE}`);
  if (values.password !== undefined && values.password.length < 8) {
    throw new Error("Password must be at least 8 characters.");
  }

  const password = values.password ? await bcrypt.hash(values.password, 12) : undefined;

  const existing = await db.user.findUnique({ where: { email } });
  if (existing && !values.update) {
    throw new Error(`A user with email ${email} already exists. Pass --update to change it.`);
  }

  const user = existing
    ? await db.user.update({
        where: { email },
        data: { name, role, ...(password && { password }) },
      })
    : await db.user.create({
        data: { email, name, role, password: password ?? null },
      });

  console.log(`${existing ? "Updated" : "Created"} user ${user.email} (${user.role}).`);
  console.log(user.password ? "Can sign in with email/password." : "Google sign-in only (invite).");
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
