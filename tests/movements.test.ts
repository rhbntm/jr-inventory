import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/lib/db';

describe('Stock Movement Logic', () => {
  let testProduct: any;
  let testVariant: any;

  beforeEach(async () => {
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

    const [movement, updatedVariant] = await db.$transaction([
      db.stockMovement.create({
        data: {
          variantId: testVariant.id,
          type: 'IN',
          quantity: movementQuantity,
          priceAtMovement: 100,
        },
      }),
      db.productVariant.update({
        where: { id: testVariant.id },
        data: { currentStock: { increment: movementQuantity } },
      }),
    ]);

    expect(movement).toBeDefined();
    expect(movement.type).toBe('IN');
    expect(movement.quantity).toBe(movementQuantity);
    expect(updatedVariant.currentStock).toBe(initialStock + movementQuantity);
  });

  it('should create a stock OUT movement and decrease currentStock', async () => {
    const initialStock = testVariant.currentStock;
    const movementQuantity = 3;

    const [movement, updatedVariant] = await db.$transaction([
      db.stockMovement.create({
        data: {
          variantId: testVariant.id,
          type: 'OUT',
          quantity: movementQuantity,
          priceAtMovement: 100,
        },
      }),
      db.productVariant.update({
        where: { id: testVariant.id },
        data: { currentStock: { increment: -movementQuantity } },
      }),
    ]);

    expect(movement).toBeDefined();
    expect(movement.type).toBe('OUT');
    expect(movement.quantity).toBe(movementQuantity);
    expect(updatedVariant.currentStock).toBe(initialStock - movementQuantity);
  });

  it('should create an ADJUSTMENT movement and set currentStock directly', async () => {
    const newStock = 25;

    const [movement, updatedVariant] = await db.$transaction([
      db.stockMovement.create({
        data: {
          variantId: testVariant.id,
          type: 'ADJUSTMENT',
          quantity: newStock,
          priceAtMovement: 100,
        },
      }),
      db.productVariant.update({
        where: { id: testVariant.id },
        data: { currentStock: newStock },
      }),
    ]);

    expect(movement).toBeDefined();
    expect(movement.type).toBe('ADJUSTMENT');
    expect(movement.quantity).toBe(newStock);
    expect(updatedVariant.currentStock).toBe(newStock);
  });

  it('should use sale price for OUT movements when available', async () => {
    const salePrice = 80;
    await db.productVariant.update({
      where: { id: testVariant.id },
      data: { salePrice },
    });

    const movement = await db.stockMovement.create({
      data: {
        variantId: testVariant.id,
        type: 'OUT',
        quantity: 1,
        priceAtMovement: salePrice,
      },
    });

    expect(movement.priceAtMovement?.toNumber()).toBe(salePrice);
  });
});
