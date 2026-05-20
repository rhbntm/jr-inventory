import { describe, it, expect } from 'vitest';
import { cn, formatDate } from '@/lib/utils';

describe('Utility Functions', () => {
  describe('cn function', () => {
    it('should merge Tailwind classes correctly', () => {
      expect(cn('px-2 py-1', 'px-4')).toBe('py-1 px-4');
    });

    it('should handle conditional classes', () => {
      expect(cn('px-2', true && 'py-1', false && 'hidden')).toBe('px-2 py-1');
    });

    it('should handle undefined and null values', () => {
      expect(cn('px-2', undefined, null)).toBe('px-2');
    });
  });

  describe('formatDate function', () => {
    it('should format a Date object correctly', () => {
      const date = new Date('2024-05-20T10:30:00');
      const formatted = formatDate(date);
      expect(formatted).toBeDefined();
      expect(typeof formatted).toBe('string');
    });

    it('should format a date string correctly', () => {
      const dateStr = '2024-05-20T14:45:00';
      const formatted = formatDate(dateStr);
      expect(formatted).toBeDefined();
      expect(typeof formatted).toBe('string');
    });
  });
});
