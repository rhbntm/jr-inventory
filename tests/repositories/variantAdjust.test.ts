import { describe, it, expect, beforeEach } from 'vitest';
import { VariantRepo } from '@/app/repositories/variantRepo';
import { MovementRepo } from '@/app/repositories/movementRepo';
import { DashboardRepo } from '@/app/repositories/dashboardRepo';
import { conditionAdjustSchema } from '@/lib/schemas';
import { db } from '@/lib/db';

describe('VariantRepo.adjustConditionStock (Integration)', () => {
  let userId: string;
  let variantId: string;

  const current = () => db.productVariant.findUniqueOrThrow({ where: { id: variantId } });
  const movements = () =>
    db.stockMovement.findMany({ where: { variantId }, orderBy: { createdAt: 'asc' } });

  beforeEach(async () => {
    userId = (await db.user.create({ data: { email: 'adjust@example.com', name: 'Adjuster', role: 'OWNER' } })).id;
    const product = await db.product.create({ data: { name: 'Adjust Product' } });
    variantId = (
      await db.productVariant.create({
        data: { productId: product.id, costPrice: 50, price: 100, currentStock: 10, reservedStock: 2 },
      })
    ).id;
  });

  it('adds stock and records the new level as an adjustment', async () => {
    await VariantRepo.adjustConditionStock(variantId, { stockChange: 3, toStained: 0, toDamaged: 0, note: 'Recount' }, userId);

    expect((await current()).currentStock).toBe(13);
    const [entry, ...rest] = await movements();
    expect(rest).toHaveLength(0);
    expect(entry).toMatchObject({ type: 'ADJUSTMENT', quantity: 13, userId });
    expect(entry.note).toBe('Stock adjustment: +3, now 13 — Recount');
  });

  it('removes stock', async () => {
    await VariantRepo.adjustConditionStock(variantId, { stockChange: -4, toStained: 0, toDamaged: 0 }, userId);

    expect((await current()).currentStock).toBe(6);
    expect((await movements())[0].note).toBe('Stock adjustment: -4, now 6');
  });

  it('can remove everything that is not reserved, but no more', async () => {
    await VariantRepo.adjustConditionStock(variantId, { stockChange: -8, toStained: 0, toDamaged: 0 }, userId);
    expect((await current()).currentStock).toBe(2);

    await expect(
      VariantRepo.adjustConditionStock(variantId, { stockChange: -1, toStained: 0, toDamaged: 0 }, userId)
    ).rejects.toMatchObject({ statusCode: 409 });
    expect((await current()).currentStock).toBe(2);
    expect(await movements()).toHaveLength(1);
  });

  it('does not count a correction as a sale or as received stock', async () => {
    await VariantRepo.adjustConditionStock(variantId, { stockChange: -5, toStained: 0, toDamaged: 0 }, userId);
    await VariantRepo.adjustConditionStock(variantId, { stockChange: 7, toStained: 0, toDamaged: 0 }, userId);

    const { stats } = await DashboardRepo.getDashboardStats();

    expect(stats.todayRevenue).toBe(0);
    expect(stats.todayMovementsOut).toBe(0);
    expect(stats.todayMovementsIn).toBe(0);
  });

  it('keeps a sale made while someone was counting', async () => {
    // Someone opened the dialog at 10 and counted 12. A sale of 3 lands before they save.
    await MovementRepo.createMovement({ variantId, type: 'OUT', quantity: 3 }, userId);
    await VariantRepo.adjustConditionStock(variantId, { stockChange: 2, toStained: 0, toDamaged: 0 }, userId);

    expect((await current()).currentStock).toBe(9);
  });

  it('applies simultaneous changes without losing any', async () => {
    await Promise.all(
      [1, 1, 1, -1, -1].map((stockChange) =>
        VariantRepo.adjustConditionStock(variantId, { stockChange, toStained: 0, toDamaged: 0 }, userId)
      )
    );

    expect((await current()).currentStock).toBe(11);
  });

  it('still moves good units to stained and damaged', async () => {
    await VariantRepo.adjustConditionStock(variantId, { toStained: 2, toDamaged: 1, note: 'Rain' }, userId);

    expect(await current()).toMatchObject({ currentStock: 7, stainedStock: 2, damagedStock: 1 });
    const [entry] = await movements();
    expect(entry).toMatchObject({ type: 'ADJUSTMENT', quantity: 3 });
    expect(entry.note).toBe('Condition adjustment: 2 → Stained, 1 → Damaged — Rain');
  });

  it('refuses to move units that are reserved', async () => {
    await expect(
      VariantRepo.adjustConditionStock(variantId, { toStained: 9, toDamaged: 0 }, userId)
    ).rejects.toMatchObject({ statusCode: 409 });

    expect(await current()).toMatchObject({ currentStock: 10, stainedStock: 0 });
  });

  it('can correct and move in one save, with an audit entry for each', async () => {
    await VariantRepo.adjustConditionStock(variantId, { stockChange: 5, toStained: 0, toDamaged: 13 }, userId);

    expect(await current()).toMatchObject({ currentStock: 2, damagedStock: 13 });
    const notes = (await movements()).map((m) => m.note).sort();
    expect(notes).toEqual(['Condition adjustment: 13 → Damaged', 'Stock adjustment: +5, now 15']);
  });

  it('rejects a save that changes nothing', async () => {
    await expect(
      VariantRepo.adjustConditionStock(variantId, { stockChange: 0, toStained: 0, toDamaged: 0 }, userId)
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('reports a variant that does not exist', async () => {
    await expect(
      VariantRepo.adjustConditionStock('missing', { stockChange: 1, toStained: 0, toDamaged: 0 }, userId)
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('conditionAdjustSchema', () => {
  it('accepts a negative stock change with no transfer', () => {
    expect(conditionAdjustSchema.safeParse({ stockChange: -3 }).success).toBe(true);
  });

  it('rejects a request that changes nothing', () => {
    expect(conditionAdjustSchema.safeParse({ stockChange: 0, toStained: 0, toDamaged: 0 }).success).toBe(false);
  });

  it('rejects fractions and negative transfers', () => {
    expect(conditionAdjustSchema.safeParse({ stockChange: 1.5 }).success).toBe(false);
    expect(conditionAdjustSchema.safeParse({ toStained: -1 }).success).toBe(false);
  });
});
