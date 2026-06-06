import { db } from '@/lib/db';
import { ApiError } from '@/lib/errors';
import type { BatchInput, BatchProcessInput } from '@/lib/schemas';

/**
 * Resolves the cost-per-unit for a BatchMovement according to the canonical three-tier rule:
 *  1. Explicit override (caller-supplied).
 *  2. Auto: totalCost / sellableQty (good + stained only; damaged are excluded).
 *  3. Unknown → null. Never falls back to the variant's stored costPrice to avoid
 *     silently corrupting profit data with a price from a different batch.
 *
 * Export is intentionally at module level (not on BatchRepo) so unit tests can import it
 * directly without going through the class or mocking Prisma.
 */
export function resolveCostPerUnit(params: {
  explicitCostPerUnit?: number | null;
  totalCost?: number | null;
  sellableQty: number;
}): number | null {
  if (params.explicitCostPerUnit != null) return params.explicitCostPerUnit;
  if (params.totalCost != null && params.totalCost > 0 && params.sellableQty > 0) {
    return params.totalCost / params.sellableQty;
  }
  return null;
}

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
   * Create a manual tally batch.
   * Handles creating the batch, optionally creating a product/variant,
   * updating stock (current, stained, damaged), and creating stock movements.
   */
  static async createManualBatch(data: import('@/lib/schemas').ManualBatchInput, userId: string) {
    const { header, variantMode, variant: variantData, tally } = data;
    const actualQty = tally.good + tally.stained + tally.damaged;

    // Sellable quantity: good + stained only. Damaged units are pure loss and excluded
    // from cost allocation (see CONTEXT.md — Cost-per-unit resolution).
    const sellableQty = tally.good + tally.stained;
    const costPerUnit = resolveCostPerUnit({
      totalCost: header.totalCost,
      sellableQty,
    });

    return db.$transaction(async (tx) => {
      let targetVariantId = variantData?.existingId;
      let priceAtMovement = 0; // will be resolved

      if (variantMode === 'EXISTING') {
        if (!targetVariantId) throw new ApiError(400, "Existing variant ID required");
        const existing = await tx.productVariant.findUnique({ where: { id: targetVariantId } });
        if (!existing) throw new ApiError(404, "Variant not found");
        
        priceAtMovement = Number(existing.price);
        
      } else {
        // NEW VARIANT MODE
        if (!variantData?.productName) throw new ApiError(400, "Product name required for new variant");
        
        // Find or create product
        let product = await tx.product.findFirst({
          where: { name: { equals: variantData.productName, mode: 'insensitive' } }
        });

        if (!product) {
          product = await tx.product.create({
            data: {
              name: variantData.productName,
              categoryId: header.category ? (
                (await tx.category.findUnique({ where: { name: header.category } }))?.id ?? null
              ) : null,
            }
          });
        }

        const newPrice = variantData.price ?? 0; // The frontend should calculate and pass this
        
        const newVariant = await tx.productVariant.create({
          data: {
            productId: product.id,
            sku: variantData.sku ?? null,
            size: variantData.size ?? null,
            color: variantData.color ?? null,
            fabric: variantData.fabric ?? null,
            // costPerUnit may be null if totalCost was not provided. Variant.costPrice is
            // non-nullable (Decimal with default 0); store 0 rather than null here.
            // The null is preserved in BatchMovement / StockMovement for audit purposes.
            costPrice: costPerUnit ?? 0,
            price: newPrice,
            currentStock: 0,
            stainedStock: 0,
            damagedStock: 0,
          }
        });
        
        targetVariantId = newVariant.id;
        priceAtMovement = newPrice;
      }

      // 1. Create Batch
      const batch = await tx.batch.create({
        data: {
          supplierName: header.supplierName ?? null,
          purchaseDate: header.purchaseDate ?? null,
          totalCost: header.totalCost ?? null,
          estimatedQty: header.estimatedQty ?? null,
          category: header.category ?? null,
          notes: header.notes ?? null,
          actualQty: actualQty,
          damagedQty: tally.damaged,
          stainedQty: tally.stained,
        }
      });

      // 2. Create BatchMovement
      await tx.batchMovement.create({
        data: {
          batchId: batch.id,
          variantId: targetVariantId,
          quantity: actualQty,
          costPerUnit: costPerUnit,
        }
      });

      // 3. Update variant stock counters
      await tx.productVariant.update({
        where: { id: targetVariantId },
        data: {
          currentStock: { increment: tally.good },
          stainedStock: { increment: tally.stained },
          damagedStock: { increment: tally.damaged },
        }
      });

      // 4. Create Stock Movements
      
      // IN movement for GOOD items
      if (tally.good > 0) {
        await tx.stockMovement.create({
          data: {
            variantId: targetVariantId,
            type: 'IN',
            quantity: tally.good,
            priceAtMovement: priceAtMovement,
            costPriceAtMovement: costPerUnit,
            note: `Manual tally – good stock (Batch #${batch.id.slice(-6)})`,
            userId,
            batchId: batch.id,
          }
        });
      }

      // NO movement for stained items (they just increment stainedStock)

      // OUT movement for DAMAGED items
      if (tally.damaged > 0) {
        await tx.stockMovement.create({
          data: {
            variantId: targetVariantId,
            type: 'OUT',
            quantity: tally.damaged,
            priceAtMovement: 0,
            costPriceAtMovement: 0,
            note: `Damaged during sorting (Batch #${batch.id.slice(-6)})`,
            userId,
            batchId: batch.id,
          }
        });
      }

      return tx.batch.findUnique({
        where: { id: batch.id },
        include: BATCH_WITH_MOVEMENTS,
      });
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
        // sellableQty for the wizard flow = computedActualQty (assigned qty).
        // Damaged units are stored in batch.damagedQty but are never assigned to a
        // variant, so they are already excluded from the denominator.
        const resolvedCostPerUnit = resolveCostPerUnit({
          explicitCostPerUnit: costPerUnit,
          totalCost: batch.totalCost ? Number(batch.totalCost) : null,
          sellableQty: computedActualQty,
        });

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
            batchId: id,
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

  /**
   * Reprocess a batch: reverses old movements, applies new ones,
   * preserves audit trail via StockMovements, and ensures available stock
   * doesn't drop below zero.
   */
  static async reprocessBatch(id: string, data: BatchProcessInput, userId: string) {
    const { assignments, damagedQty, actualQty } = data;

    const batch = await db.batch.findUnique({
      where: { id },
      include: { movements: true },
    });
    if (!batch) throw new ApiError(404, 'Batch not found');

    // Validate all new variant IDs exist
    const newVariantIds = assignments.map((a) => a.variantId);
    const oldVariantIds = batch.movements.map((m) => m.variantId);
    const allVariantIds = Array.from(new Set([...newVariantIds, ...oldVariantIds]));

    const variants = await db.productVariant.findMany({ where: { id: { in: allVariantIds } } });
    if (variants.length !== allVariantIds.length) {
      throw new ApiError(422, 'One or more variant IDs are invalid');
    }

    const variantMap = new Map(variants.map((v) => [v.id, v]));

    // Calculate net deltas
    const deltas = new Map<string, number>();
    for (const vId of allVariantIds) deltas.set(vId, 0);

    for (const old of batch.movements) {
      deltas.set(old.variantId, deltas.get(old.variantId)! - old.quantity);
    }
    for (const current of assignments) {
      deltas.set(current.variantId, deltas.get(current.variantId)! + current.quantity);
    }

    // Safety check: ensure no variant drops below 0 available stock
    for (const [vId, delta] of Array.from(deltas.entries())) {
      const variant = variantMap.get(vId)!;
      const availableStock = variant.currentStock - variant.reservedStock;
      if (availableStock + delta < 0) {
        throw new ApiError(
          409,
          `Cannot reprocess: Variant ${variant.sku || vId} would have negative available stock.`
        );
      }
    }

    const computedActualQty = actualQty ?? assignments.reduce((sum, a) => sum + a.quantity, 0);

    await db.$transaction(async (tx) => {
      // 1. Reverse old movements in audit log (OUT)
      for (const old of batch.movements) {
        if (old.quantity <= 0) continue;
        await tx.stockMovement.create({
          data: {
            variantId: old.variantId,
            type: 'OUT',
            quantity: old.quantity,
            priceAtMovement: variantMap.get(old.variantId)?.price ?? 0,
            costPriceAtMovement: old.costPerUnit,
            note: `Batch #${id.slice(-6)} Reprocess Reversal`,
            userId,
            batchId: id,
          },
        });
      }

      // 2. Delete old BatchMovements
      await tx.batchMovement.deleteMany({ where: { batchId: id } });

      // 3. Update Batch totals
      await tx.batch.update({
        where: { id },
        data: { actualQty: computedActualQty, damagedQty },
      });

      // 4. Apply new assignments
      for (const { variantId, quantity, costPerUnit } of assignments) {
        if (quantity <= 0) continue;

        const variant = variantMap.get(variantId)!;
        const resolvedCostPerUnit = resolveCostPerUnit({
          explicitCostPerUnit: costPerUnit,
          totalCost: batch.totalCost ? Number(batch.totalCost) : null,
          sellableQty: computedActualQty,
        });

        // Record new BatchMovement
        await tx.batchMovement.create({
          data: { batchId: id, variantId, quantity, costPerUnit: resolvedCostPerUnit },
        });

        // Create new StockMovement (IN)
        await tx.stockMovement.create({
          data: {
            variantId,
            type: 'IN',
            quantity,
            priceAtMovement: Number(variant.price),
            costPriceAtMovement: resolvedCostPerUnit,
            note: `Batch #${id.slice(-6)} Reprocess – ${batch.supplierName ?? 'supplier'}`,
            userId,
            batchId: id,
          },
        });
      }

      // 5. Apply net stock changes
      for (const [vId, delta] of Array.from(deltas.entries())) {
        if (delta === 0) continue;
        await tx.productVariant.update({
          where: { id: vId },
          data: { currentStock: { increment: delta } },
        });
      }
    });

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
