import { NextRequest, NextResponse } from "next/server";
import { settingsMarkupSchema } from "@/lib/schemas";
import { withErrorHandler, parseBody } from "@/lib/api-wrapper";
import { requireAuth, requireRole } from "@/lib/auth";
import { db } from "@/lib/db";

const DEFAULT_MARKUP_PERCENT = 25;
const DEFAULT_FIXED_MARKUP = 5;

function parseSetting(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return value !== undefined && value !== "" && Number.isFinite(n) ? n : fallback;
}

// GET /api/settings/markup
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const GET = withErrorHandler(async (_req: NextRequest) => {
  await requireAuth();

  const settings = await db.settings.findMany({
    where: { key: { in: ["markupPercent", "fixedMarkup"] } },
  });

  const settingsMap = new Map(settings.map(s => [s.key, s.value]));

  // Defaults apply until the owner saves their own values (a saved 0 is kept).
  const markupPercent = parseSetting(settingsMap.get("markupPercent"), DEFAULT_MARKUP_PERCENT);
  const fixedMarkup = parseSetting(settingsMap.get("fixedMarkup"), DEFAULT_FIXED_MARKUP);

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
