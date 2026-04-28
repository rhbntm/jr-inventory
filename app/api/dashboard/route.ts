import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // Use raw SQL for low stock query (column-to-column comparison)
    const lowStockVariants = await db.$queryRaw<
      Array<{
        id: string;
        sku: string | null;
        size: string | null;
        color: string | null;
        fabric: string | null;
        currentStock: number;
        lowStockAt: number;
        price: number;
        productId: string;
        product_name: string;
      }>
    >`
      SELECT
        v.id, v.sku, v.size, v.color, v.fabric,
        v."currentStock", v."lowStockAt", v.price, v."productId",
        p.name as product_name
      FROM "product_variants" v
      JOIN "products" p ON v."productId" = p.id
      WHERE v."currentStock" <= v."lowStockAt"
      ORDER BY v."currentStock" ASC
      LIMIT 20
    `;

    const [totalProducts, totalVariants, todayIn, todayOut, recentMovements] =
      await db.$transaction([
        db.product.count(),
        db.productVariant.count(),
        db.stockMovement.aggregate({
          where: { type: "IN", createdAt: { gte: todayStart } },
          _sum: { quantity: true },
        }),
        db.stockMovement.aggregate({
          where: { type: "OUT", createdAt: { gte: todayStart } },
          _sum: { quantity: true },
        }),
        db.stockMovement.findMany({
          include: { variant: { include: { product: true } }, user: true },
          orderBy: { createdAt: "desc" },
          take: 10,
        }),
      ]);

    return NextResponse.json({
      stats: {
        totalProducts,
        totalVariants,
        lowStockCount: lowStockVariants.length,
        todayMovementsIn: todayIn._sum.quantity ?? 0,
        todayMovementsOut: todayOut._sum.quantity ?? 0,
        recentMovements,
      },
      lowStockItems: lowStockVariants.map((v) => ({
        variantId: v.id,
        sku: v.sku,
        productName: v.product_name,
        size: v.size,
        color: v.color,
        fabric: v.fabric,
        currentStock: v.currentStock,
        lowStockAt: v.lowStockAt,
      })),
    });
  } catch (err) {
    console.error("[GET /api/dashboard]", err);
    return NextResponse.json({ error: "Failed to load dashboard" }, { status: 500 });
  }
}
