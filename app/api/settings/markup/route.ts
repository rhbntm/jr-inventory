import { NextRequest, NextResponse } from "next/server";
import { settingsMarkupSchema } from "@/lib/schemas";
import { withErrorHandler, parseBody } from "@/lib/api-wrapper";
import { requireAuth, requireRole } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/settings/markup
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const GET = withErrorHandler(async (_req: NextRequest) => {
  await requireAuth();

  const settings = await db.settings.findMany({
    where: { key: { in: ["markupPercent", "fixedMarkup"] } },
  });

  const settingsMap = new Map(settings.map(s => [s.key, s.value]));

  const markupPercent = Number(settingsMap.get("markupPercent")) || 25.0;
  const fixedMarkup = Number(settingsMap.get("fixedMarkup")) || 5.0;

  return NextResponse.json({ markupPercent, fixedMarkup });
});

// POST /api/settings/markup
export const POST = withErrorHandler(async (req: NextRequest) => {
  await requireRole("OWNER");
  const data = await parseBody(req, settingsMarkupSchema);

  await db.$transaction([
    db.settings.upsert({
      where: { key: "markupPercent" },
      update: { value: data.markupPercent.toString() },
      create: { key: "markupPercent", value: data.markupPercent.toString() },
    }),
    db.settings.upsert({
      where: { key: "fixedMarkup" },
      update: { value: data.fixedMarkup.toString() },
      create: { key: "fixedMarkup", value: data.fixedMarkup.toString() },
    })
  ]);

  return NextResponse.json({ success: true });
});
