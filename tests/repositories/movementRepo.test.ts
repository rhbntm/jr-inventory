import { describe, it, expect, beforeEach } from 'vitest';
import { MovementRepo, UNDO_WINDOW_MS } from '@/app/repositories/movementRepo';
import { DashboardRepo } from '@/app/repositories/dashboardRepo';
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

  it('rejects an OUT movement that would sell reserved units', async () => {
    // 10 on hand, 8 reserved → only 2 available
    await db.productVariant.update({ where: { id: testVariant.id }, data: { reservedStock: 8 } });

    await expect(MovementRepo.createMovement({
      variantId: testVariant.id,
      type: 'OUT',
      quantity: 3,
    }, testUser.id)).rejects.toMatchObject({ statusCode: 422 });

    const unchanged = await db.productVariant.findUnique({ where: { id: testVariant.id } });
    expect(unchanged?.currentStock).toBe(10);

    // Selling exactly the available amount still works
    await MovementRepo.createMovement({ variantId: testVariant.id, type: 'OUT', quantity: 2 }, testUser.id);
    const after = await db.productVariant.findUnique({ where: { id: testVariant.id } });
    expect(after?.currentStock).toBe(8);
  });

  it('allows an ADJUSTMENT down to 0', async () => {
    await MovementRepo.createMovement({ variantId: testVariant.id, type: 'ADJUSTMENT', quantity: 0 }, testUser.id);
    const updated = await db.productVariant.findUnique({ where: { id: testVariant.id } });
    expect(updated?.currentStock).toBe(0);
  });

  it('rejects an ADJUSTMENT below the reserved quantity', async () => {
    await db.productVariant.update({ where: { id: testVariant.id }, data: { reservedStock: 4 } });

    await expect(MovementRepo.createMovement({
      variantId: testVariant.id,
      type: 'ADJUSTMENT',
      quantity: 3,
    }, testUser.id)).rejects.toMatchObject({ statusCode: 422 });
  });

  describe('undoMovement', () => {
    const stock = async () =>
      (await db.productVariant.findUnique({ where: { id: testVariant.id } }))?.currentStock;

    it('puts sold stock back and keeps both rows in the audit trail', async () => {
      const sale = await MovementRepo.createMovement(
        { variantId: testVariant.id, type: 'OUT', quantity: 3, priceAtMovement: 80 },
        testUser.id
      );
      expect(await stock()).toBe(7);

      const reversal = await MovementRepo.undoMovement(sale.id, testUser.id);

      expect(await stock()).toBe(10);
      expect(reversal.type).toBe('IN');
      expect(reversal.quantity).toBe(3);
      expect(reversal.voidedAt).not.toBeNull();
      const original = await db.stockMovement.findUnique({ where: { id: sale.id } });
      expect(original?.voidedAt).not.toBeNull();
      expect(await db.stockMovement.count({ where: { variantId: testVariant.id } })).toBe(2);
    });

    it('takes received stock back out', async () => {
      const received = await MovementRepo.createMovement(
        { variantId: testVariant.id, type: 'IN', quantity: 5 },
        testUser.id
      );
      expect(await stock()).toBe(15);

      const reversal = await MovementRepo.undoMovement(received.id, testUser.id);

      expect(await stock()).toBe(10);
      expect(reversal.type).toBe('OUT');
    });

    it('leaves undone sales out of the dashboard totals', async () => {
      const kept = await MovementRepo.createMovement(
        { variantId: testVariant.id, type: 'OUT', quantity: 1, priceAtMovement: 100 },
        testUser.id
      );
      const undone = await MovementRepo.createMovement(
        { variantId: testVariant.id, type: 'OUT', quantity: 2, priceAtMovement: 100 },
        testUser.id
      );
      await MovementRepo.undoMovement(undone.id, testUser.id);

      const { stats } = await DashboardRepo.getDashboardStats();

      expect(stats.todayRevenue).toBe(100);
      expect(stats.todayMovementsOut).toBe(1);
      expect(stats.todayMovementsIn).toBe(0);
      expect(stats.recentMovements.map((m) => m.id)).toEqual([kept.id]);
      const today = stats.movementTrend[stats.movementTrend.length - 1];
      expect(today).toMatchObject({ in: 0, out: 1 });
    });

    it('refuses to undo the same movement twice', async () => {
      const sale = await MovementRepo.createMovement(
        { variantId: testVariant.id, type: 'OUT', quantity: 1 },
        testUser.id
      );
      await MovementRepo.undoMovement(sale.id, testUser.id);

      await expect(MovementRepo.undoMovement(sale.id, testUser.id)).rejects.toMatchObject({ statusCode: 409 });
      expect(await stock()).toBe(10);
    });

    it('applies only one of two simultaneous undo requests', async () => {
      const sale = await MovementRepo.createMovement(
        { variantId: testVariant.id, type: 'OUT', quantity: 4 },
        testUser.id
      );

      const results = await Promise.allSettled([
        MovementRepo.undoMovement(sale.id, testUser.id),
        MovementRepo.undoMovement(sale.id, testUser.id),
      ]);

      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect(await stock()).toBe(10);
    });

    it('will not take back received stock that has since been sold', async () => {
      const received = await MovementRepo.createMovement(
        { variantId: testVariant.id, type: 'IN', quantity: 5 },
        testUser.id
      );
      await MovementRepo.createMovement({ variantId: testVariant.id, type: 'OUT', quantity: 12 }, testUser.id);

      await expect(MovementRepo.undoMovement(received.id, testUser.id)).rejects.toMatchObject({ statusCode: 422 });

      expect(await stock()).toBe(3);
      const original = await db.stockMovement.findUnique({ where: { id: received.id } });
      expect(original?.voidedAt).toBeNull();
    });

    it("refuses someone else's movement", async () => {
      const other = await db.user.create({ data: { email: 'other@example.com', name: 'Other', role: 'PARTNER' } });
      const sale = await MovementRepo.createMovement(
        { variantId: testVariant.id, type: 'OUT', quantity: 1 },
        testUser.id
      );

      await expect(MovementRepo.undoMovement(sale.id, other.id)).rejects.toMatchObject({ statusCode: 403 });
    });

    it('refuses movements owned by a batch or reservation, and adjustments', async () => {
      const adjustment = await MovementRepo.createMovement(
        { variantId: testVariant.id, type: 'ADJUSTMENT', quantity: 6 },
        testUser.id
      );
      const delivery = await db.stockMovement.create({
        data: { variantId: testVariant.id, type: 'OUT', quantity: 1, note: 'Reservation #abc', userId: testUser.id },
      });
      const batch = await db.batch.create({ data: {} });
      const intake = await db.stockMovement.create({
        data: { variantId: testVariant.id, type: 'IN', quantity: 1, batchId: batch.id, userId: testUser.id },
      });

      for (const movement of [adjustment, delivery, intake]) {
        await expect(MovementRepo.undoMovement(movement.id, testUser.id)).rejects.toMatchObject({ statusCode: 422 });
      }
    });

    it('refuses movements older than the undo window', async () => {
      const sale = await MovementRepo.createMovement(
        { variantId: testVariant.id, type: 'OUT', quantity: 1 },
        testUser.id
      );
      await db.stockMovement.update({
        where: { id: sale.id },
        data: { createdAt: new Date(Date.now() - UNDO_WINDOW_MS - 1000) },
      });

      await expect(MovementRepo.undoMovement(sale.id, testUser.id)).rejects.toMatchObject({ statusCode: 422 });
    });
  });
});
