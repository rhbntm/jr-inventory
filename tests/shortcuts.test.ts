import { describe, it, expect } from 'vitest';
import { DEFAULT_SHORTCUTS, MAX_SHORTCUTS, parseShortcuts, toggleShortcut } from '@/lib/shortcuts';

const allowed = ['/dashboard', '/live', '/reservations', '/products', '/inventory'];

describe('parseShortcuts', () => {
  it('uses the defaults when nothing is saved', () => {
    expect(parseShortcuts(null, allowed)).toEqual(DEFAULT_SHORTCUTS);
  });

  it('keeps the saved order', () => {
    expect(parseShortcuts('["/products","/live"]', allowed)).toEqual(['/products', '/live']);
  });

  it('drops pages that no longer exist and repeats', () => {
    expect(parseShortcuts('["/gone","/live","/live"]', allowed)).toEqual(['/live']);
  });

  it('never goes over the limit', () => {
    expect(parseShortcuts(JSON.stringify(allowed), allowed)).toHaveLength(MAX_SHORTCUTS);
  });

  it.each(['not json', '{"a":1}', '[]', '[1,2]', '["/gone"]', 'null'])('falls back to the defaults for %s', (saved) => {
    expect(parseShortcuts(saved, allowed)).toEqual(DEFAULT_SHORTCUTS);
  });
});

describe('toggleShortcut', () => {
  it('adds to the end when there is room', () => {
    expect(toggleShortcut(['/live'], '/products')).toEqual(['/live', '/products']);
  });

  it('removes one already chosen', () => {
    expect(toggleShortcut(['/live', '/products'], '/live')).toEqual(['/products']);
  });

  it('keeps at least one', () => {
    expect(toggleShortcut(['/live'], '/live')).toEqual(['/live']);
  });

  it('adds nothing when full', () => {
    const full = ['/dashboard', '/live', '/reservations'];
    expect(toggleShortcut(full, '/products')).toEqual(full);
  });
});
