import { describe, it, expect, beforeEach } from 'vitest';
import { ProductRepo } from '@/app/repositories/productRepo';
import { MovementRepo } from '@/app/repositories/movementRepo';
import { ReservationRepo } from '@/app/repositories/reservationRepo';
import { BatchRepo } from '@/app/repositories/batchRepo';
import { CategoryRepo } from '@/app/repositories/categoryRepo';
import { DashboardRepo } from '@/app/repositories/dashboardRepo';
import { db } from '@/lib/db';

describe('Archiving a product (Integration)', () => {
  let user: { id: string };
  let product: { id: string };
  let variant: { id: string };

  const isArchived = async () =>
    (await db.product.findUniqueOrThrow({ where: { id: product.id } })).isArchived;
  const stock = async () =>
    (await db.productVariant.findUniqueOrThrow({ where: { id: variant.id } })).currentStock;

  beforeEach(async () => {
    user = await db.user.create({
      data: { email: `archive-${Date.now()}@example.com`, name: 'Test User', role: 'PARTNER' },
    });
    product = await db.product.create({ data: { name: 'Ribbed Tank Top' } });
    variant = await db.productVariant.create({
      data: { productId: product.id, costPrice: 50, price: 100, currentStock: 10 },
    });
  });

  describe('setArchived', () => {
    it('archives a product that still has stock, and keeps the stock', async () => {
      await ProductRepo.setArchived(product.id, true);

      expect(await isArchived()).toBe(true);
      expect(await stock()).toBe(10);
    });

    it('refuses while units are held for a reservation', async () => {
      await ReservationRepo.createReservation({ variantId: variant.id, quantity: 2 }, user.id);

      await expect(ProductRepo.setArchived(product.id, true)).rejects.toMatchObject({
        statusCode: 409,
        message: '2 units are held for customers. Ship, release or cancel them first.',
      });
      expect(await isArchived()).toBe(false);
    });

    it('refuses while a reservation is shipping, then allows it once shipped', async () => {
      const reservation = await ReservationRepo.createReservation({ variantId: variant.id, quantity: 1 }, user.id);
      await ReservationRepo.transitionState(reservation.id, 'ship', user.id);

      await expect(ProductRepo.setArchived(product.id, true)).rejects.toMatchObject({ statusCode: 409 });

      await ReservationRepo.transitionState(reservation.id, 'deliver', user.id);
      await ProductRepo.setArchived(product.id, true);
      expect(await isArchived()).toBe(true);
    });

    it('counts reservations on variants that were archived on their own', async () => {
      await ReservationRepo.createReservation({ variantId: variant.id, quantity: 1 }, user.id);
      await db.productVariant.update({ where: { id: variant.id }, data: { isArchived: true } });

      await expect(ProductRepo.setArchived(product.id, true)).rejects.toMatchObject({ statusCode: 409 });
    });

    it('leaves individually archived variants archived after a restore', async () => {
      const retired = await db.productVariant.create({
        data: { productId: product.id, costPrice: 50, price: 100, isArchived: true },
      });

      await ProductRepo.setArchived(product.id, true);
      await ProductRepo.setArchived(product.id, false);

      expect(await isArchived()).toBe(false);
      expect((await db.productVariant.findUniqueOrThrow({ where: { id: retired.id } })).isArchived).toBe(true);
      expect((await db.productVariant.findUniqueOrThrow({ where: { id: variant.id } })).isArchived).toBe(false);
    });

    it('returns 404 for an unknown product', async () => {
      await expect(ProductRepo.setArchived('missing', true)).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  describe('getProducts', () => {
    it('lists active and archived products separately', async () => {
      const other = await db.product.create({ data: { name: 'Polo' } });
      await ProductRepo.setArchived(product.id, true);

      const active = await ProductRepo.getProducts();
      const archived = await ProductRepo.getProducts('', undefined, true, 1, 20, true);

      expect(active.data.map((p) => p.id)).toEqual([other.id]);
      expect(active.total).toBe(1);
      expect(archived.data.map((p) => p.id)).toEqual([product.id]);
    });

    it('still loads an archived product by id', async () => {
      await ProductRepo.setArchived(product.id, true);

      expect((await ProductRepo.getProductWithVariants(product.id, true))?.isArchived).toBe(true);
    });
  });

  describe('new activity on an archived product', () => {
    beforeEach(async () => {
      await ProductRepo.setArchived(product.id, true);
    });

    it('rejects a sale', async () => {
      await expect(
        MovementRepo.createMovement({ variantId: variant.id, type: 'OUT', quantity: 1 }, user.id)
      ).rejects.toMatchObject({ statusCode: 409, message: 'This product was archived. Restore it to sell it.' });
      expect(await stock()).toBe(10);
    });

    it('rejects a stock in', async () => {
      await expect(
        MovementRepo.createMovement({ variantId: variant.id, type: 'IN', quantity: 1 }, user.id)
      ).rejects.toMatchObject({ statusCode: 409 });
      expect(await stock()).toBe(10);
    });

    it('rejects a reservation', async () => {
      await expect(
        ReservationRepo.createReservation({ variantId: variant.id, quantity: 1 }, user.id)
      ).rejects.toMatchObject({ statusCode: 409, message: 'This product was archived. Restore it to reserve it.' });
    });

    it('still allows a stock correction', async () => {
      await MovementRepo.createMovement({ variantId: variant.id, type: 'ADJUSTMENT', quantity: 4 }, user.id);

      expect(await stock()).toBe(4);
    });

    it('allows selling again once restored', async () => {
      await ProductRepo.setArchived(product.id, false);
      await MovementRepo.createMovement({ variantId: variant.id, type: 'OUT', quantity: 1 }, user.id);

      expect(await stock()).toBe(9);
    });
  });

  describe('existing records keep working after archiving', () => {
    it('rejects selling a variant archived on its own', async () => {
      await db.productVariant.update({ where: { id: variant.id }, data: { isArchived: true } });

      await expect(
        MovementRepo.createMovement({ variantId: variant.id, type: 'OUT', quantity: 1 }, user.id)
      ).rejects.toMatchObject({ statusCode: 409 });
    });

    it('undoes a sale', async () => {
      const sale = await MovementRepo.createMovement({ variantId: variant.id, type: 'OUT', quantity: 3 }, user.id);
      await ProductRepo.setArchived(product.id, true);

      await MovementRepo.undoMovement(sale.id, user.id);

      expect(await stock()).toBe(10);
    });

    it('restocks a return and reports the product as archived', async () => {
      const reservation = await ReservationRepo.createReservation({ variantId: variant.id, quantity: 2 }, user.id);
      await ReservationRepo.transitionState(reservation.id, 'ship', user.id);
      await ReservationRepo.transitionState(reservation.id, 'deliver', user.id);
      await ProductRepo.setArchived(product.id, true);

      const returned = await ReservationRepo.transitionState(reservation.id, 'return', user.id, { restock: true });

      expect(await stock()).toBe(10);
      expect(returned.variant.product.isArchived).toBe(true);
      expect(await isArchived()).toBe(true);
    });
  });

  describe('createManualBatch', () => {
    const header = { totalCost: 0, estimatedQty: 0 };
    const newVariantBatch = (productName: string) => ({
      header,
      variantMode: 'NEW' as const,
      variant: { productName, price: 100 },
      tally: { good: 5, stained: 0, damaged: 0 },
    });

    it('restores an archived product with a matching name, ignoring case', async () => {
      await ProductRepo.setArchived(product.id, true);

      const batch = await BatchRepo.createManualBatch(newVariantBatch('ribbed tank TOP'), user.id);

      expect(batch.restoredProductName).toBe('Ribbed Tank Top');
      expect(await isArchived()).toBe(false);
      expect(batch.movements[0].variant.productId).toBe(product.id);
      expect(await db.product.count({ where: { name: { equals: 'ribbed tank top', mode: 'insensitive' } } })).toBe(1);
    });

    it('prefers an active product over an archived one with the same name', async () => {
      await ProductRepo.setArchived(product.id, true);
      const current = await db.product.create({ data: { name: 'Ribbed Tank Top' } });

      const batch = await BatchRepo.createManualBatch(newVariantBatch('Ribbed Tank Top'), user.id);

      expect(batch.restoredProductName).toBeNull();
      expect(batch.movements[0].variant.productId).toBe(current.id);
      expect(await isArchived()).toBe(true);
    });

    it('restores the product when stock goes to one of its existing variants', async () => {
      await ProductRepo.setArchived(product.id, true);

      const batch = await BatchRepo.createManualBatch(
        {
          header,
          variantMode: 'EXISTING',
          variant: { existingId: variant.id },
          tally: { good: 5, stained: 0, damaged: 0 },
        },
        user.id
      );

      expect(batch.restoredProductName).toBe('Ribbed Tank Top');
      expect(await isArchived()).toBe(false);
      expect(await stock()).toBe(15);
    });

    it('reports nothing restored for an active product', async () => {
      const batch = await BatchRepo.createManualBatch(newVariantBatch('Ribbed Tank Top'), user.id);

      expect(batch.restoredProductName).toBeNull();
    });
  });

  describe('dashboard', () => {
    it('drops archived products from alerts and counts but keeps their inventory value', async () => {
      await db.productVariant.update({ where: { id: variant.id }, data: { currentStock: 1 } });

      const before = await DashboardRepo.getDashboardStats();
      expect(before.lowStockItems.map((item) => item.variantId)).toEqual([variant.id]);
      expect(before.stats.lowStockCount).toBe(1);
      expect(before.stats.totalProducts).toBe(1);
      expect(before.stats.totalVariants).toBe(1);
      expect(before.stats.topPerformers).toHaveLength(1);

      await ProductRepo.setArchived(product.id, true);

      const after = await DashboardRepo.getDashboardStats();
      expect(after.lowStockItems).toEqual([]);
      expect(after.stats.lowStockCount).toBe(0);
      expect(after.stats.totalProducts).toBe(0);
      expect(after.stats.totalVariants).toBe(0);
      expect(after.stats.topPerformers).toEqual([]);
      expect(after.stats.marginDistribution.every((bucket) => bucket.count === 0)).toBe(true);
      expect(after.stats.totalInventoryCost).toBe(before.stats.totalInventoryCost);
      expect(after.stats.totalInventoryCost).toBe(50);
    });

    it('drops archived products from slow-moving items', async () => {
      const before = await DashboardRepo.getDashboardStats();
      expect(before.stats.slowMovingItems.map((item) => item.id)).toEqual([variant.id]);

      await ProductRepo.setArchived(product.id, true);

      const after = await DashboardRepo.getDashboardStats();
      expect(after.stats.slowMovingItems).toEqual([]);
    });
  });

  describe('deleting', () => {
    it('blocks a product whose only history is a reservation', async () => {
      await ReservationRepo.createReservation({ variantId: variant.id, quantity: 1 }, user.id);

      await expect(ProductRepo.deleteProduct(product.id)).rejects.toMatchObject({ statusCode: 409 });
    });

    it('still deletes a product with no history', async () => {
      await ProductRepo.deleteProduct(product.id);

      expect(await db.product.findUnique({ where: { id: product.id } })).toBeNull();
    });
  });

  describe('deleting a category', () => {
    it('says when archived products are part of what locks it', async () => {
      const category = await db.category.create({ data: { name: 'Ukay-ukay' } });
      await db.product.update({ where: { id: product.id }, data: { categoryId: category.id } });
      await db.product.create({ data: { name: 'Polo', categoryId: category.id } });
      await ProductRepo.setArchived(product.id, true);

      await expect(CategoryRepo.deleteCategory(category.id)).rejects.toMatchObject({
        statusCode: 409,
        message: 'Cannot delete category: used by 2 products, including 1 archived',
      });
    });
  });
});
