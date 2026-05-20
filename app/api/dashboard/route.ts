import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withErrorHandler } from "@/lib/api-wrapper";
import { requireAuth } from "@/lib/auth";

export const GET = withErrorHandler(async () => {
    await requireAuth();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Run all queries in parallel using Promise.all()
    const [
      lowStockVariants,
      inventoryValuation,
      trends,
      margins,
      topPerformers,
      slowMovingItemsData,
      todaySales,
      [totalProducts, totalVariants, todayIn, todayOut, recentMovements]
    ] = await Promise.all([
      // Low stock variants
      db.$queryRaw<
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
      `,
      // Inventory valuation
      db.$queryRaw<
        Array<{
          totalCost: number;
          totalRevenue: number;
          totalProfit: number;
          weightedMarginSum: number;
          totalStockForMargin: number;
        }>
      >`
        SELECT
          COALESCE(SUM(v."currentStock" * v."costPrice"), 0) as "totalCost",
          COALESCE(SUM(v."currentStock" * v.price), 0) as "totalRevenue",
          COALESCE(SUM(v."currentStock" * (v.price - v."costPrice")), 0) as "totalProfit",
          COALESCE(SUM(
            CASE
              WHEN v.price > 0 AND v."currentStock" > 0
              THEN v."currentStock" * ((v.price - v."costPrice") / v.price)
              ELSE 0
            END
          ), 0) as "weightedMarginSum",
          COALESCE(SUM(
            CASE
              WHEN v.price > 0 AND v."currentStock" > 0
              THEN v."currentStock"
              ELSE 0
            END
          ), 0) as "totalStockForMargin"
        FROM "product_variants" v
      `,
      // Movement trends
      db.$queryRaw<
        Array<{
          date: string;
          type: string;
          total: number;
        }>
      >`
        SELECT
          TO_CHAR("createdAt", 'YYYY-MM-DD') as "date",
          "type",
          SUM("quantity") as "total"
        FROM "stock_movements"
        WHERE "createdAt" >= ${sevenDaysAgo}
        GROUP BY "date", "type"
        ORDER BY "date" ASC
      `,
      // Margins
      db.$queryRaw<
        Array<{
          margin_percent: number;
        }>
      >`
        SELECT
          CASE
            WHEN price > 0 THEN ((price - "costPrice") / price) * 100
            ELSE 0
          END as "margin_percent"
        FROM "product_variants"
        WHERE "currentStock" > 0
      `,
      // Top performers
      db.$queryRaw<
        Array<{
          id: string;
          name: string;
          sku: string | null;
          profit: number;
          currentStock: number;
        }>
      >`
        SELECT
          v.id,
          p.name,
          v.sku,
          (v."currentStock" * (v.price - v."costPrice")) as "profit",
          v."currentStock"
        FROM "product_variants" v
        JOIN "products" p ON v."productId" = p.id
        WHERE v."currentStock" > 0
        ORDER BY "profit" DESC
        LIMIT 5
      `,
      // Slow moving items
      db.$queryRaw<
        Array<{
          id: string;
          name: string;
          sku: string | null;
          currentStock: number;
          last_out: string | null;
        }>
      >`
        SELECT
          v.id,
          p.name,
          v.sku,
          v."currentStock",
          (SELECT TO_CHAR(MAX("createdAt"), 'YYYY-MM-DD') FROM "stock_movements" WHERE "variantId" = v.id AND "type" = 'OUT') as "last_out"
        FROM "product_variants" v
        JOIN "products" p ON v."productId" = p.id
        WHERE v."currentStock" > 0
        AND NOT EXISTS (
          SELECT 1 FROM "stock_movements" m
          WHERE m."variantId" = v.id
          AND m."type" = 'OUT'
          AND m."createdAt" >= ${thirtyDaysAgo}
        )
        ORDER BY v."currentStock" DESC
        LIMIT 5
      `,
      // Today's sales
      db.$queryRaw<
        Array<{
          revenue: number;
          profit: number;
        }>
      >`
        SELECT
          COALESCE(SUM(m."quantity" * m."priceAtMovement"), 0) as "revenue",
          COALESCE(SUM(m."quantity" * (m."priceAtMovement" - v."costPrice")), 0) as "profit"
        FROM "stock_movements" m
        JOIN "product_variants" v ON m."variantId" = v.id
        WHERE m."type" = 'OUT'
        AND m."createdAt" >= ${todayStart}
      `,
      // Transaction for counts and recent movements
      db.$transaction([
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
      ])
    ]);

    const valuation = inventoryValuation[0];
    const weightedMarginSum = Number(valuation.weightedMarginSum);
    const totalStockForMargin = Number(valuation.totalStockForMargin);
    const averageMarginPercent =
      totalStockForMargin > 0
        ? (weightedMarginSum / totalStockForMargin) * 100
        : 0;

    // Format trends for Recharts
    const trendMap = new Map<string, { name: string; in: number; out: number }>();
    for (let i = 0; i < 7; i++) {
      const d = new Date(sevenDaysAgo);
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().split("T")[0];
      const name = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
      trendMap.set(dateStr, { name, in: 0, out: 0 });
    }

    trends.forEach((t) => {
      const entry = trendMap.get(t.date);
      if (entry) {
        if (t.type === "IN") entry.in = Number(t.total);
        if (t.type === "OUT") entry.out = Number(t.total);
      }
    });

    const movementTrend = Array.from(trendMap.values());

    const distribution = [
      { name: "< 10%", value: 0, count: 0 },
      { name: "10-20%", value: 0, count: 0 },
      { name: "20-30%", value: 0, count: 0 },
      { name: "30-50%", value: 0, count: 0 },
      { name: "> 50%", value: 0, count: 0 },
    ];

    margins.forEach((m) => {
      const p = Number(m.margin_percent);
      let idx = 0;
      if (p < 10) idx = 0;
      else if (p < 20) idx = 1;
      else if (p < 30) idx = 2;
      else if (p < 50) idx = 3;
      else idx = 4;
      distribution[idx].count++;
    });

    const totalWithStock = margins.length;
    if (totalWithStock > 0) {
      distribution.forEach((d) => {
        d.value = Math.round((d.count / totalWithStock) * 100);
      });
    }

    return NextResponse.json({
      stats: {
        totalProducts,
        totalVariants,
        lowStockCount: lowStockVariants.length,
        todayMovementsIn: todayIn._sum.quantity ?? 0,
        todayMovementsOut: todayOut._sum.quantity ?? 0,
        todayRevenue: Number(todaySales[0].revenue),
        todayProfit: Number(todaySales[0].profit),
        recentMovements,
        totalInventoryCost: Number(valuation.totalCost),
        totalInventoryRevenue: Number(valuation.totalRevenue),
        totalProfitPotential: Number(valuation.totalProfit),
        averageMarginPercent: Math.round(averageMarginPercent * 100) / 100,
        movementTrend,
        marginDistribution: distribution,
        topPerformers: topPerformers.map((tp) => ({
          ...tp,
          profit: Number(tp.profit),
          salesCount: 0,
        })),
        slowMovingItems: slowMovingItemsData.map((item) => {
          const lastOut = item.last_out ? new Date(item.last_out) : null;
          const diffDays = lastOut
            ? Math.floor((new Date().getTime() - lastOut.getTime()) / (1000 * 3600 * 24))
            : null;
          return {
            id: item.id,
            name: item.name,
            sku: item.sku,
            currentStock: item.currentStock,
            daysSinceLastMovement: diffDays,
          };
        }),
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
});
