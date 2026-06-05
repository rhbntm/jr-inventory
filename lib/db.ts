import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;

// Seed default settings on startup
(async () => {
  try {
    const defaultSettings = [
      { key: "markupPercent", value: "25" },
      { key: "fixedMarkup", value: "5" },
    ];
    for (const setting of defaultSettings) {
      await db.settings.upsert({
        where: { key: setting.key },
        update: {},
        create: setting,
      });
    }
  } catch (error) {
    console.error("Failed to seed default settings:", error);
  }
})();
