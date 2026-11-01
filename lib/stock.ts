import type { ProductWithVariants } from "./types";

export type StockStatus = "ok" | "low" | "out";

export type StockVariant = {
  id: string;
  sku: string | null;
  color: string | null;
  size: string | null;
  fabric: string | null;
  onHand: number;
  reserved: number;
  available: number;
  stained: number;
  damaged: number;
  status: StockStatus;
  searchText: string;
};

export type StockProduct = {
  id: string;
  name: string;
  /** Good units physically on hand. Stained and damaged units are counted separately. */
  onHand: number;
  reserved: number;
  variants: StockVariant[];
};

/** Same rule as Live and the low-stock list: judged on what can still be sold. */
function statusOf(available: number, lowStockAt: number): StockStatus {
  if (available <= 0) return "out";
  return available <= lowStockAt ? "low" : "ok";
}

export function toStockProducts(products: ProductWithVariants[]): StockProduct[] {
  return products
    .map((product) => {
      const variants = product.variants
        .filter((variant) => !variant.isArchived)
        .map((variant): StockVariant => {
          const available = variant.currentStock - variant.reservedStock;
          return {
            id: variant.id,
            sku: variant.sku,
            color: variant.color,
            size: variant.size,
            fabric: variant.fabric,
            onHand: variant.currentStock,
            reserved: variant.reservedStock,
            available,
            stained: variant.stainedStock,
            damaged: variant.damagedStock,
            status: statusOf(available, variant.lowStockAt),
            searchText: [product.name, variant.sku, variant.size, variant.color, variant.fabric]
              .filter(Boolean)
              .join(" ")
              .toLowerCase(),
          };
        });

      return {
        id: product.id,
        name: product.name,
        onHand: variants.reduce((sum, variant) => sum + variant.onHand, 0),
        reserved: variants.reduce((sum, variant) => sum + variant.reserved, 0),
        variants,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));
}

/**
 * Every word typed has to appear on one variant, in any order, so "black m" won't match a
 * product that only has black in L and white in M.
 */
export function searchStockProducts(products: StockProduct[], query: string): StockProduct[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return products;

  return products.filter((product) => {
    const texts = product.variants.length > 0
      ? product.variants.map((variant) => variant.searchText)
      : [product.name.toLowerCase()];
    return texts.some((text) => words.every((word) => text.includes(word)));
  });
}

/** Why a variant's number is highlighted, so it isn't told by color alone. */
export function stockStatusLabel(variant: Pick<StockVariant, "status" | "reserved">): string | null {
  if (variant.status === "low") return "Running low";
  if (variant.status === "out") return variant.reserved > 0 ? "All reserved" : "Sold out";
  return null;
}
