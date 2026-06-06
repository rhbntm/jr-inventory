import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BatchRepo, resolveCostPerUnit, estimateBatchQuantity } from '@/app/repositories/batchRepo';
import { db } from '@/lib/db';
import { ApiError } from '@/lib/errors';

// Mock Prisma client
vi.mock('@/lib/db', () => {
  return {
    db: {
      $transaction: vi.fn(),
      batch: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
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

describe('BatchRepo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('reprocessBatch', () => {
    it('throws ApiError if variant would have negative available stock', async () => {
      const mockBatch = {
        id: 'b1',
        movements: [
          { variantId: 'v1', quantity: 10, costPerUnit: 100 },
        ],
      };

      (db.batch.findUnique as any).mockResolvedValueOnce(mockBatch);
      // Current stock is 10, reserved is 5. Available is 5.
      // Net change is 1 - 10 = -9.
      // 5 - 9 = -4 (invalid).
      (db.productVariant.findMany as any).mockResolvedValueOnce([
        { id: 'v1', currentStock: 10, reservedStock: 5, price: 200, costPrice: 100 },
      ]);

      const data = {
        assignments: [
          { variantId: 'v1', quantity: 1, costPerUnit: 100 },
        ],
        damagedQty: 0,
        actualQty: 1,
      };

      await expect(BatchRepo.reprocessBatch('b1', data, 'u1'))
        .rejects
        .toThrowError(ApiError);
    });

    it('processes successfully if stock remains non-negative', async () => {
      const mockBatch = {
        id: 'b1',
        movements: [
          { variantId: 'v1', quantity: 10, costPerUnit: 100 },
        ],
      };

      (db.batch.findUnique as any).mockResolvedValueOnce(mockBatch);
      // Available stock = 15 - 5 = 10. Net delta = 5 - 10 = -5. Final available = 5. (Valid)
      (db.productVariant.findMany as any).mockResolvedValueOnce([
        { id: 'v1', currentStock: 15, reservedStock: 5, price: 200, costPrice: 100 },
      ]);

      (db.$transaction as any).mockImplementationOnce(async (callback: any) => {
        return callback(db);
      });

      (db.batch.findUnique as any).mockResolvedValueOnce({ ...mockBatch, id: 'b1_done' });

      const data = {
        assignments: [
          { variantId: 'v1', quantity: 5, costPerUnit: 100 },
        ],
        damagedQty: 0,
        actualQty: 5,
      };

      const result = await BatchRepo.reprocessBatch('b1', data, 'u1');
      expect(result).not.toBeNull();
      expect(result!.id).toBe('b1_done');
      expect(db.batchMovement.deleteMany).toHaveBeenCalledWith({ where: { batchId: 'b1' } });
      // 1 OUT reversal for old movement, 1 IN for new assignment
      expect(db.stockMovement.create).toHaveBeenCalledTimes(2);
    });
  });
});
