import { describe, it, expect } from 'vitest';
import { productSchema, variantSchema, movementSchema } from '@/lib/schemas';

describe('Zod Schemas', () => {
  describe('productSchema', () => {
    it('should validate a valid product', () => {
      const result = productSchema.safeParse({
        name: 'Test Product',
        description: 'This is a test product',
        categoryId: 'cat-123',
      });
      expect(result.success).toBe(true);
    });

    it('should require a product name', () => {
      const result = productSchema.safeParse({
        description: 'Missing name',
      });
      expect(result.success).toBe(false);
    });

    it('should trim whitespace from product name', () => {
      const result = productSchema.safeParse({
        name: '  Product Name  ',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('Product Name');
      }
    });
  });

  describe('variantSchema', () => {
    it('should validate a valid variant', () => {
      const result = variantSchema.safeParse({
        productId: 'prod-123',
        costPrice: 50,
        price: 100,
      });
      expect(result.success).toBe(true);
    });

    it('should require a product ID', () => {
      const result = variantSchema.safeParse({
        costPrice: 50,
        price: 100,
      });
      expect(result.success).toBe(false);
    });

    it('should require costPrice to be non-negative', () => {
      const result = variantSchema.safeParse({
        productId: 'prod-123',
        costPrice: -10,
        price: 100,
      });
      expect(result.success).toBe(false);
    });

    it('should require price to be non-negative', () => {
      const result = variantSchema.safeParse({
        productId: 'prod-123',
        costPrice: 50,
        price: -20,
      });
      expect(result.success).toBe(false);
    });

    it('should have a default lowStockAt of 5', () => {
      const result = variantSchema.safeParse({
        productId: 'prod-123',
        costPrice: 50,
        price: 100,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.lowStockAt).toBe(5);
      }
    });
  });

  describe('movementSchema', () => {
    it('should validate a valid IN movement', () => {
      const result = movementSchema.safeParse({
        variantId: 'var-123',
        type: 'IN',
        quantity: 10,
      });
      expect(result.success).toBe(true);
    });

    it('should validate a valid OUT movement', () => {
      const result = movementSchema.safeParse({
        variantId: 'var-123',
        type: 'OUT',
        quantity: 5,
      });
      expect(result.success).toBe(true);
    });

    it('should validate a valid ADJUSTMENT movement', () => {
      const result = movementSchema.safeParse({
        variantId: 'var-123',
        type: 'ADJUSTMENT',
        quantity: 25,
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid movement types', () => {
      const result = movementSchema.safeParse({
        variantId: 'var-123',
        type: 'INVALID',
        quantity: 10,
      });
      expect(result.success).toBe(false);
    });

    it('should require quantity to be at least 1', () => {
      const result = movementSchema.safeParse({
        variantId: 'var-123',
        type: 'IN',
        quantity: 0,
      });
      expect(result.success).toBe(false);
    });

    it('should require quantity to be an integer', () => {
      const result = movementSchema.safeParse({
        variantId: 'var-123',
        type: 'IN',
        quantity: 10.5,
      });
      expect(result.success).toBe(false);
    });
  });
});
