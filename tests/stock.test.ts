import { describe, it, expect } from 'vitest';
import { searchStockProducts, stockStatusLabel, toStockProducts } from '@/lib/stock';
import type { ProductWithVariants } from '@/lib/types';

const variant = (overrides: Record<string, unknown>) => ({
  sku: null,
  size: null,
  color: null,
  fabric: null,
  currentStock: 10,
  reservedStock: 0,
  stainedStock: 0,
  damagedStock: 0,
  lowStockAt: 5,
  isArchived: false,
  ...overrides,
});

const products = [
  {
    id: 'tee',
    name: 'tee',
    variants: [variant({ id: 't1', size: 'M', color: 'White', sku: 'TEE-WHT-M' })],
  },
  {
    id: 'crop',
    name: 'Croptop',
    variants: [
      variant({ id: 'c1', size: 'S', color: 'Black', sku: 'CROP-BLK-S', reservedStock: 2 }),
      variant({ id: 'c2', size: 'M', color: 'White', sku: 'CROP-WHT-M', stainedStock: 3, damagedStock: 1 }),
      variant({ id: 'c3', size: 'L', color: 'Black', sku: 'CROP-BLK-L' }),
      variant({ id: 'c4', size: 'XL', color: 'Red', currentStock: 99, isArchived: true }),
    ],
  },
  { id: 'empty', name: 'Empty Product', variants: [] },
] as unknown as ProductWithVariants[];

const rows = toStockProducts(products);
const crop = rows.find((product) => product.id === 'crop')!;

describe('toStockProducts', () => {
  it('lists every product by name, ignoring case', () => {
    expect(rows.map((product) => product.name)).toEqual(['Croptop', 'Empty Product', 'tee']);
  });

  it('totals on-hand stock across variants', () => {
    expect(crop.onHand).toBe(30);
  });

  it('breaks the total down by variant', () => {
    expect(crop.variants.map((v) => [v.sku, v.color, v.size, v.onHand])).toEqual([
      ['CROP-BLK-S', 'Black', 'S', 10],
      ['CROP-WHT-M', 'White', 'M', 10],
      ['CROP-BLK-L', 'Black', 'L', 10],
    ]);
  });

  it('leaves archived variants out of the list and the total', () => {
    expect(crop.variants.map((v) => v.id)).not.toContain('c4');
  });

  it('keeps reserved units in on-hand stock and shows what is left to sell', () => {
    expect(crop.reserved).toBe(2);
    expect(crop.variants[0]).toMatchObject({ onHand: 10, reserved: 2, available: 8 });
  });

  it('keeps stained and damaged units out of on-hand stock', () => {
    expect(crop.variants[1]).toMatchObject({ onHand: 10, stained: 3, damaged: 1 });
  });

  it('still lists a product with no variants, at zero', () => {
    expect(rows.find((product) => product.id === 'empty')).toMatchObject({ onHand: 0, variants: [] });
  });

  it.each([
    [{ currentStock: 6 }, 'ok'],
    [{ currentStock: 5 }, 'low'],
    [{ currentStock: 7, reservedStock: 2 }, 'low'],
    [{ currentStock: 0 }, 'out'],
    [{ currentStock: 2, reservedStock: 2 }, 'out'],
  ])('rates %o as %s', (stock, status) => {
    const [row] = toStockProducts([
      { id: 'p', name: 'P', variants: [variant({ id: 'v', ...stock })] },
    ] as unknown as ProductWithVariants[]);

    expect(row.variants[0].status).toBe(status);
  });
});

describe('searchStockProducts', () => {
  const ids = (query: string) => searchStockProducts(rows, query).map((product) => product.id);

  it('shows everything when the search is empty', () => {
    expect(ids('   ')).toEqual(['crop', 'empty', 'tee']);
  });

  it('matches the product name', () => {
    expect(ids('CROP')).toEqual(['crop']);
    expect(ids('empty')).toEqual(['empty']);
  });

  it('matches a SKU, size or color', () => {
    expect(ids('tee-wht')).toEqual(['tee']);
    expect(ids('black')).toEqual(['crop']);
  });

  it('needs all the words on one variant', () => {
    expect(ids('black s')).toEqual(['crop']);
    expect(ids('black xl')).toEqual([]);
    expect(ids('white s')).toEqual([]);
  });

  it('ignores archived variants', () => {
    expect(ids('red')).toEqual([]);
  });
});

describe('stockStatusLabel', () => {
  it('explains each highlighted status', () => {
    expect(stockStatusLabel({ status: 'ok', reserved: 0 })).toBeNull();
    expect(stockStatusLabel({ status: 'low', reserved: 0 })).toBe('Running low');
    expect(stockStatusLabel({ status: 'out', reserved: 0 })).toBe('Sold out');
    expect(stockStatusLabel({ status: 'out', reserved: 2 })).toBe('All reserved');
  });
});
