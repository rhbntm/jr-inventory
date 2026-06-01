import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { withErrorHandler, parseBody } from "@/lib/api-wrapper";
import { db as prisma } from "@/lib/db";
import { z } from "zod";

const resetSchema = z.object({
  scope: z.enum(["STOCK", "FULL"]),
});

export const POST = withErrorHandler(async (req: NextRequest) => {
  await requireRole("OWNER");
  
  const { scope } = await parseBody(req, resetSchema);

  await prisma.$transaction(async (tx) => {
    // Both scopes delete transactions
    await tx.batchMovement.deleteMany({});
    await tx.batch.deleteMany({});
    await tx.reservation.deleteMany({});
    await tx.stockMovement.deleteMany({});

    if (scope === "FULL") {
      await tx.productVariant.deleteMany({});
      await tx.product.deleteMany({});
      await tx.category.deleteMany({});
    } else {
      // STOCK only: reset counts
      await tx.productVariant.updateMany({
        data: {
          currentStock: 0,
          reservedStock: 0,
        },
      });
    }
  });

  return NextResponse.json({ success: true, message: `Inventory reset completed with scope: ${scope}` });
});
