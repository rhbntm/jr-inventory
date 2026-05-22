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
        currentStock: 2,
        lowStockAt: 5,
        price: 100,
        productId: 'p1',
        product_name: 'Prod 1',
      },
    ]);

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
      { id: 'v2', name: 'Prod 2', sku: 'SKU2', currentStock: 10, last_out: null },
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
  });
});
