import "dotenv/config";
import { db } from "./lib/db";
import bcrypt from "bcryptjs";

async function main() {
  const email = "admin@example.com";
  const password = "password123";

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await db.user.upsert({
    where: { email },
    update: {
      password: hashedPassword,
      role: "OWNER",
    },
    create: {
      email,
      name: "Admin User",
      password: hashedPassword,
      role: "OWNER",
    },
  });

  console.log("User created successfully:");
  console.log("Email:", user.email);
  console.log("Password:", password);
  console.log("Role:", user.role);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
