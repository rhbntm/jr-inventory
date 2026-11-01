"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChevronDown, ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import {
  useAllProducts,
  useCreateMovement,
  useCreateReservation,
  useUndoMovement,
  useUpdateReservation,
} from "@/lib/hooks";
import {
  LIVE_MODES,
  describeAction,
  groupLiveVariants,
  parseLiveMode,
  peso,
  searchVariants,
  sessionTotals,
  toLiveVariants,
  type LiveEntry,
  type LiveMode,
  type LiveProduct,
  type LiveVariant,
} from "@/lib/live";
import { createReservationSchema, movementSchema } from "@/lib/schemas";
import { cn } from "@/lib/utils";

const SESSION_KEY = "jr-live-session";
const MAX_RESULTS = 100;

/**
 * Survives a refresh mid-stream, so recent entries can still be undone. This screen only
 * renders in the browser (see page.tsx), so reading storage while it first renders is safe.
 */
function loadEntries(): LiveEntry[] {
  try {
    const saved = window.sessionStorage.getItem(SESSION_KEY);
    return saved ? (JSON.parse(saved) as LiveEntry[]) : [];
  } catch {
    return [];
  }
}

const isDesktop = () => window.matchMedia("(min-width: 1024px)").matches;

const entryQuantity = (entry: LiveEntry) => {
  if (entry.mode === "sell") return `−${entry.quantity}`;
  if (entry.mode === "stockin") return `+${entry.quantity}`;
  return `Held ${entry.quantity}`;
};

const entryTime = (entry: LiveEntry) =>
  new Date(entry.at).toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" });

const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
const fieldClass = cn("w-full rounded-lg border border-input bg-card px-3 text-base", focusRing);

const leftLabel = (available: number) => (available <= 0 ? "None left" : `${available} left`);

/**
 * One product in the phone list. Tapping opens its variants, or goes straight to the sale
 * when there's only one to choose from.
 */
function LiveProductRow({
  group,
  open,
  onToggle,
  onSelect,
}: {
  group: LiveProduct;
  open: boolean;
  onToggle: () => void;
  onSelect: (id: string) => void;
}) {
  const only = group.variants.length === 1 ? group.variants[0] : null;
  const panelId = `live-product-${group.productId}`;

  return (
    <li className="overflow-hidden rounded-[10px] border bg-card">
      <button
        type="button"
        aria-expanded={only ? undefined : open}
        aria-controls={only ? undefined : panelId}
        onClick={() => (only ? onSelect(only.id) : onToggle())}
        className={cn(
          "flex min-h-16 w-full cursor-pointer items-center gap-3 rounded-[10px] px-3.5 py-2.5 text-left hover:bg-background",
          focusRing
        )}
      >
        <span className="min-w-0 flex-1">
          <span className="block font-semibold break-words">{group.product}</span>
          <span className="block text-[13px] text-muted-foreground">
            {only ? only.label : `${group.variants.length} variants`}
          </span>
        </span>
        <span className={cn("shrink-0 font-bold tabular-nums", group.available <= 0 && "text-stock-out")}>
          {leftLabel(group.available)}
        </span>
        {!only && (
          <ChevronDown
            aria-hidden="true"
            className={cn("size-5 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
          />
        )}
      </button>
      {!only && open && (
        <ul id={panelId} className="border-t">
          {group.variants.map((variant) => (
            <li key={variant.id} className="border-t first:border-t-0">
              <button
                type="button"
                onClick={() => onSelect(variant.id)}
                className={cn(
                  "flex min-h-14 w-full cursor-pointer items-center justify-between gap-3 px-3.5 py-2 text-left hover:bg-background",
                  focusRing
                )}
              >
                <span className="min-w-0">
                  <span className="block font-medium break-words">{variant.label}</span>
                  {(variant.sku || variant.reserved > 0) && (
                    <span className="block text-[13px] break-words text-muted-foreground">
                      {[variant.sku, variant.reserved > 0 && `${variant.reserved} reserved`].filter(Boolean).join(" · ")}
                    </span>
                  )}
                </span>
                <span
                  className={cn(
                    "shrink-0 font-semibold tabular-nums",
                    variant.available <= variant.lowStockAt && "text-stock-out"
                  )}
                >
                  {leftLabel(variant.available)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

export function LiveScreen() {
  const searchParams = useSearchParams();
  const { data: products, isLoading, isError, refetch } = useAllProducts({ refetchInterval: 30_000 });
  const createMovement = useCreateMovement();
  const createReservation = useCreateReservation();
  const undoMovement = useUndoMovement();
  const cancelReservation = useUpdateReservation();

  const [mode, setMode] = useState<LiveMode>(() => parseLiveMode(searchParams.get("mode")));
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(() => searchParams.get("variant"));
  const [quantityText, setQuantityText] = useState("1");
  const [priceOverride, setPriceOverride] = useState<string | null>(null);
  const [customer, setCustomer] = useState("");
  const [note, setNote] = useState("");
  const [entries, setEntries] = useState<LiveEntry[]>(loadEntries);
  const [undoingId, setUndoingId] = useState<string | null>(null);
  const [openProductIds, setOpenProductIds] = useState<Set<string>>(() => new Set());

  const searchRef = useRef<HTMLInputElement>(null);
  const quantityRef = useRef<HTMLInputElement>(null);

  const variants = useMemo(() => toLiveVariants(products ?? []), [products]);
  const matches = useMemo(() => searchVariants(variants, query), [variants, query]);
  const productGroups = useMemo(() => groupLiveVariants(variants), [variants]);
  const selected: LiveVariant | undefined = variants.find((variant) => variant.id === selectedId);
  const siblings = selected ? variants.filter((variant) => variant.productId === selected.productId) : [];

  const searching = query.trim() !== "";
  const pending = createMovement.isPending || createReservation.isPending;
  const quantity = Number.parseInt(quantityText, 10) || 0;
  const priceText = priceOverride ?? String(selected?.usualPrice ?? "");
  const unitPrice = priceText === "" ? (selected?.usualPrice ?? 0) : Number(priceText);
  const action = selected ? describeAction(mode, selected, quantity, unitPrice) : null;
  const totals = sessionTotals(entries);
  const lastEntry = entries[0];

  useEffect(() => {
    try {
      window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(entries));
    } catch {
      // Private browsing can refuse storage. The session still works until a refresh.
    }
  }, [entries]);

  useEffect(() => {
    if (!selectedId && isDesktop()) searchRef.current?.focus();
    // Only when the screen opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Keeps the keyboard on the next likely step. On phones it would cover the screen. */
  const focusQuantity = () => {
    if (!isDesktop()) return;
    requestAnimationFrame(() => {
      quantityRef.current?.focus();
      quantityRef.current?.select();
    });
  };

  const selectVariant = (id: string) => {
    setSelectedId(id);
    setQuantityText("1");
    setPriceOverride(null);
    setQuery("");
    focusQuantity();
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected || !action || action.blocked || pending) return;

    try {
      const price = priceText === "" ? undefined : unitPrice;
      let recordId: string;

      if (mode === "reserve") {
        const input = createReservationSchema.safeParse({
          variantId: selected.id,
          quantity,
          customerName: customer.trim() || null,
          priceAtReservation: price,
        });
        if (!input.success) {
          toast.error(input.error.issues[0].message);
          return;
        }
        recordId = (await createReservation.mutateAsync(input.data)).id;
      } else {
        const input = movementSchema.safeParse({
          variantId: selected.id,
          type: mode === "sell" ? "OUT" : "IN",
          quantity,
          priceAtMovement: mode === "sell" ? price : undefined,
          note: note.trim() || undefined,
        });
        if (!input.success) {
          toast.error(input.error.issues[0].message);
          return;
        }
        recordId = (await createMovement.mutateAsync(input.data)).id;
      }

      setEntries((current) =>
        [
          {
            recordId,
            mode,
            product: selected.product,
            label: selected.label,
            quantity,
            unitPrice,
            customer: mode === "reserve" ? customer.trim() || null : null,
            at: new Date().toISOString(),
          },
          ...current,
        ].slice(0, 50)
      );
      // The same item often sells again straight away, so it stays selected.
      setQuantityText("1");
      setPriceOverride(null);
      setCustomer("");
      setNote("");
      focusQuantity();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't record that. Nothing was changed.");
    }
  };

  const toggleProduct = (id: string) =>
    setOpenProductIds((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  const undo = async (entry: LiveEntry) => {
    setUndoingId(entry.recordId);
    try {
      if (entry.mode === "reserve") {
        await cancelReservation.mutateAsync({ id: entry.recordId, data: { action: "cancel" } });
      } else {
        await undoMovement.mutateAsync(entry.recordId);
      }
      setEntries((current) => current.filter((item) => item.recordId !== entry.recordId));
      toast.success(`Undid ${entry.product}, ${entry.label}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't undo that");
    } finally {
      setUndoingId(null);
    }
  };

  const isLow = selected ? selected.available > 0 && selected.available <= selected.lowStockAt : false;
  const isOut = selected ? selected.available <= 0 : false;
  const usualPriceNote = !selected
    ? ""
    : unitPrice !== selected.usualPrice
      ? `Usual price ${peso(selected.usualPrice)}`
      : selected.salePrice !== null
        ? `Sale, normally ${peso(selected.price)}`
        : "Usual price";

  const lastEntryBar = lastEntry && (
    <div aria-live="polite" className="flex min-h-11 items-center justify-between gap-2 lg:hidden">
      <span className="min-w-0 truncate text-[13px]">
        <strong className="font-bold tabular-nums">{entryQuantity(lastEntry)}</strong>{" "}
        {lastEntry.product}, {lastEntry.label}
      </span>
      <button
        type="button"
        disabled={undoingId !== null}
        onClick={() => undo(lastEntry)}
        className="min-h-11 shrink-0 cursor-pointer px-2 font-medium text-stock-in disabled:opacity-50"
      >
        Undo
      </button>
    </div>
  );

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 bg-sidebar px-3 py-2 text-sidebar-foreground lg:px-6">
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="inline-flex min-h-11 items-center font-medium hover:underline">
            Exit live
          </Link>
          <span aria-hidden="true" className="hidden h-5 w-px bg-sidebar-accent lg:block" />
          <h1 className="hidden text-lg font-bold lg:block">Live</h1>
        </div>
        <p className="tabular-nums text-[#c4cad0] lg:order-last">
          {totals.units} sold, <strong className="font-semibold text-sidebar-foreground">{peso(totals.revenue)}</strong>
        </p>
        <div
          role="group"
          aria-label="What are you recording?"
          className="grid w-full grid-cols-3 gap-1 rounded-[10px] bg-sidebar-accent p-1 lg:w-auto"
        >
          {LIVE_MODES.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              aria-pressed={mode === id}
              onClick={() => setMode(id)}
              className={cn(
                "min-h-11 cursor-pointer rounded-[7px] px-5 text-[15px] font-semibold lg:min-w-26",
                mode === id ? "bg-sidebar-primary text-sidebar-primary-foreground" : "text-sidebar-foreground"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      <main className="grid flex-1 items-start gap-4 p-3 lg:grid-cols-[minmax(17rem,1fr)_minmax(26rem,1.5fr)_minmax(16rem,1fr)] lg:p-6">
        {/* Find an item */}
        <section aria-label="Find an item" className="flex flex-col gap-3 lg:rounded-[10px] lg:border lg:bg-card lg:p-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="live-search" className="sr-only font-semibold lg:not-sr-only">
              Find an item
            </label>
            <input
              id="live-search"
              ref={searchRef}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && matches[0]) {
                  event.preventDefault();
                  selectVariant(matches[0].id);
                }
                // Only clears the search. A half-entered sale is never wiped by this.
                if (event.key === "Escape") setQuery("");
              }}
              placeholder="Name, SKU, size or color"
              autoComplete="off"
              className={cn(fieldClass, "h-12")}
            />
          </div>

          {isLoading && <p className="p-2 text-muted-foreground">Loading items…</p>}
          {isError && (
            <div role="alert" className="space-y-2 p-2">
              <p>Items couldn&apos;t load.</p>
              <button
                type="button"
                onClick={() => refetch()}
                className="min-h-11 cursor-pointer rounded-lg border border-input bg-card px-4 font-medium hover:bg-muted"
              >
                Try again
              </button>
            </div>
          )}

          {/* On a phone, products are listed until one is picked or a search starts. */}
          {!searching && !selected && !isLoading && !isError && (
            <div className="flex flex-col gap-2 lg:hidden">
              {productGroups.length === 0 ? (
                <p className="px-1 py-4 text-muted-foreground">No items yet. Add products first.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {productGroups.map((group) => (
                    <LiveProductRow
                      key={group.productId}
                      group={group}
                      open={openProductIds.has(group.productId)}
                      onToggle={() => toggleProduct(group.productId)}
                      onSelect={selectVariant}
                    />
                  ))}
                </ul>
              )}
              {lastEntry && (
                <div className="sticky bottom-0 -mx-3 border-t bg-card px-3 pb-[env(safe-area-inset-bottom)]">
                  {lastEntryBar}
                </div>
              )}
            </div>
          )}

          <div
            className={cn(
              "max-h-[38rem] flex-col gap-1 overflow-y-auto",
              searching ? "flex" : "hidden lg:flex"
            )}
          >
            {matches.slice(0, MAX_RESULTS).map((variant) => (
              <button
                key={variant.id}
                type="button"
                aria-current={variant.id === selectedId ? "true" : undefined}
                onClick={() => selectVariant(variant.id)}
                className={cn(
                  "flex min-h-14 w-full cursor-pointer items-center justify-between gap-3 rounded-lg border bg-card px-2.5 py-2 text-left hover:bg-background",
                  variant.id === selectedId ? "border-foreground bg-background" : "border-border lg:border-transparent",
                  focusRing
                )}
              >
                <span className="min-w-0">
                  <span className="block font-medium">{variant.product}</span>
                  <span className="block text-[13px] text-muted-foreground">
                    {variant.label}
                    {variant.reserved > 0 && ` · ${variant.reserved} reserved`}
                  </span>
                </span>
                <span className="shrink-0 font-semibold tabular-nums">
                  {variant.available <= 0 ? "None left" : `${variant.available} left`}
                </span>
              </button>
            ))}
            {!isLoading && !isError && matches.length === 0 && (
              <p className="px-1 py-4 text-muted-foreground">
                {variants.length === 0 ? "No items yet. Add products first." : "Nothing matches that search."}
              </p>
            )}
            {matches.length > MAX_RESULTS && (
              <p className="px-1 py-2 text-[13px] text-muted-foreground">
                Showing the first {MAX_RESULTS} of {matches.length}. Keep typing to narrow it down.
              </p>
            )}
          </div>
        </section>

        {/* Record */}
        <form
          onSubmit={submit}
          aria-label="Record"
          className={cn(
            "flex-col gap-5 rounded-[10px] border bg-card p-4 lg:flex lg:p-6",
            searching || !selected ? "hidden" : "flex"
          )}
        >
          {!selected ? (
            <p className="py-10 text-center text-muted-foreground">Search for an item to get started.</p>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className={cn(
                  "-mt-2 -mb-3 -ml-1 inline-flex min-h-11 w-fit cursor-pointer items-center gap-1 font-medium text-stock-in lg:hidden",
                  focusRing
                )}
              >
                <ChevronLeft aria-hidden="true" className="size-5" />
                All items
              </button>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="text-xl leading-tight font-bold tracking-tight lg:text-2xl">{selected.product}</h2>
                  {selected.sku && <p className="mt-1 font-mono text-[13px] text-muted-foreground">{selected.sku}</p>}
                  <p className="mt-1.5 text-[13px] text-muted-foreground tabular-nums">
                    {selected.onHand} on hand, {selected.reserved} reserved
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <div
                    className={cn(
                      "text-6xl leading-none font-bold tracking-tighter tabular-nums lg:text-7xl",
                      (isLow || isOut) && "text-stock-out"
                    )}
                  >
                    {selected.available}
                  </div>
                  <div className="mt-1 text-[13px] font-semibold">
                    {isOut ? "None available" : isLow ? "Available, running low" : "Available"}
                  </div>
                </div>
              </div>

              {siblings.length > 1 && (
                <div role="group" aria-label="Other sizes and colors" className="flex flex-wrap gap-2">
                  {siblings.map((variant) => {
                    const active = variant.id === selected.id;
                    return (
                      <button
                        key={variant.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => selectVariant(variant.id)}
                        className={cn(
                          "flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 font-medium",
                          active ? "border-foreground bg-foreground text-background" : "border-[#c4cad0] hover:bg-background",
                          focusRing
                        )}
                      >
                        {variant.label}
                        <span className="font-bold tabular-nums">{variant.available}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex min-w-0 flex-col gap-1.5">
                  <label htmlFor="live-quantity" className="font-semibold">Quantity</label>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      aria-label="One less"
                      disabled={quantity <= 1}
                      onClick={() => setQuantityText(String(Math.max(1, quantity - 1)))}
                      className={cn(
                        "size-14 shrink-0 cursor-pointer rounded-lg border border-input bg-card text-2xl hover:bg-background disabled:cursor-not-allowed disabled:opacity-40",
                        focusRing
                      )}
                    >
                      −
                    </button>
                    <input
                      id="live-quantity"
                      ref={quantityRef}
                      type="number"
                      inputMode="numeric"
                      min={1}
                      value={quantityText}
                      onChange={(event) => setQuantityText(event.target.value)}
                      className={cn(fieldClass, "h-14 min-w-0 flex-1 px-1 text-center text-2xl font-bold")}
                    />
                    <button
                      type="button"
                      aria-label="One more"
                      onClick={() => setQuantityText(String(quantity + 1))}
                      className={cn(
                        "size-14 shrink-0 cursor-pointer rounded-lg border border-input bg-card text-2xl hover:bg-background",
                        focusRing
                      )}
                    >
                      +
                    </button>
                  </div>
                </div>

                {mode !== "stockin" && (
                  <div className="flex min-w-0 flex-col gap-1.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <label htmlFor="live-price" className="font-semibold">Unit price</label>
                      {priceOverride !== null && unitPrice !== selected.usualPrice ? (
                        <button
                          type="button"
                          onClick={() => setPriceOverride(null)}
                          className="cursor-pointer text-[13px] font-medium text-stock-in hover:underline"
                        >
                          Reset to {peso(selected.usualPrice)}
                        </button>
                      ) : (
                        <span className="text-[13px] text-muted-foreground">{usualPriceNote}</span>
                      )}
                    </div>
                    <div className={cn("flex h-14 items-center gap-1 rounded-lg border border-input bg-card px-3 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring")}>
                      <span aria-hidden="true" className="text-xl font-semibold text-muted-foreground">₱</span>
                      <input
                        id="live-price"
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step="0.01"
                        value={priceText}
                        onChange={(event) => setPriceOverride(event.target.value)}
                        className="h-full w-full min-w-0 bg-transparent text-2xl font-bold outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>

              {mode === "reserve" ? (
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="live-customer" className="font-semibold">
                    Customer or order number <span className="font-normal text-muted-foreground">(optional)</span>
                  </label>
                  <input
                    id="live-customer"
                    value={customer}
                    onChange={(event) => setCustomer(event.target.value)}
                    autoComplete="off"
                    className={cn(fieldClass, "h-12")}
                  />
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="live-note" className="font-semibold">
                    Note <span className="font-normal text-muted-foreground">(optional)</span>
                  </label>
                  <input
                    id="live-note"
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    autoComplete="off"
                    className={cn(fieldClass, "h-12")}
                  />
                </div>
              )}

              {/* On a phone the action stays in reach however long the form gets. */}
              <div className="sticky bottom-0 -mx-4 -mb-4 flex flex-col gap-1 rounded-b-[10px] border-t bg-card px-4 pt-2 pb-4 lg:static lg:m-0 lg:border-0 lg:p-0">
                {lastEntryBar}
                <button
                  type="submit"
                  disabled={!action || action.blocked || pending}
                  className={cn(
                    "min-h-16 w-full rounded-[10px] px-4 text-xl font-bold tabular-nums transition-opacity lg:min-h-[72px] lg:text-[22px]",
                    action?.blocked
                      ? "cursor-not-allowed bg-muted text-[#4a5158]"
                      : cn(
                          "cursor-pointer text-white hover:opacity-90",
                          mode === "sell" && "bg-stock-out",
                          mode === "reserve" && "bg-primary",
                          mode === "stockin" && "bg-stock-in"
                        ),
                    focusRing
                  )}
                >
                  {pending ? "Saving…" : action?.label}
                </button>
                <p className="mt-1 hidden text-center text-[13px] text-muted-foreground lg:block">
                  Enter in search picks the top result. Enter in any field confirms.
                </p>
              </div>
            </>
          )}
        </form>

        {/* This session */}
        <section aria-labelledby="live-log" className="hidden rounded-[10px] border bg-card p-4 lg:block">
          <h2 id="live-log" className="mb-2 text-base font-semibold">This session</h2>
          {entries.length === 0 ? (
            <p className="py-3 text-muted-foreground">Nothing recorded yet.</p>
          ) : (
            <ul aria-live="polite">
              {entries.map((entry) => (
                <li key={entry.recordId} className="flex items-center gap-2.5 border-t py-2">
                  <span className="w-14 shrink-0 font-bold tabular-nums">{entryQuantity(entry)}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{entry.product}</div>
                    <div className="truncate text-[13px] text-muted-foreground">
                      {[entry.label, entry.customer, entryTime(entry)].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={undoingId !== null}
                    aria-label={`Undo ${entry.product}, ${entry.label}`}
                    onClick={() => undo(entry)}
                    className={cn(
                      "min-h-11 shrink-0 cursor-pointer rounded-md px-2 font-medium text-stock-in hover:underline disabled:opacity-50",
                      focusRing
                    )}
                  >
                    {undoingId === entry.recordId ? "Undoing…" : "Undo"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
