import { describe, it, expect } from 'vitest';
import {
  FOLLOW_UP_AFTER_DAYS,
  daysSince,
  endOfDayParam,
  needsFollowUp,
  startOfDayParam,
  waitingLabel,
} from '@/lib/reservations';

describe('daysSince', () => {
  const now = new Date('2026-10-31T12:00:00Z');

  it('counts whole days', () => {
    expect(daysSince('2026-10-31T01:00:00Z', now)).toBe(0);
    expect(daysSince('2026-10-30T12:00:00Z', now)).toBe(1);
    expect(daysSince('2026-10-27T11:00:00Z', now)).toBe(4);
  });

  it('never goes negative when a clock runs ahead', () => {
    expect(daysSince('2026-11-01T00:00:00Z', now)).toBe(0);
  });
});

describe('waitingLabel', () => {
  it('reads naturally', () => {
    expect(waitingLabel(0)).toBe('Today');
    expect(waitingLabel(1)).toBe('1 day');
    expect(waitingLabel(4)).toBe('4 days');
  });
});

describe('needsFollowUp', () => {
  it('flags only reservations that have waited too long to ship', () => {
    expect(needsFollowUp('RESERVED', FOLLOW_UP_AFTER_DAYS)).toBe(true);
    expect(needsFollowUp('RESERVED', FOLLOW_UP_AFTER_DAYS - 1)).toBe(false);
    expect(needsFollowUp('SHIPPING', FOLLOW_UP_AFTER_DAYS + 5)).toBe(false);
  });
});

describe('date filter params', () => {
  it('covers the whole Manila day', () => {
    expect(new Date(startOfDayParam('2026-10-31')!).toISOString()).toBe('2026-10-30T16:00:00.000Z');
    expect(new Date(endOfDayParam('2026-10-31')!).toISOString()).toBe('2026-10-31T15:59:59.999Z');
  });

  it('sends nothing for an empty input', () => {
    expect(startOfDayParam('')).toBeUndefined();
    expect(endOfDayParam('')).toBeUndefined();
  });
});
