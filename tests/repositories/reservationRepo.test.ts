import { describe, it, expect, beforeEach } from 'vitest';
import { ReservationRepo } from '@/app/repositories/reservationRepo';
import { db } from '@/lib/db';
import { ApiError } from '@/lib/errors';

describe('ReservationRepo Logic (Integration)', () => {
  let testProduct: any;
  let testVariant: any;
  let testUser: any;

  beforeEach(async () => {
    testUser = await db.user.create({
      data: {
        email: `test-${Date.now()}@example.com`,
        name: 'Test User',
        role: 'OWNER',
      },
    });

    testProduct = await db.product.create({
      data: {
        name: 'Test Product for Reservations',
      },
    });

    testVariant = await db.productVariant.create({
      data: {
        productId: testProduct.id,
        costPrice: 50,
        price: 100,
        currentStock: 10,
        reservedStock: 0,
      },
    });
  });

  it('should create a reservation and increase reservedStock', async () => {
    const qty = 3;
    const res = await ReservationRepo.createReservation({
      variantId: testVariant.id,
      quantity: qty,
      customerName: 'John Doe',
    }, testUser.id);

    expect(res).toBeDefined();
    expect(res.state).toBe('RESERVED');
    expect(res.quantity).toBe(qty);
    expect(res.customerName).toBe('John Doe');

    const updatedVariant = await db.productVariant.findUnique({ where: { id: testVariant.id } });
    expect(updatedVariant?.currentStock).toBe(10);
    expect(updatedVariant?.reservedStock).toBe(qty);
  });

  it('throws ApiError on insufficient available stock', async () => {
    // 10 in stock, we try to reserve 11
    await expect(ReservationRepo.createReservation({
      variantId: testVariant.id,
      quantity: 11,
    }, testUser.id)).rejects.toThrowError(ApiError);
  });

  it('transitions state from RESERVED to SHIPPING', async () => {
    const res = await ReservationRepo.createReservation({
      variantId: testVariant.id,
      quantity: 2,
    }, testUser.id);

    const updated = await ReservationRepo.transitionState(res.id, 'ship', testUser.id);
    expect(updated.state).toBe('SHIPPING');
    expect(updated.shippingAt).not.toBeNull();
  });

  it('transitions state from SHIPPING to SHIPPED and creates stock movement', async () => {
    const res = await ReservationRepo.createReservation({
      variantId: testVariant.id,
      quantity: 2,
    }, testUser.id);

    await ReservationRepo.transitionState(res.id, 'ship', testUser.id);
    const updated = await ReservationRepo.transitionState(res.id, 'deliver', testUser.id);
    
    expect(updated.state).toBe('SHIPPED');
    expect(updated.shippedAt).not.toBeNull();

    const updatedVariant = await db.productVariant.findUnique({ where: { id: testVariant.id } });
    expect(updatedVariant?.currentStock).toBe(8); // 10 - 2
    expect(updatedVariant?.reservedStock).toBe(0); // 2 - 2

    const movements = await db.stockMovement.findMany({ where: { variantId: testVariant.id } });
    expect(movements.length).toBe(1);
    expect(movements[0].type).toBe('OUT');
    expect(movements[0].quantity).toBe(2);
  });

  it('cancels reservation and restores reservedStock', async () => {
    const res = await ReservationRepo.createReservation({
      variantId: testVariant.id,
      quantity: 5,
    }, testUser.id);

    const updated = await ReservationRepo.transitionState(res.id, 'cancel', testUser.id);
    expect(updated.state).toBe('CANCELLED');

    const updatedVariant = await db.productVariant.findUnique({ where: { id: testVariant.id } });
    expect(updatedVariant?.currentStock).toBe(10);
    expect(updatedVariant?.reservedStock).toBe(0); // Restored
  });

  it('handles concurrent reservations correctly with locking', async () => {
    // We have 10 stock. We will try to reserve 6 and 5 concurrently.
    // One should succeed, the other should throw ApiError because 11 > 10.
    const p1 = ReservationRepo.createReservation({
      variantId: testVariant.id,
      quantity: 6,
    }, testUser.id);

    const p2 = ReservationRepo.createReservation({
      variantId: testVariant.id,
      quantity: 5,
    }, testUser.id);

    const results = await Promise.allSettled([p1, p2]);
    const fulfilled = results.filter(r => r.status === 'fulfilled');
    const rejected = results.filter(r => r.status === 'rejected');

    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);
    expect((rejected[0] as any).reason).toBeInstanceOf(ApiError);

    const updatedVariant = await db.productVariant.findUnique({ where: { id: testVariant.id } });
    expect(updatedVariant?.reservedStock).toBe(fulfilled[0].status === 'fulfilled' ? (fulfilled[0] as any).value.quantity : 0);
  });
});
