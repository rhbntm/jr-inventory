import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProductRepo } from '@/app/repositories/productRepo';
import { db } from '@/lib/db';
import { ApiError } from '@/lib/errors';

// Mock Prisma client
vi.mock('@/lib/db', () => {
  return {
    db: {
      product: {
        findMany: vi.fn(),
        count: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        findUnique: vi.fn(),
      },
      productVariant: {
        findUnique: vi.fn(),
      },
      stockMovement: {
        count: vi.fn(),
      },
      $transaction: vi.fn(),
    },
  };
});

describe('ProductRepo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getProducts', () => {
    it('returns paginated products and total count', async () => {
      const mockProducts = [{ id: '1', name: 'Product A' }];
      (db.$transaction as any).mockResolvedValue([mockProducts, 1]);

      const result = await ProductRepo.getProducts('Product', 'cat-1', 1, 10);
      
      expect(db.$transaction).toHaveBeenCalled();
      expect(result.data).toEqual(mockProducts);
      expect(result.total).toBe(1);
      expect(result.totalPages).toBe(1);
    });
  });

  describe('createProduct', () => {
    it('creates a product with given data', async () => {
      const mockData = { name: 'P1', categoryId: 'cat-1' };
      (db.product.create as any).mockResolvedValue({ id: 'p1', ...mockData });

      await ProductRepo.createProduct(mockData);
      
      expect(db.product.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: 'P1',
          categoryId: 'cat-1',
        }),
        include: { category: true, variants: true },
      });
    });
  });

  describe('updateProduct', () => {
    it('updates a product with partial data', async () => {
      const updates = { name: 'P1 Updated' };
      (db.product.update as any).mockResolvedValue({ id: 'p1', name: 'P1 Updated' });

      await ProductRepo.updateProduct('p1', updates);
      
      expect(db.product.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: updates,
        include: { category: true, variants: true },
      });
    });
  });

  describe('deleteProduct', () => {
    it('deletes product if no stock history exists', async () => {
      (db.stockMovement.count as any).mockResolvedValue(0);

      await ProductRepo.deleteProduct('p1');
      
      expect(db.stockMovement.count).toHaveBeenCalledWith({ where: { variant: { productId: 'p1' } } });
      expect(db.product.delete).toHaveBeenCalledWith({ where: { id: 'p1' } });
    });

    it('throws ApiError if stock history exists', async () => {
      (db.stockMovement.count as any).mockResolvedValue(5);

      await expect(ProductRepo.deleteProduct('p1')).rejects.toThrowError(ApiError);
      
      expect(db.stockMovement.count).toHaveBeenCalledWith({ where: { variant: { productId: 'p1' } } });
      expect(db.product.delete).not.toHaveBeenCalled();
    });
  });
});
