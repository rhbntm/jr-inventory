import { describe, it, expect } from 'vitest';
import { addDays, businessDateKey, startOfBusinessDay } from '@/lib/time';

describe('business time helpers (Asia/Manila, UTC+8)', () => {
  it('treats 16:00 UTC as the start of the next Manila day', () => {
    // 2026-10-19 16:00 UTC is 2026-10-20 00:00 in Manila
    const instant = new Date('2026-10-19T16:00:00Z');
    expect(businessDateKey(instant)).toBe('2026-10-20');
    expect(startOfBusinessDay(instant).toISOString()).toBe('2026-10-19T16:00:00.000Z');
  });

  it('keeps 15:59 UTC on the same Manila day', () => {
    const instant = new Date('2026-10-19T15:59:59Z');
    expect(businessDateKey(instant)).toBe('2026-10-19');
    expect(startOfBusinessDay(instant).toISOString()).toBe('2026-10-18T16:00:00.000Z');
  });

  it('puts UTC midnight at 8 AM of the same Manila day', () => {
    const instant = new Date('2026-10-19T00:00:00Z');
    expect(businessDateKey(instant)).toBe('2026-10-19');
    expect(startOfBusinessDay(instant).toISOString()).toBe('2026-10-18T16:00:00.000Z');
  });

  it('addDays shifts by whole days', () => {
    const start = new Date('2026-10-18T16:00:00Z');
    expect(addDays(start, -6).toISOString()).toBe('2026-10-12T16:00:00.000Z');
    expect(businessDateKey(addDays(start, 1))).toBe('2026-10-20');
  });
});
