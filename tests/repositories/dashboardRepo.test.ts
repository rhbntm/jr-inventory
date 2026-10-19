import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DashboardRepo } from '@/app/repositories/dashboardRepo';
import { db } from '@/lib/db';

// Mock Prisma client
vi.mock('@/lib/db', () => {
  const mockQueryRaw = vi.fn();
  const mockTransaction = vi.fn();
  const mockProduct = { count: vi.fn() };
  const mockProductVariant = { count: vi.fn() };
  const mockStockMovement = {
    aggregate: vi.fn(),
    findMany: vi.fn(),
  };
  return {
    db: {
      $queryRaw: mockQueryRaw,
      $transaction: mockTransaction,
      product: mockProduct,
      productVariant: mockProductVariant,
      stockMovement: mockStockMovement,
    },
  };
});

describe('DashboardRepo.getDashboardStats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns correctly shaped stats', async () => {
    // Mock low stock variants
    (db.$queryRaw as any).mockResolvedValueOnce([
      {
        id: 'v1',
        sku: 'SKU1',
        size: 'M',
        color: null,
        fabric: null,
        currentStock: 4,
        reservedStock: 2, // Available stock = 2 <= 5 (lowStockAt)
        lowStockAt: 5,
        price: 100,
        productId: 'p1',
        product_name: 'Prod 1',
      },
    ]);

    // Mock low stock count (separate query, not capped by the list's LIMIT)
    (db.$queryRaw as any).mockResolvedValueOnce([{ count: 1 }]);

    // Mock inventory valuation
    (db.$queryRaw as any).mockResolvedValueOnce([
      {
        totalCost: 200,
        totalRevenue: 500,
        totalProfit: 300,
        weightedMarginSum: 0.6,
        totalStockForMargin: 10,
      },
    ]);

    // Mock trends
    (db.$queryRaw as any).mockResolvedValueOnce([
      { date: '2023-01-01', type: 'IN', total: 5 },
      { date: '2023-01-01', type: 'OUT', total: 2 },
    ]);

    // Mock margins
    (db.$queryRaw as any).mockResolvedValueOnce([
      { margin_percent: 20 },
    ]);

    // Mock top performers
    (db.$queryRaw as any).mockResolvedValueOnce([
      { id: 'v1', name: 'Prod 1', sku: 'SKU1', profit: 150, currentStock: 2 },
    ]);

    // Mock slow moving items
    (db.$queryRaw as any).mockResolvedValueOnce([
      { id: 'v2', name: 'Prod 2', sku: 'SKU2', currentStock: 10, reservedStock: 9, last_out: null },
    ]);

    // Mock today sales
    (db.$queryRaw as any).mockResolvedValueOnce([
      { revenue: 1000, profit: 400 },
    ]);

    // Mock transaction for counts and recent movements
    (db.$transaction as any).mockResolvedValueOnce([
      5, // totalProducts
      12, // totalVariants
      { _sum: { quantity: 3 } }, // todayIn
      { _sum: { quantity: 2 } }, // todayOut
      [
        {
          id: 'm1',
          type: 'IN',
          quantity: 1,
          priceAtMovement: 100,
          variant: { id: 'v1', product: { id: 'p1', name: 'Prod 1' } },
          user: { id: 'u1', email: 'test@example.com' },
        },
      ],
    ]);

    const result = await DashboardRepo.getDashboardStats();

    // Basic shape assertions
    expect(result.stats.totalProducts).toBe(5);
    expect(result.stats.lowStockCount).toBe(1);
    expect(result.lowStockItems).toHaveLength(1);
    expect(result.stats.todayRevenue).toBe(1000);
    expect(result.stats.todayProfit).toBe(400);
    expect(result.stats.slowMovingItems[0].availableStock).toBe(1);
  });

  it('reports the full low-stock count even when the list is limited', async () => {
    const lowStockRow = {
      id: 'v1', sku: null, size: null, color: null, fabric: null,
      currentStock: 0, reservedStock: 0, lowStockAt: 5, price: 100,
      productId: 'p1', product_name: 'Prod 1',
    };
    (db.$queryRaw as any)
      .mockResolvedValueOnce(Array.from({ length: 20 }, (_, i) => ({ ...lowStockRow, id: `v${i}` }))) // list (LIMIT 20)
      .mockResolvedValueOnce([{ count: 37 }]) // count
      .mockResolvedValueOnce([{ totalCost: 0, totalRevenue: 0, totalProfit: 0, weightedMarginSum: 0, totalStockForMargin: 0 }])
      .mockResolvedValueOnce([]) // trends
      .mockResolvedValueOnce([]) // margins
      .mockResolvedValueOnce([]) // top performers
      .mockResolvedValueOnce([]) // slow moving
      .mockResolvedValueOnce([{ revenue: 0, profit: 0 }]); // today sales
    (db.$transaction as any).mockResolvedValueOnce([0, 0, { _sum: { quantity: null } }, { _sum: { quantity: null } }, []]);

    const result = await DashboardRepo.getDashboardStats();

    expect(result.lowStockItems).toHaveLength(20);
    expect(result.stats.lowStockCount).toBe(37);
  });
});
