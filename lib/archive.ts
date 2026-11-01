type ArchivableVariant = {
  isArchived: boolean;
  product: { isArchived: boolean };
};

/** Hidden from day-to-day work when either the variant or its product is archived. */
export function isVariantArchived(variant: ArchivableVariant): boolean {
  return variant.isArchived || variant.product.isArchived;
}

/**
 * Why new activity can't be recorded against this variant, or null if it can. Live only
 * refreshes every 30 seconds, so a stale screen can still offer an archived item.
 */
export function archivedBlockReason(
  variant: ArchivableVariant,
  action: "sell" | "reserve" | "add stock to"
): string | null {
  if (variant.product.isArchived) {
    return `This product was archived. Restore it to ${action} it.`;
  }
  if (variant.isArchived) {
    return `This variant was archived. Unarchive it to ${action} it.`;
  }
  return null;
}

type StockVariant = {
  currentStock: number;
  reservedStock: number;
  stainedStock: number;
  damagedStock: number;
  costPrice: unknown;
};

export type StockSummary = {
  good: number;
  reserved: number;
  stained: number;
  damaged: number;
  /** Good stock at cost: what inventory value keeps counting after archiving. */
  goodValueAtCost: number;
};

export function summarizeStock(variants: StockVariant[]): StockSummary {
  return variants.reduce<StockSummary>(
    (sum, variant) => ({
      good: sum.good + variant.currentStock,
      reserved: sum.reserved + variant.reservedStock,
      stained: sum.stained + variant.stainedStock,
      damaged: sum.damaged + variant.damagedStock,
      goodValueAtCost: sum.goodValueAtCost + variant.currentStock * (Number(variant.costPrice) || 0),
    }),
    { good: 0, reserved: 0, stained: 0, damaged: 0, goodValueAtCost: 0 }
  );
}

/** "12 good, 3 stained", or null when there's nothing physically on hand. */
export function describeStock({ good, stained, damaged }: StockSummary): string | null {
  const parts = [
    good > 0 && `${good} good`,
    stained > 0 && `${stained} stained`,
    damaged > 0 && `${damaged} damaged`,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : null;
}

export function reservedBlockMessage(reserved: number): string {
  const units = reserved === 1 ? "1 unit is" : `${reserved} units are`;
  return `${units} held for customers. Ship, release or cancel them first.`;
}

/** For a batch that just added stock: warns if any of it landed somewhere hidden. */
export function archivedRestockNotice(
  movements: Array<{ variant: ArchivableVariant & { product: { name: string } } }>
): string | null {
  const names = Array.from(
    new Set(
      movements
        .filter((movement) => isVariantArchived(movement.variant))
        .map((movement) => movement.variant.product.name)
    )
  );
  if (names.length === 0) return null;
  return `Restocked, but ${names.join(", ")} ${names.length === 1 ? "is" : "are"} archived. Restore to sell these.`;
}
