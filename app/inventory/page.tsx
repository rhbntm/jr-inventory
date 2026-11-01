"use client";

import { useDeferredValue, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { useAllProducts } from "@/lib/hooks";
import {
  searchStockProducts,
  stockStatusLabel,
  toStockProducts,
  type StockProduct,
  type StockVariant,
} from "@/lib/stock";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

const plural = (count: number, noun: string) => `${count} ${noun}${count === 1 ? "" : "s"}`;

function productSummary(product: StockProduct) {
  if (product.variants.length === 0) return "No variants yet";
  const parts = [plural(product.variants.length, "variant")];
  if (product.reserved > 0) parts.push(`${product.reserved} reserved`);
  return parts.join(" · ");
}

function VariantStock({ variant }: { variant: StockVariant }) {
  const statusLabel = stockStatusLabel(variant);
  const notes = [
    statusLabel,
    // "All reserved" already covers the case where nothing is left to sell.
    variant.reserved > 0 && variant.available > 0 && `${variant.reserved} reserved, ${variant.available} left to sell`,
    variant.stained > 0 && `${variant.stained} stained`,
    variant.damaged > 0 && `${variant.damaged} damaged`,
  ].filter(Boolean);

  return (
    <>
      <div className={cn("text-lg font-bold tabular-nums", variant.status !== "ok" && "text-stock-out")}>
        {variant.onHand}
      </div>
      {notes.map((note) => (
        <div key={String(note)} className="text-xs font-normal text-muted-foreground">
          {note}
        </div>
      ))}
    </>
  );
}

function VariantBreakdown({ product }: { product: StockProduct }) {
  if (product.variants.length === 0) {
    return (
      <p className="text-muted-foreground">
        This product has no variants yet.{" "}
        <Link href={`/products/${product.id}`} className="font-medium text-stock-in hover:underline">
          Add one
        </Link>
      </p>
    );
  }

  const showFabric = product.variants.some((variant) => variant.fabric);

  return (
    <>
      <table className="w-full table-fixed text-sm">
        <caption className="sr-only">Stock for each variant of {product.name}</caption>
        <thead>
          <tr className="text-left text-xs text-muted-foreground">
            <th scope="col" className="w-[34%] pb-1.5 pr-2 font-medium">SKU</th>
            <th scope="col" className="pb-1.5 pr-2 font-medium">Color</th>
            <th scope="col" className="pb-1.5 pr-2 font-medium">Size</th>
            {showFabric && <th scope="col" className="pb-1.5 pr-2 font-medium max-sm:hidden">Fabric</th>}
            <th scope="col" className="w-[30%] pb-1.5 text-right font-medium">Stock</th>
          </tr>
        </thead>
        <tbody>
          {product.variants.map((variant) => (
            <tr key={variant.id} className="border-t align-top">
              <td className="py-2 pr-2 font-mono text-xs break-words text-muted-foreground">
                {variant.sku ?? "No SKU"}
              </td>
              <td className="py-2 pr-2 break-words">{variant.color ?? "—"}</td>
              <td className="py-2 pr-2 break-words">{variant.size ?? "—"}</td>
              {showFabric && <td className="py-2 pr-2 break-words max-sm:hidden">{variant.fabric ?? "—"}</td>}
              <td className="py-2 text-right">
                <VariantStock variant={variant} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <Link
        href={`/products/${product.id}`}
        className={cn("mt-1 inline-flex min-h-11 items-center font-medium text-stock-in hover:underline", focusRing)}
      >
        Open product
      </Link>
    </>
  );
}

function ProductRow({
  product,
  open,
  onToggle,
}: {
  product: StockProduct;
  open: boolean;
  onToggle: () => void;
}) {
  const panelId = `stock-${product.id}`;
  const soldOut = product.variants.length > 0 && product.onHand === 0;

  return (
    <li className="overflow-hidden rounded-[10px] border bg-card">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={onToggle}
        className={cn(
          "flex min-h-16 w-full cursor-pointer items-center gap-3 rounded-[10px] px-4 py-2.5 text-left hover:bg-background",
          focusRing
        )}
      >
        <ChevronDown
          aria-hidden="true"
          className={cn("size-5 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
        />
        <span className="min-w-0 flex-1">
          <span className="block font-semibold break-words">{product.name}</span>
          <span className="block text-[13px] text-muted-foreground">
            {soldOut ? `${productSummary(product)} · Sold out` : productSummary(product)}
          </span>
        </span>
        <span className="shrink-0 text-right">
          <span className={cn("block text-2xl leading-none font-bold tabular-nums", soldOut && "text-stock-out")}>
            {product.onHand}
          </span>
          <span className="mt-1 block text-xs text-muted-foreground">in stock</span>
        </span>
      </button>
      {open && (
        <div id={panelId} className="border-t px-4 pt-3 pb-1.5">
          <VariantBreakdown product={product} />
        </div>
      )}
    </li>
  );
}

export default function StockPage() {
  const { data, isLoading, isError, refetch } = useAllProducts({ refetchInterval: 30_000 });
  const [search, setSearch] = useState("");
  const [openIds, setOpenIds] = useState<Set<string>>(() => new Set());
  const deferredSearch = useDeferredValue(search);

  const products = useMemo(() => toStockProducts(data ?? []), [data]);
  const shown = useMemo(() => searchStockProducts(products, deferredSearch), [products, deferredSearch]);
  const totalUnits = shown.reduce((sum, product) => sum + product.onHand, 0);
  const searching = deferredSearch.trim() !== "";

  const toggle = (id: string) =>
    setOpenIds((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <header>
        <h1 className="text-[26px] leading-tight font-bold tracking-tight lg:text-[32px]">Stock</h1>
        <p aria-live="polite" className="text-muted-foreground tabular-nums">
          {isLoading
            ? "Loading stock…"
            : `${plural(shown.length, "product")} · ${plural(totalUnits, "unit")} in stock`}
        </p>
      </header>

      <div>
        <label htmlFor="stock-search" className="sr-only">Search stock</label>
        <input
          id="stock-search"
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Name, SKU, size or color"
          autoComplete="off"
          className={cn("h-11 w-full rounded-lg border border-input bg-card px-3 max-md:text-base", focusRing)}
        />
      </div>

      {isError && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] border bg-card p-4">
          <p>Stock couldn&apos;t load.</p>
          <button
            type="button"
            onClick={() => refetch()}
            className={cn("min-h-11 cursor-pointer rounded-lg border border-input px-4 font-medium hover:bg-muted", focusRing)}
          >
            Try again
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-16 rounded-[10px]" />
          ))}
        </div>
      ) : (
        !isError &&
        (shown.length === 0 ? (
          <p className="rounded-[10px] border bg-card p-6 text-center text-muted-foreground">
            {searching ? "Nothing matches that search." : "No products yet."}
          </p>
        ) : (
          <ul className="space-y-2">
            {shown.map((product) => (
              <ProductRow
                key={product.id}
                product={product}
                open={openIds.has(product.id)}
                onToggle={() => toggle(product.id)}
              />
            ))}
          </ul>
        ))
      )}
    </div>
  );
}
