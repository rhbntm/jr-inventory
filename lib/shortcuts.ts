/** The phone bar fits three shortcuts next to More, which is always there. */
export const MAX_SHORTCUTS = 3;

export const DEFAULT_SHORTCUTS = ["/dashboard", "/live", "/reservations"];

/** Reads saved shortcuts, ignoring anything stale or broken so the bar always has items. */
export function parseShortcuts(saved: string | null, allowed: string[]): string[] {
  if (!saved) return DEFAULT_SHORTCUTS;
  try {
    const parsed: unknown = JSON.parse(saved);
    if (!Array.isArray(parsed)) return DEFAULT_SHORTCUTS;
    const valid = Array.from(new Set(parsed)).filter(
      (href): href is string => typeof href === "string" && allowed.includes(href)
    );
    return valid.length > 0 ? valid.slice(0, MAX_SHORTCUTS) : DEFAULT_SHORTCUTS;
  } catch {
    return DEFAULT_SHORTCUTS;
  }
}

/** Adds to the end or removes. Keeps at least one, and never goes over the limit. */
export function toggleShortcut(current: string[], href: string): string[] {
  if (current.includes(href)) {
    return current.length > 1 ? current.filter((item) => item !== href) : current;
  }
  return current.length < MAX_SHORTCUTS ? [...current, href] : current;
}
