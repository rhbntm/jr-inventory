import { describe, it, expect } from 'vitest';
import {
  describeAction,
  groupLiveVariants,
  parseLiveMode,
  searchVariants,
  sessionTotals,
  toLiveVariants,
  type LiveEntry,
  type LiveVariant,
} from '@/lib/live';
import type { ProductWithVariants } from '@/lib/types';

const product = {
  name: 'Oversized Cotton Tee',
  variants: [
    { id: 'a', size: 'M', color: 'Black', fabric: null, sku: 'TEE-BLK-M', currentStock: 5, reservedStock: 2, lowStockAt: 5, price: '299', salePrice: '249', isArchived: false },
    { id: 'b', size: 'L', color: 'White', fabric: null, sku: null, currentStock: 1, reservedStock: 0, lowStockAt: 5, price: '299', salePrice: null, isArchived: false },
    { id: 'c', size: 'XL', color: 'Red', fabric: null, sku: null, currentStock: 9, reservedStock: 0, lowStockAt: 5, price: '299', salePrice: null, isArchived: true },
  ],
} as unknown as ProductWithVariants;

describe('groupLiveVariants', () => {
  const variant = (productId: string, name: string, available: number) =>
    ({ id: `${productId}-${available}`, productId, product: name, available }) as LiveVariant;

  it('groups variants under their product, by name', () => {
    const groups = groupLiveVariants([
      variant('t', 'tee', 1),
      variant('c', 'Croptop', 2),
      variant('t', 'tee', 3),
    ]);

    expect(groups.map((g) => [g.product, g.variants.length])).toEqual([['Croptop', 1], ['tee', 2]]);
  });

  it('totals what can be sold', () => {
    const [group] = groupLiveVariants([variant('c', 'Croptop', 2), variant('c', 'Croptop', 3)]);

    expect(group.available).toBe(5);
  });

  it('does not let an over-reserved variant reduce the total', () => {
    const [group] = groupLiveVariants([variant('c', 'Croptop', -2), variant('c', 'Croptop', 3)]);

    expect(group.available).toBe(3);
  });
});

describe('toLiveVariants', () => {
  const variants = toLiveVariants([product]);

  it('leaves out archived variants', () => {
    expect(variants.map((v) => v.id)).toEqual(['a', 'b']);
  });

  it('subtracts reserved units from what is available', () => {
    expect(variants[0].available).toBe(3);
  });

  it('uses the sale price as the usual price when there is one', () => {
    expect(variants[0].usualPrice).toBe(249);
    expect(variants[1].usualPrice).toBe(299);
  });
});

describe('searchVariants', () => {
  const variants = toLiveVariants([product]);

  it('matches every word in any order', () => {
    expect(searchVariants(variants, 'black tee').map((v) => v.id)).toEqual(['a']);
  });

  it('finds SKUs regardless of case', () => {
    expect(searchVariants(variants, 'tee-blk').map((v) => v.id)).toEqual(['a']);
  });

  it('returns everything for an empty search', () => {
    expect(searchVariants(variants, '  ')).toHaveLength(2);
  });

  it('returns nothing when one word does not match', () => {
    expect(searchVariants(variants, 'tee purple')).toEqual([]);
  });
});

describe('describeAction', () => {
  const inStock = { available: 3, reserved: 2 };

  it('spells out what selling will do', () => {
    expect(describeAction('sell', inStock, 2, 249)).toEqual({ label: 'Sell 2 for ₱498', blocked: false });
  });

  it('blocks selling more than is available before anything is submitted', () => {
    expect(describeAction('sell', inStock, 4, 249)).toEqual({ label: 'Only 3 available', blocked: true });
    expect(describeAction('reserve', inStock, 4, 249).blocked).toBe(true);
  });

  it('explains when everything left is held for reservations', () => {
    expect(describeAction('sell', { available: 0, reserved: 1 }, 1, 249)).toEqual({
      label: 'None available, 1 reserved',
      blocked: true,
    });
  });

  it('calls it sold out when nothing is held either', () => {
    expect(describeAction('sell', { available: 0, reserved: 0 }, 1, 249).label).toBe('Sold out');
  });

  it('lets stock in go ahead whatever is on hand', () => {
    expect(describeAction('stockin', { available: 0, reserved: 0 }, 12, 0)).toEqual({
      label: 'Add 12 to stock',
      blocked: false,
    });
  });
});

describe('parseLiveMode', () => {
  it('defaults to selling for anything unknown', () => {
    expect(parseLiveMode(null)).toBe('sell');
    expect(parseLiveMode('nonsense')).toBe('sell');
    expect(parseLiveMode('reserve')).toBe('reserve');
    expect(parseLiveMode('stockin')).toBe('stockin');
  });
});

describe('sessionTotals', () => {
  it('only counts sales', () => {
    const entry = (mode: LiveEntry['mode'], quantity: number, unitPrice: number): LiveEntry => ({
      recordId: mode,
      mode,
      product: 'Tee',
      label: 'M',
      quantity,
      unitPrice,
      customer: null,
      at: '2026-10-31T00:00:00Z',
    });
    expect(sessionTotals([entry('sell', 2, 249), entry('reserve', 1, 299), entry('stockin', 5, 0)])).toEqual({
      units: 2,
      revenue: 498,
    });
  });
});
