import { db } from '@/lib/db';
import { ApiError } from '@/lib/errors';
import type { BatchInput, BatchProcessInput } from '@/lib/schemas';

/** Shared include for batch detail responses. */
const BATCH_WITH_MOVEMENTS = {
  movements: {
    include: { variant: { include: { product: true } } },
  },
} as const;

export class BatchRepo {
  /** List batches with pagination, newest first. */
  static async getBatches(page: number = 1, pageSize: number = 20) {
    const [batches, total] = await db.$transaction([
      db.batch.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: BATCH_WITH_MOVEMENTS,
      }),
      db.batch.count(),
    ]);

    return { data: batches, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  /** Get a single batch by ID with its movements. */
  static async getBatch(id: string) {
    const batch = await db.batch.findUnique({
      where: { id },
      include: {
        movements: {
          include: { variant: { include: { product: true } } },
          orderBy: { id: 'asc' },
        },
      },
    });

    if (!batch) throw new ApiError(404, 'Batch not found');
    return batch;
  }

  /** Create a new batch (header info only; processing is separate). */
  static async createBatch(data: BatchInput) {
    return db.batch.create({
      data: {
        supplierName: data.supplierName ?? null,
        purchaseDate: data.purchaseDate ?? null,
        totalCost: data.totalCost ?? null,
        estimatedQty: data.estimatedQty ?? null,
        category: data.category ?? null,
        notes: data.notes ?? null,
      },
    });
  }

  /**
   * Finalise a batch: records BatchMovements, creates IN StockMovements,
   * and updates variant stock — all within a single transaction.
   */
  static async processBatch(id: string, data: BatchProcessInput, userId: string) {
    const { assignments, damagedQty, actualQty } = data;

    const batch = await db.batch.findUnique({ where: { id } });
    if (!batch) throw new ApiError(404, 'Batch not found');

    // Validate all variant IDs exist
    const variantIds = assignments.map((a) => a.variantId);
    const variants = await db.productVariant.findMany({ where: { id: { in: variantIds } } });
    if (variants.length !== variantIds.length) {
      throw new ApiError(422, 'One or more variant IDs are invalid');
    }

    const variantMap = new Map(variants.map((v) => [v.id, v]));
    const computedActualQty = actualQty ?? assignments.reduce((sum, a) => sum + a.quantity, 0);

    await db.$transaction(async (tx) => {
      // Update batch with final quantities
      await tx.batch.update({
        where: { id },
        data: { actualQty: computedActualQty, damagedQty },
      });

      for (const { variantId, quantity, costPerUnit } of assignments) {
        if (quantity <= 0) continue;

        const variant = variantMap.get(variantId)!;
        const resolvedCostPerUnit =
          costPerUnit != null ? costPerUnit
          : batch.totalCost && computedActualQty > 0
            ? Number(batch.totalCost) / computedActualQty
            : Number(variant.costPrice);

        // Record BatchMovement
        await tx.batchMovement.create({
          data: { batchId: id, variantId, quantity, costPerUnit: resolvedCostPerUnit },
        });

        // Increment stock
        await tx.productVariant.update({
          where: { id: variantId },
          data: { currentStock: { increment: quantity } },
        });

        // Create a StockMovement record (IN)
        await tx.stockMovement.create({
          data: {
            variantId,
            type: 'IN',
            quantity,
            priceAtMovement: Number(variant.price),
            costPriceAtMovement: resolvedCostPerUnit,
            note: `Batch #${id.slice(-6)} – ${batch.supplierName ?? 'supplier'}`,
            userId,
          },
        });
      }
    });

    // Return the fully-populated batch after processing
    return db.batch.findUnique({
      where: { id },
      include: BATCH_WITH_MOVEMENTS,
    });
  }

  /** Compute batch analytics: top 5 by profit + highest damage %. */
  static async getBatchAnalytics() {
    const batches = await db.batch.findMany({
      where: { actualQty: { not: null } },
      include: {
        movements: { include: { variant: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    type BatchRow = typeof batches[number];

    const withProfit = batches.map((b: BatchRow) => {
      const revenue = b.movements.reduce(
        (sum, m) => sum + m.quantity * Number(m.variant.price),
        0
      );
      const cost = Number(b.totalCost ?? 0);
      const estimatedProfit = revenue - cost;
      const damagedQty = b.damagedQty ?? 0;
      const batchActualQty = b.actualQty ?? 0;
      const damagePercent = batchActualQty > 0 ? Math.round((damagedQty / batchActualQty) * 100) : 0;
      return { ...b, estimatedProfit, damagePercent };
    });

    const topBatchesByProfit = [...withProfit]
      .sort((a, b) => b.estimatedProfit - a.estimatedProfit)
      .slice(0, 5)
      .map(({ id, supplierName, purchaseDate, totalCost, estimatedProfit, damagedQty, damagePercent }) => ({
        id,
        supplierName,
        purchaseDate,
        totalCost: totalCost ? Number(totalCost) : null,
        estimatedProfit,
        damagedQty,
        damagePercent,
      }));

    const highestDamageBatches = [...withProfit]
      .sort((a, b) => b.damagePercent - a.damagePercent)
      .slice(0, 5)
      .map(({ id, supplierName, purchaseDate, damagedQty, actualQty, damagePercent }) => ({
        id,
        supplierName,
        purchaseDate,
        damagedQty,
        actualQty,
        damagePercent,
      }));

    return { topBatchesByProfit, highestDamageBatches };
  }
}
