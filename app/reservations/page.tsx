"use client";

import { useDeferredValue, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { useReservationCounts, useReservations, useUpdateReservation } from "@/lib/hooks";
import {
  RESERVATION_TABS,
  daysSince,
  endOfDayParam,
  needsFollowUp,
  startOfDayParam,
  waitingLabel,
  type ReservationTabId,
} from "@/lib/reservations";
import type { ReservationWithDetails } from "@/lib/types";
import { peso } from "@/lib/live";
import { isVariantArchived } from "@/lib/archive";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

type Action = "ship" | "deliver" | "release" | "cancel" | "return";
type ConfirmableAction = "release" | "cancel" | "return";

const CLOSED_LABELS: Partial<Record<ReservationWithDetails["state"], string>> = {
  RELEASED: "Released",
  RETURNED: "Returned",
  CANCELLED: "Cancelled",
};

const ROW_COLUMNS =
  "md:grid md:grid-cols-[minmax(8rem,1fr)_minmax(12rem,1.6fr)_2.75rem_5.5rem_8.5rem_minmax(14rem,auto)] md:items-center md:gap-3";

const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
const secondaryButton = cn(
  "min-h-11 cursor-pointer rounded-lg border border-[#c4cad0] bg-card px-3 font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50",
  focusRing
);

const customerName = (reservation: ReservationWithDetails) => reservation.customerName || "Walk-in";

function itemDetail({ variant }: ReservationWithDetails) {
  return [variant.size, variant.color, variant.fabric].filter(Boolean).join(", ") || variant.sku || "Standard";
}

function total({ quantity, priceAtReservation, variant }: ReservationWithDetails) {
  const unit = priceAtReservation ?? variant.salePrice ?? variant.price;
  return peso(Number(unit) * quantity);
}

/** When the reservation entered its current stage. */
function stageStartedAt(reservation: ReservationWithDetails) {
  if (reservation.state === "SHIPPING") return reservation.shippingAt ?? reservation.reservedAt;
  if (reservation.state === "SHIPPED") return reservation.shippedAt ?? reservation.reservedAt;
  return reservation.reservedAt;
}

function ReservationRow({ reservation }: { reservation: ReservationWithDetails }) {
  const update = useUpdateReservation();
  const [moreOpen, setMoreOpen] = useState(false);
  const [confirming, setConfirming] = useState<ConfirmableAction | null>(null);
  const [restock, setRestock] = useState(true);

  const { state, quantity } = reservation;
  const name = customerName(reservation);
  const isActive = state === "RESERVED" || state === "SHIPPING";
  const isClosed = state in CLOSED_LABELS;
  const days = daysSince(stageStartedAt(reservation));
  const followUp = needsFollowUp(state, days);

  const run = async (action: Action, successMessage: string) => {
    try {
      const updated = await update.mutateAsync({
        id: reservation.id,
        data: { action, ...(action === "return" && { restock }) },
      });
      if (action === "return" && restock && isVariantArchived(updated.variant)) {
        toast.warning(`${name} returned and restocked, but ${updated.variant.product.name} is archived. Restore it to sell these.`);
      } else {
        toast.success(successMessage);
      }
      setMoreOpen(false);
      setConfirming(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update that reservation");
    }
  };

  const confirmations: Record<ConfirmableAction, { question: string; label: string; done: string }> = {
    release: {
      question: `Release ${quantity} back to available stock?`,
      label: "Release",
      done: `${name} released`,
    },
    cancel: {
      question: `Cancel this reservation and free ${quantity} for sale?`,
      label: "Yes, cancel",
      done: `${name} cancelled`,
    },
    return: {
      question: `Record a return of ${quantity} from ${name}?`,
      label: "Record return",
      done: restock ? `${name} returned and put back in stock` : `${name} returned, not put back in stock`,
    },
  };

  const ask = (action: ConfirmableAction) => {
    setRestock(true);
    setMoreOpen(false);
    setConfirming(action);
  };

  const receiptUrl = `/api/reservations/${reservation.id}/receipt`;
  const stageText = isClosed
    ? CLOSED_LABELS[state]
    : followUp
      ? `${waitingLabel(days)}, follow up`
      : waitingLabel(days);

  return (
    <li className="rounded-[10px] border bg-card md:rounded-none md:border-0 md:border-t md:bg-transparent">
      <div className={cn("flex flex-col gap-2.5 p-3.5 md:min-h-14 md:px-4 md:py-2", ROW_COLUMNS)}>
        <div className="flex items-baseline justify-between gap-3 md:contents">
          <div className="min-w-0 font-semibold max-md:text-base md:truncate">{name}</div>
          <div
            className={cn(
              "order-last text-[13px] md:order-none md:col-start-5 md:row-start-1",
              followUp ? "font-semibold text-stock-out" : "text-muted-foreground"
            )}
          >
            {stageText}
          </div>
        </div>

        <div className="flex items-baseline justify-between gap-3 md:contents">
          <div className="min-w-0 md:col-start-2 md:row-start-1">
            <div className="font-medium">
              <span className="md:hidden">{quantity} × </span>
              {reservation.variant.product.name}
            </div>
            <div className="text-[13px] text-muted-foreground">{itemDetail(reservation)}</div>
          </div>
          <div className="hidden text-right font-semibold tabular-nums md:col-start-3 md:row-start-1 md:block">
            {quantity}
          </div>
          <div className="shrink-0 font-semibold tabular-nums md:col-start-4 md:row-start-1 md:text-right md:font-normal">
            {total(reservation)}
          </div>
        </div>

        {!isClosed && (
          <div className="flex gap-2 md:col-start-6 md:row-start-1 md:justify-end">
            {isActive && (
              <button
                type="button"
                disabled={update.isPending}
                onClick={() =>
                  state === "RESERVED"
                    ? run("ship", `${name} moved to Shipping`)
                    : run("deliver", `${name} marked as delivered`)
                }
                className={cn(
                  "min-h-11 flex-1 cursor-pointer rounded-lg bg-primary px-3.5 font-semibold whitespace-nowrap text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 md:flex-none",
                  focusRing
                )}
              >
                {state === "RESERVED" ? "Ship" : "Mark delivered"}
              </button>
            )}
            <button
              type="button"
              aria-expanded={moreOpen}
              onClick={() => {
                setMoreOpen((open) => !open);
                setConfirming(null);
              }}
              className={cn(secondaryButton, !isActive && "flex-1 md:flex-none")}
            >
              More
            </button>
          </div>
        )}
      </div>

      {moreOpen && (
        <div className="flex flex-wrap justify-end gap-2 px-3.5 pb-3.5 md:px-4">
          <button
            type="button"
            className={secondaryButton}
            onClick={() => window.open(receiptUrl, "_blank")}
          >
            Print receipt
          </button>
          <button
            type="button"
            className={secondaryButton}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(`${window.location.origin}${receiptUrl}`);
                toast.success("Receipt link copied");
              } catch {
                toast.error("Couldn't copy the link");
              }
            }}
          >
            Copy receipt link
          </button>
          {isActive ? (
            <>
              <button type="button" className={secondaryButton} onClick={() => ask("release")}>
                Release
              </button>
              <button type="button" className={secondaryButton} onClick={() => ask("cancel")}>
                Cancel
              </button>
            </>
          ) : (
            <button type="button" className={secondaryButton} onClick={() => ask("return")}>
              Return
            </button>
          )}
        </div>
      )}

      {confirming && (
        <div
          role="group"
          aria-label={confirmations[confirming].question}
          className="flex flex-wrap items-center justify-end gap-3 rounded-b-[10px] bg-background px-3.5 py-3 md:rounded-none md:px-4"
        >
          <span className="min-w-52 flex-1 font-medium">{confirmations[confirming].question}</span>
          {confirming === "return" && (
            <label className="flex min-h-11 cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={restock}
                onChange={(event) => setRestock(event.target.checked)}
                className="size-4.5"
              />
              Put back in stock
            </label>
          )}
          <button type="button" className={secondaryButton} onClick={() => setConfirming(null)}>
            Keep it
          </button>
          <button
            type="button"
            disabled={update.isPending}
            onClick={() => run(confirming, confirmations[confirming].done)}
            className={cn(
              "min-h-11 cursor-pointer rounded-lg bg-stock-out px-3.5 font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50",
              focusRing
            )}
          >
            {confirmations[confirming].label}
          </button>
        </div>
      )}
    </li>
  );
}

export default function ReservationsPage() {
  const [tab, setTab] = useState<ReservationTabId>("RESERVED");
  const [search, setSearch] = useState("");
  const [showDates, setShowDates] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(1);
  const deferredSearch = useDeferredValue(search);

  const currentTab = RESERVATION_TABS.find((item) => item.id === tab) ?? RESERVATION_TABS[0];
  const { data: counts } = useReservationCounts();
  const { data, isLoading, isError, refetch } = useReservations({
    state: currentTab.states.join(","),
    search: deferredSearch.trim() || undefined,
    startDate: startOfDayParam(startDate),
    endDate: endOfDayParam(endDate),
    sort: currentTab.oldestFirst ? "oldest" : undefined,
    page,
    pageSize: 20,
  });

  const rows = data?.data ?? [];
  const hasFilters = search.trim() !== "" || startDate !== "" || endDate !== "";

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[26px] leading-tight font-bold tracking-tight lg:text-[32px]">Reservations</h1>
        <Link
          href="/live?mode=reserve"
          className={cn(
            "inline-flex min-h-11 items-center rounded-lg bg-primary px-4 font-semibold text-primary-foreground hover:opacity-90",
            focusRing
          )}
        >
          New reservation
        </Link>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="group"
          aria-label="Filter by stage"
          className="grid w-full grid-cols-4 gap-0.5 rounded-[10px] bg-muted p-1 md:flex md:w-auto"
        >
          {RESERVATION_TABS.map((item) => {
            const count = item.states.reduce((sum, state) => sum + (counts?.counts[state] ?? 0), 0);
            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={tab === item.id}
                onClick={() => {
                  setTab(item.id);
                  setPage(1);
                }}
                className={cn(
                  "flex min-h-11 cursor-pointer flex-col items-center justify-center rounded-[7px] px-1 text-[13px] md:flex-row md:gap-2 md:px-3.5 md:text-sm",
                  tab === item.id ? "bg-card font-semibold" : "font-medium",
                  focusRing
                )}
              >
                {item.label}
                <span className="text-[#4a5158] tabular-nums">{count}</span>
              </button>
            );
          })}
        </div>

        <div className="flex w-full items-center gap-2 md:w-auto md:min-w-96">
          <label htmlFor="reservation-search" className="sr-only">Search reservations</label>
          <input
            id="reservation-search"
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search customer or item"
            autoComplete="off"
            className={cn("h-11 min-w-0 flex-1 rounded-lg border border-input bg-card px-3 max-md:text-base", focusRing)}
          />
          <button
            type="button"
            aria-expanded={showDates}
            onClick={() => setShowDates((open) => !open)}
            className={cn(
              "min-h-11 cursor-pointer rounded-lg border border-input bg-card px-3.5 font-medium hover:bg-muted",
              focusRing
            )}
          >
            Dates
          </button>
        </div>
      </div>

      {showDates && (
        <div className="flex flex-wrap items-end gap-3 rounded-[10px] border bg-card px-4 py-3">
          {[
            { id: "reservation-from", label: "From", value: startDate, set: setStartDate },
            { id: "reservation-to", label: "To", value: endDate, set: setEndDate },
          ].map((field) => (
            <div key={field.id} className="flex flex-col gap-1">
              <label htmlFor={field.id} className="text-[13px] font-medium">{field.label}</label>
              <input
                id={field.id}
                type="date"
                value={field.value}
                onChange={(event) => {
                  field.set(event.target.value);
                  setPage(1);
                }}
                className={cn("h-11 rounded-lg border border-input bg-card px-2.5", focusRing)}
              />
            </div>
          ))}
          {(startDate || endDate) && (
            <button
              type="button"
              onClick={() => {
                setStartDate("");
                setEndDate("");
                setPage(1);
              }}
              className="min-h-11 cursor-pointer px-2 font-medium text-stock-in hover:underline"
            >
              Clear dates
            </button>
          )}
        </div>
      )}

      <section aria-label="Reservations" className="md:overflow-hidden md:rounded-[10px] md:border md:bg-card">
        <div className={cn("hidden px-4 py-2.5 text-xs font-medium text-muted-foreground", ROW_COLUMNS)} aria-hidden="true">
          <span>Customer</span>
          <span>Item</span>
          <span className="text-right">Qty</span>
          <span className="text-right">Total</span>
          <span>{tab === "CLOSED" ? "Outcome" : "Waiting"}</span>
          <span />
        </div>

        {isError ? (
          <div role="alert" className="flex flex-wrap items-center justify-between gap-3 border-t p-4">
            <p>Reservations couldn&apos;t load.</p>
            <button type="button" className={secondaryButton} onClick={() => refetch()}>
              Try again
            </button>
          </div>
        ) : isLoading ? (
          <div className="space-y-2 p-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : rows.length === 0 ? (
          <p className="rounded-[10px] border bg-card px-4 py-10 text-center text-muted-foreground md:rounded-none md:border-0 md:border-t">
            {hasFilters ? "No reservations match that search." : "Nothing here right now."}
          </p>
        ) : (
          <ul className="flex flex-col gap-2 md:gap-0">
            {(rows as ReservationWithDetails[]).map((reservation) => (
              <ReservationRow key={reservation.id} reservation={reservation} />
            ))}
          </ul>
        )}

        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-between gap-3 py-3 md:border-t md:px-4">
            <span className="text-[13px] text-muted-foreground">
              Page {data.page} of {data.totalPages}, {data.total} in all
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                className={secondaryButton}
                disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                Previous
              </button>
              <button
                type="button"
                className={secondaryButton}
                disabled={page >= data.totalPages}
                onClick={() => setPage((current) => Math.min(data.totalPages, current + 1))}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
