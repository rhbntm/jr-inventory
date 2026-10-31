import type { ProductWithVariants } from "./types";

export type LiveMode = "sell" | "reserve" | "stockin";

export const LIVE_MODES: { id: LiveMode; label: string }[] = [
  { id: "sell", label: "Sell" },
  { id: "reserve", label: "Reserve" },
  { id: "stockin", label: "Stock in" },
];

export function parseLiveMode(value: string | null): LiveMode {
  return value === "reserve" || value === "stockin" ? value : "sell";
}

export type LiveVariant = {
  id: string;
  productId: string;
  product: string;
  size: string | null;
  color: string | null;
  fabric: string | null;
  sku: string | null;
  onHand: number;
  reserved: number;
  available: number;
  lowStockAt: number;
  price: number;
  salePrice: number | null;
  /** What a sale charges unless the seller changes it. */
  usualPrice: number;
  /** Size, color and fabric, for telling variants of a product apart. */
  label: string;
  searchText: string;
};

export function toLiveVariants(products: ProductWithVariants[]): LiveVariant[] {
  return products.flatMap((product) =>
    product.variants
      .filter((variant) => !variant.isArchived)
      .map((variant) => {
        const price = Number(variant.price);
        const salePrice = variant.salePrice === null ? null : Number(variant.salePrice);
        const parts = [variant.size, variant.color, variant.fabric].filter(Boolean);
        return {
          id: variant.id,
          productId: product.id,
          product: product.name,
          size: variant.size,
          color: variant.color,
          fabric: variant.fabric,
          sku: variant.sku,
          onHand: variant.currentStock,
          reserved: variant.reservedStock,
          available: variant.currentStock - variant.reservedStock,
          lowStockAt: variant.lowStockAt,
          price,
          salePrice,
          usualPrice: salePrice ?? price,
          label: parts.join(", ") || variant.sku || "Standard",
          searchText: [product.name, variant.sku, ...parts].filter(Boolean).join(" ").toLowerCase(),
        };
      })
  );
}

/** Every word typed has to appear, in any order: "tee black m". */
export function searchVariants(variants: LiveVariant[], query: string): LiveVariant[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return variants.filter((variant) => words.every((word) => variant.searchText.includes(word)));
}

export function peso(amount: number): string {
  return `₱${amount.toLocaleString("en-PH", { maximumFractionDigits: 2 })}`;
}

/** Sold items can't take from units held for reservations; stock in has no ceiling. */
export function describeAction(
  mode: LiveMode,
  variant: Pick<LiveVariant, "available" | "reserved">,
  quantity: number,
  unitPrice: number
): { label: string; blocked: boolean } {
  if (mode === "stockin") {
    return { label: `Add ${quantity} to stock`, blocked: quantity < 1 };
  }
  if (variant.available <= 0) {
    return {
      label: variant.reserved > 0 ? `None available, ${variant.reserved} reserved` : "Sold out",
      blocked: true,
    };
  }
  if (quantity > variant.available) {
    return { label: `Only ${variant.available} available`, blocked: true };
  }
  const verb = mode === "sell" ? "Sell" : "Reserve";
  return {
    label: `${verb} ${quantity} for ${peso(quantity * unitPrice)}`,
    blocked: quantity < 1 || unitPrice < 0,
  };
}

/** One thing recorded during this live session, kept so it can be undone. */
export type LiveEntry = {
  /** The stock movement or reservation this created. */
  recordId: string;
  mode: LiveMode;
  product: string;
  label: string;
  quantity: number;
  unitPrice: number;
  customer: string | null;
  at: string;
};

export function sessionTotals(entries: LiveEntry[]) {
  const sold = entries.filter((entry) => entry.mode === "sell");
  return {
    units: sold.reduce((sum, entry) => sum + entry.quantity, 0),
    revenue: sold.reduce((sum, entry) => sum + entry.quantity * entry.unitPrice, 0),
  };
}
