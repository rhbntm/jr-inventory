import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CategoryRepo } from '@/app/repositories/categoryRepo';
import { db } from '@/lib/db';
import { ApiError } from '@/lib/errors';

// Mock Prisma client
vi.mock('@/lib/db', () => {
  return {
    db: {
      category: {
        findMany: vi.fn(),
        create: vi.fn(),
        delete: vi.fn(),
      },
      product: {
        count: vi.fn(),
      },
    },
  };
});

describe('CategoryRepo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getCategories', () => {
    it('returns categories ordered by name', async () => {
      const mockCategories = [{ id: '1', name: 'A' }, { id: '2', name: 'B' }];
      (db.category.findMany as any).mockResolvedValue(mockCategories);

      const result = await CategoryRepo.getCategories();
      
      expect(db.category.findMany).toHaveBeenCalledWith({ orderBy: { name: 'asc' } });
      expect(result).toEqual(mockCategories);
    });
  });

  describe('createCategory', () => {
    it('creates a category with the given name', async () => {
      const mockCategory = { id: '1', name: 'New Category' };
      (db.category.create as any).mockResolvedValue(mockCategory);

      const result = await CategoryRepo.createCategory('New Category');
      
      expect(db.category.create).toHaveBeenCalledWith({ data: { name: 'New Category' } });
      expect(result).toEqual(mockCategory);
    });
  });

  describe('deleteCategory', () => {
    it('deletes category if no products exist', async () => {
      (db.product.count as any).mockResolvedValue(0);
      (db.category.delete as any).mockResolvedValue({ id: '1', name: 'Test' });

      await CategoryRepo.deleteCategory('1');
      
      expect(db.product.count).toHaveBeenCalledWith({ where: { categoryId: '1' } });
      expect(db.category.delete).toHaveBeenCalledWith({ where: { id: '1' } });
    });

    it('throws ApiError if products exist', async () => {
      (db.product.count as any).mockResolvedValue(5);

      await expect(CategoryRepo.deleteCategory('1')).rejects.toThrowError(ApiError);
      
      expect(db.product.count).toHaveBeenCalledWith({ where: { categoryId: '1' } });
      expect(db.category.delete).not.toHaveBeenCalled();
    });
  });
});
