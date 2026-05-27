import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VariantRepo } from '@/app/repositories/variantRepo';
import { db } from '@/lib/db';
import { ApiError } from '@/lib/errors';

// Mock Prisma client
vi.mock('@/lib/db', () => {
  return {
    db: {
      productVariant: {
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      stockMovement: {
        count: vi.fn(),
      },
    },
  };
});

describe('VariantRepo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createVariant', () => {
    it('creates a variant and initializes currentStock to 0', async () => {
      const mockData = {
        productId: 'p1',
        sku: 'V1',
        costPrice: 50,
        price: 100,
        lowStockAt: 5,
      };
      
      (db.productVariant.create as any).mockResolvedValue({ id: 'v1', ...mockData, currentStock: 0 });

      await VariantRepo.createVariant(mockData);
      
      expect(db.productVariant.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          productId: 'p1',
          sku: 'V1',
          costPrice: 50,
          price: 100,
          currentStock: 0,
        }),
        include: { product: true },
      });
    });
  });

  describe('updateVariant', () => {
    it('updates variant fields', async () => {
      const updates = { price: 120 };
      (db.productVariant.update as any).mockResolvedValue({ id: 'v1', price: 120 });

      await VariantRepo.updateVariant('v1', updates);
      
      expect(db.productVariant.update).toHaveBeenCalledWith({
        where: { id: 'v1' },
        data: updates,
        include: { product: true },
      });
    });
  });

  describe('deleteVariant', () => {
    it('deletes variant if no stock movements exist', async () => {
      (db.stockMovement.count as any).mockResolvedValue(0);

      await VariantRepo.deleteVariant('v1');
      
      expect(db.stockMovement.count).toHaveBeenCalledWith({ where: { variantId: 'v1' } });
      expect(db.productVariant.delete).toHaveBeenCalledWith({ where: { id: 'v1' } });
    });

    it('throws ApiError if stock movements exist', async () => {
      (db.stockMovement.count as any).mockResolvedValue(3);

      await expect(VariantRepo.deleteVariant('v1')).rejects.toThrowError(ApiError);
      
      expect(db.stockMovement.count).toHaveBeenCalledWith({ where: { variantId: 'v1' } });
      expect(db.productVariant.delete).not.toHaveBeenCalled();
    });
  });
});
