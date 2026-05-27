import { describe, it, expect, beforeEach } from 'vitest';
import { MovementRepo } from '@/app/repositories/movementRepo';
import { db } from '@/lib/db';
import { ApiError } from '@/lib/errors';

describe('MovementRepo Logic (Integration)', () => {
  let testProduct: any;
  let testVariant: any;
  let testUser: any;

  beforeEach(async () => {
    testUser = await db.user.create({
      data: {
        email: 'test@example.com',
        name: 'Test User',
        role: 'OWNER',
      },
    });

    testProduct = await db.product.create({
      data: {
        name: 'Test Product',
      },
    });

    testVariant = await db.productVariant.create({
      data: {
        productId: testProduct.id,
        costPrice: 50,
        price: 100,
        currentStock: 10,
      },
    });
  });

  it('should create a stock IN movement and increase currentStock', async () => {
    const initialStock = testVariant.currentStock;
    const movementQuantity = 5;

    const movement = await MovementRepo.createMovement({
      variantId: testVariant.id,
      type: 'IN',
      quantity: movementQuantity,
      priceAtMovement: 100,
    }, testUser.id);

    const updatedVariant = await db.productVariant.findUnique({ where: { id: testVariant.id } });

    expect(movement).toBeDefined();
    expect(movement.type).toBe('IN');
    expect(movement.quantity).toBe(movementQuantity);
    expect(updatedVariant?.currentStock).toBe(initialStock + movementQuantity);
  });

  it('should create a stock OUT movement and decrease currentStock', async () => {
    const initialStock = testVariant.currentStock;
    const movementQuantity = 3;

    const movement = await MovementRepo.createMovement({
      variantId: testVariant.id,
      type: 'OUT',
      quantity: movementQuantity,
      priceAtMovement: 100,
    }, testUser.id);

    const updatedVariant = await db.productVariant.findUnique({ where: { id: testVariant.id } });

    expect(movement).toBeDefined();
    expect(movement.type).toBe('OUT');
    expect(movement.quantity).toBe(movementQuantity);
    expect(updatedVariant?.currentStock).toBe(initialStock - movementQuantity);
  });

  it('should create an ADJUSTMENT movement and set currentStock directly', async () => {
    const newStock = 25;

    const movement = await MovementRepo.createMovement({
      variantId: testVariant.id,
      type: 'ADJUSTMENT',
      quantity: newStock,
      priceAtMovement: 100,
    }, testUser.id);

    const updatedVariant = await db.productVariant.findUnique({ where: { id: testVariant.id } });

    expect(movement).toBeDefined();
    expect(movement.type).toBe('ADJUSTMENT');
    expect(movement.quantity).toBe(newStock);
    expect(updatedVariant?.currentStock).toBe(newStock);
  });

  it('should use sale price for OUT movements when available', async () => {
    const salePrice = 80;
    await db.productVariant.update({
      where: { id: testVariant.id },
      data: { salePrice },
    });

    const movement = await MovementRepo.createMovement({
      variantId: testVariant.id,
      type: 'OUT',
      quantity: 1,
    }, testUser.id);

    expect(movement.priceAtMovement?.toNumber()).toBe(salePrice);
  });

  it('throws an ApiError on OUT movement if insufficient stock', async () => {
    await expect(MovementRepo.createMovement({
      variantId: testVariant.id,
      type: 'OUT',
      quantity: 9999, // More than the 10 in stock
      priceAtMovement: 100,
    }, testUser.id)).rejects.toThrowError(ApiError);
  });
});
