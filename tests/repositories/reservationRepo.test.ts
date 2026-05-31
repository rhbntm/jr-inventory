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
    expect(movements[0].priceAtMovement?.toNumber()).toBe(100);
    expect(movements[0].costPriceAtMovement?.toNumber()).toBe(50);
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
  it('prevents duplicate state transitions under concurrency', async () => {
    const res = await ReservationRepo.createReservation({
      variantId: testVariant.id,
      quantity: 2,
    }, testUser.id);

    // Both attempt to transition from RESERVED to SHIPPING.
    // The second one to acquire the lock will read 'SHIPPING' and throw ApiError.
    const p1 = ReservationRepo.transitionState(res.id, 'ship', testUser.id);
    const p2 = ReservationRepo.transitionState(res.id, 'ship', testUser.id);

    const results = await Promise.allSettled([p1, p2]);
    const fulfilled = results.filter(r => r.status === 'fulfilled');
    const rejected = results.filter(r => r.status === 'rejected');

    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);

    const updatedVariant = await db.productVariant.findUnique({ where: { id: testVariant.id } });
    const finalRes = await db.reservation.findUnique({ where: { id: res.id } });
    
    expect(finalRes?.state).toBe('SHIPPING');
    expect(updatedVariant?.reservedStock).toBe(2);
  });

  describe('getReservations', () => {
    it('returns all reservations when no filters are provided', async () => {
      await ReservationRepo.createReservation({ variantId: testVariant.id, quantity: 1 }, testUser.id);
      await ReservationRepo.createReservation({ variantId: testVariant.id, quantity: 1 }, testUser.id);
      
      const res = await ReservationRepo.getReservations({});
      expect(res.data.length).toBe(2);
      expect(res.total).toBe(2);
    });

    it('filters by state', async () => {
      const r1 = await ReservationRepo.createReservation({ variantId: testVariant.id, quantity: 1 }, testUser.id);
      await ReservationRepo.createReservation({ variantId: testVariant.id, quantity: 1 }, testUser.id);
      await ReservationRepo.transitionState(r1.id, 'cancel', testUser.id);

      const res = await ReservationRepo.getReservations({ state: 'CANCELLED' });
      expect(res.data.length).toBe(1);
      expect(res.data[0].state).toBe('CANCELLED');
    });

    it('filters by customerName (case insensitive)', async () => {
      await ReservationRepo.createReservation({ variantId: testVariant.id, quantity: 1, customerName: 'Alice Smith' }, testUser.id);
      await ReservationRepo.createReservation({ variantId: testVariant.id, quantity: 1, customerName: 'Bob Jones' }, testUser.id);

      const res = await ReservationRepo.getReservations({ customerName: 'alice' });
      expect(res.data.length).toBe(1);
      expect(res.data[0].customerName).toBe('Alice Smith');
    });

    it('filters by date range', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const r1 = await ReservationRepo.createReservation({ variantId: testVariant.id, quantity: 1 }, testUser.id);
      
      await db.reservation.update({
        where: { id: r1.id },
        data: { reservedAt: yesterday }
      });

      await ReservationRepo.createReservation({ variantId: testVariant.id, quantity: 1 }, testUser.id);

      const res = await ReservationRepo.getReservations({ endDate: yesterday.toISOString() });
      expect(res.data.length).toBe(1);
      expect(res.data[0].id).toBe(r1.id);
    });

    it('paginates correctly', async () => {
      // Create 5 reservations with distinct timestamps
      for (let i = 0; i < 5; i++) {
        const r = await ReservationRepo.createReservation({ variantId: testVariant.id, quantity: 1 }, testUser.id);
        const date = new Date();
        date.setSeconds(date.getSeconds() - i);
        await db.reservation.update({
          where: { id: r.id },
          data: { reservedAt: date }
        });
      }

      const page1 = await ReservationRepo.getReservations({ page: 1, pageSize: 3 });
      expect(page1.data.length).toBe(3);
      expect(page1.total).toBe(5);
      expect(page1.totalPages).toBe(2);

      const page2 = await ReservationRepo.getReservations({ page: 2, pageSize: 3 });
      expect(page2.data.length).toBe(2);
    });
  });
});
