import { describe, it, expect } from 'vitest';
import {
  archivedBlockReason,
  archivedRestockNotice,
  describeStock,
  isVariantArchived,
  reservedBlockMessage,
  summarizeStock,
} from '@/lib/archive';

const active = { isArchived: false, product: { isArchived: false, name: 'Tee' } };

describe('isVariantArchived', () => {
  it('is true when either the variant or its product is archived', () => {
    expect(isVariantArchived(active)).toBe(false);
    expect(isVariantArchived({ ...active, isArchived: true })).toBe(true);
    expect(isVariantArchived({ ...active, product: { isArchived: true } })).toBe(true);
  });
});

describe('archivedBlockReason', () => {
  it('allows active variants', () => {
    expect(archivedBlockReason(active, 'sell')).toBeNull();
  });

  it('tells the seller to restore an archived product', () => {
    expect(archivedBlockReason({ isArchived: false, product: { isArchived: true } }, 'sell')).toBe(
      'This product was archived. Restore it to sell it.'
    );
  });

  it('points at the variant when only the variant is archived', () => {
    expect(archivedBlockReason({ ...active, isArchived: true }, 'reserve')).toBe(
      'This variant was archived. Unarchive it to reserve it.'
    );
  });
});

describe('summarizeStock', () => {
  it('totals each bucket and values only good stock at cost', () => {
    const summary = summarizeStock([
      // The API sends Decimal columns as strings.
      { currentStock: 10, reservedStock: 2, stainedStock: 3, damagedStock: 0, costPrice: '150.50' },
      { currentStock: 2, reservedStock: 0, stainedStock: 0, damagedStock: 1, costPrice: 100 },
    ]);

    expect(summary).toEqual({ good: 12, reserved: 2, stained: 3, damaged: 1, goodValueAtCost: 1705 });
  });
});

describe('describeStock', () => {
  const none = { good: 0, reserved: 0, stained: 0, damaged: 0, goodValueAtCost: 0 };

  it('lists only the buckets holding units', () => {
    expect(describeStock({ ...none, good: 12, damaged: 1 })).toBe('12 good, 1 damaged');
  });

  it('returns null when nothing is on hand', () => {
    expect(describeStock(none)).toBeNull();
  });
});

describe('reservedBlockMessage', () => {
  it('matches the count', () => {
    expect(reservedBlockMessage(1)).toBe('1 unit is held for customers. Ship, release or cancel them first.');
    expect(reservedBlockMessage(2)).toBe('2 units are held for customers. Ship, release or cancel them first.');
  });
});

describe('archivedRestockNotice', () => {
  const archived = (name: string) => ({ variant: { isArchived: false, product: { isArchived: true, name } } });

  it('stays quiet when all the stock landed on active products', () => {
    expect(archivedRestockNotice([{ variant: active }])).toBeNull();
  });

  it('names each archived product once', () => {
    expect(archivedRestockNotice([{ variant: active }, archived('Polo'), archived('Polo')])).toBe(
      'Restocked, but Polo is archived. Restore to sell these.'
    );
    expect(archivedRestockNotice([archived('Polo'), archived('Tee')])).toBe(
      'Restocked, but Polo, Tee are archived. Restore to sell these.'
    );
  });
});
