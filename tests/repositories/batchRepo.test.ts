import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BatchRepo, resolveCostPerUnit, estimateBatchQuantity } from '@/app/repositories/batchRepo';
import { db } from '@/lib/db';
import { ApiError } from '@/lib/errors';

// Mock Prisma client
vi.mock('@/lib/db', () => {
  return {
    db: {
      $transaction: vi.fn(),
      $queryRaw: vi.fn(),
      batch: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
      },
      productVariant: {
        findMany: vi.fn(),
        update: vi.fn(),
      },
      batchMovement: {
        create: vi.fn(),
        deleteMany: vi.fn(),
      },
      stockMovement: {
        create: vi.fn(),
        aggregate: vi.fn(),
      },
    },
  };
});

// ─── resolveCostPerUnit ──────────────────────────────────────────────────────
// Pure function — no mocks needed.

describe('resolveCostPerUnit', () => {
  it('tier 1: returns explicit override when provided', () => {
    expect(resolveCostPerUnit({ explicitCostPerUnit: 42, totalCost: 999, sellableQty: 10 })).toBe(42);
  });

  it('tier 1: treats explicit 0 as a valid known cost (not unknown)', () => {
    // A user intentionally entering ₱0 cost should be preserved, not treated as null.
    expect(resolveCostPerUnit({ explicitCostPerUnit: 0, totalCost: 999, sellableQty: 10 })).toBe(0);
  });

  it('tier 2: auto-calculates totalCost / sellableQty when no override', () => {
    expect(resolveCostPerUnit({ totalCost: 8500, sellableQty: 280 })).toBeCloseTo(30.357, 2);
  });

  it('tier 3: returns null when totalCost is null', () => {
    expect(resolveCostPerUnit({ totalCost: null, sellableQty: 100 })).toBeNull();
  });

  it('tier 3: returns null when totalCost is 0 (not recorded)', () => {
    // ₱0 total cost means the user did not enter a cost — treat as unknown, not free.
    expect(resolveCostPerUnit({ totalCost: 0, sellableQty: 100 })).toBeNull();
  });

  it('tier 3: returns null when sellableQty is 0 (all damaged, nothing sellable)', () => {
    expect(resolveCostPerUnit({ totalCost: 5000, sellableQty: 0 })).toBeNull();
  });

  it('tier 3: returns null when both totalCost and sellableQty are absent', () => {
    expect(resolveCostPerUnit({ sellableQty: 0 })).toBeNull();
  });
});

// ─── estimateBatchQuantity ───────────────────────────────────────────────────
// Pure function — no mocks needed.

describe('estimateBatchQuantity', () => {
  it('calculates weightPerUnit and estimatedTotalQty correctly', () => {
    const result = estimateBatchQuantity({ sampleWeight: 1.5, sampleQty: 10, totalWeight: 45.0 });
    expect(result.weightPerUnit).toBeCloseTo(0.15);
    expect(result.estimatedTotalQty).toBe(300); // 45.0 / 0.15 = 300
  });

  it('floors the estimated total quantity', () => {
    const result = estimateBatchQuantity({ sampleWeight: 2, sampleQty: 3, totalWeight: 100 });
    // weightPerUnit = 2/3 = 0.666...
    // totalWeight / weightPerUnit = 100 / (2/3) = 150
    expect(result.estimatedTotalQty).toBe(150);

    // Let's use a non-integer result
    const result2 = estimateBatchQuantity({ sampleWeight: 1.5, sampleQty: 10, totalWeight: 45.1 });
    // 45.1 / 0.15 = 300.666...
    expect(result2.estimatedTotalQty).toBe(300);
  });

  it('throws an error if sampleQty is 0 or less', () => {
    expect(() => estimateBatchQuantity({ sampleWeight: 1.5, sampleQty: 0, totalWeight: 45.0 }))
      .toThrow('Sample quantity must be > 0');
    expect(() => estimateBatchQuantity({ sampleWeight: 1.5, sampleQty: -5, totalWeight: 45.0 }))
      .toThrow('Sample quantity must be > 0');
  });

  it('throws an error if sampleWeight is 0 or less', () => {
    expect(() => estimateBatchQuantity({ sampleWeight: 0, sampleQty: 10, totalWeight: 45.0 }))
      .toThrow('Sample weight must be > 0');
    expect(() => estimateBatchQuantity({ sampleWeight: -1.5, sampleQty: 10, totalWeight: 45.0 }))
      .toThrow('Sample weight must be > 0');
  });

  it('throws an error if totalWeight is negative', () => {
    expect(() => estimateBatchQuantity({ sampleWeight: 1.5, sampleQty: 10, totalWeight: -45.0 }))
      .toThrow('Total weight cannot be negative');
  });
});

// ─── BatchRepo ────────────────────────────────────────────────────────────────

/** Runs interactive transactions against the mocked client. */
function runTransactionsInline() {
  (db.$transaction as any).mockImplementation(async (callback: any) => callback(db));
}

describe('BatchRepo', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    runTransactionsInline();
  });

  describe('processBatch', () => {
    it('returns 409 and writes nothing when the batch was already processed', async () => {
      (db.batch.findUnique as any).mockResolvedValueOnce({ id: 'b1', totalCost: 4000, supplierName: null });
      (db.productVariant.findMany as any).mockResolvedValueOnce([{ id: 'v1', price: 50 }]);
      // actualQty is no longer null, so the claim matches no row
      (db.batch.updateMany as any).mockResolvedValueOnce({ count: 0 });

      await expect(BatchRepo.processBatch('b1', {
        assignments: [{ variantId: 'v1', quantity: 10, costPerUnit: null }],
        damagedQty: 0,
        actualQty: 10,
      }, 'u1')).rejects.toMatchObject({ statusCode: 409 });

      expect(db.batch.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'b1', actualQty: null } })
      );
      expect(db.batchMovement.create).not.toHaveBeenCalled();
      expect(db.productVariant.update).not.toHaveBeenCalled();
      expect(db.stockMovement.create).not.toHaveBeenCalled();
    });

    it('divides total cost by the assigned quantity, not the weighing estimate', async () => {
      (db.batch.findUnique as any)
        .mockResolvedValueOnce({ id: 'b1', totalCost: 4000, supplierName: 'Supplier' })
        .mockResolvedValueOnce({ id: 'b1' });
      (db.productVariant.findMany as any).mockResolvedValueOnce([
        { id: 'v1', price: 50 },
        { id: 'v2', price: 60 },
      ]);
      (db.batch.updateMany as any).mockResolvedValueOnce({ count: 1 });

      await BatchRepo.processBatch('b1', {
        assignments: [
          { variantId: 'v1', quantity: 300, costPerUnit: null },
          { variantId: 'v2', quantity: 100, costPerUnit: null },
        ],
        damagedQty: 50,
        actualQty: 500, // weighing estimate
      }, 'u1');

      // ₱4000 / 400 assigned = ₱10, not ₱4000 / 500 = ₱8
      const costs = (db.batchMovement.create as any).mock.calls.map((c: any) => c[0].data.costPerUnit);
      expect(costs).toEqual([10, 10]);
      // The header still records the estimate as actualQty
      expect(db.batch.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: { actualQty: 500, damagedQty: 50 } })
      );
    });
  });

  describe('reprocessBatch', () => {
    const processedBatch = {
      id: 'b1',
      actualQty: 10,
      totalCost: 1000,
      supplierName: null,
      movements: [{ variantId: 'v1', quantity: 10, costPerUnit: 100 }],
    };

    /** Mocks the in-transaction reads: batch lock, batch, net movement sums, variant lock. */
    function mockReprocessReads(opts: {
      batch?: any;
      inQty?: number | null;
      outQty?: number | null;
      variants?: any[];
    }) {
      (db.$queryRaw as any)
        .mockResolvedValueOnce([{ id: 'b1' }]) // batch lock
        .mockResolvedValueOnce([]); // variant lock
      (db.batch.findUnique as any).mockResolvedValueOnce(opts.batch ?? processedBatch);
      (db.stockMovement.aggregate as any)
        .mockResolvedValueOnce({ _sum: { quantity: opts.inQty === undefined ? 10 : opts.inQty } })
        .mockResolvedValueOnce({ _sum: { quantity: opts.outQty === undefined ? null : opts.outQty } });
      if (opts.variants) (db.productVariant.findMany as any).mockResolvedValueOnce(opts.variants);
    }

    it('throws ApiError if variant would have negative available stock', async () => {
      // Available = 10 - 5 = 5. Net change = 1 - 10 = -9. 5 - 9 < 0.
      mockReprocessReads({
        variants: [{ id: 'v1', currentStock: 10, reservedStock: 5, price: 200, costPrice: 100 }],
      });

      await expect(BatchRepo.reprocessBatch('b1', {
        assignments: [{ variantId: 'v1', quantity: 1, costPerUnit: 100 }],
        damagedQty: 0,
        actualQty: 1,
      }, 'u1')).rejects.toThrowError(ApiError);

      expect(db.stockMovement.create).not.toHaveBeenCalled();
    });

    it('processes successfully and writes the reversal without a selling price', async () => {
      // Available = 15 - 5 = 10. Net delta = 5 - 10 = -5. Final available = 5.
      mockReprocessReads({
        variants: [{ id: 'v1', currentStock: 15, reservedStock: 5, price: 200, costPrice: 100 }],
      });
      (db.batch.findUnique as any).mockResolvedValueOnce({ ...processedBatch, id: 'b1_done' });

      const result = await BatchRepo.reprocessBatch('b1', {
        assignments: [{ variantId: 'v1', quantity: 5, costPerUnit: 100 }],
        damagedQty: 0,
        actualQty: 5,
      }, 'u1');

      expect(result!.id).toBe('b1_done');
      expect(db.batchMovement.deleteMany).toHaveBeenCalledWith({ where: { batchId: 'b1' } });
      // 1 OUT reversal for old movement, 1 IN for new assignment
      expect(db.stockMovement.create).toHaveBeenCalledTimes(2);
      const reversal = (db.stockMovement.create as any).mock.calls[0][0].data;
      expect(reversal.type).toBe('OUT');
      // Not a sale: no selling price, so it never counts as revenue
      expect(reversal.priceAtMovement).toBeNull();
      expect(db.productVariant.update).toHaveBeenCalledWith({
        where: { id: 'v1' },
        data: { currentStock: { increment: -5 } },
      });
    });

    it('rejects a manual tally batch whose stock movements do not match its assignments', async () => {
      // Manual tally: BatchMovement holds good+stained+damaged = 10,
      // but only 6 good went IN and 2 damaged went OUT.
      mockReprocessReads({ inQty: 6, outQty: 2 });

      await expect(BatchRepo.reprocessBatch('b1', {
        assignments: [{ variantId: 'v1', quantity: 10, costPerUnit: null }],
        damagedQty: 0,
        actualQty: 10,
      }, 'u1')).rejects.toMatchObject({ statusCode: 409 });

      expect(db.stockMovement.create).not.toHaveBeenCalled();
      expect(db.productVariant.update).not.toHaveBeenCalled();
    });

    it('rejects a batch that has not been processed yet', async () => {
      mockReprocessReads({ batch: { ...processedBatch, actualQty: null } });

      await expect(BatchRepo.reprocessBatch('b1', {
        assignments: [{ variantId: 'v1', quantity: 10, costPerUnit: null }],
        damagedQty: 0,
      }, 'u1')).rejects.toMatchObject({ statusCode: 409 });
    });
  });
});
