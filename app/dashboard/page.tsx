"use client";

import Link from "next/link";
import { useDashboard, useReservationCounts } from "@/lib/hooks";
import { Skeleton } from "@/components/ui/skeleton";
import { MovementTrendChart } from "@/components/movement-trend-chart";
import { BUSINESS_TZ, businessDateKey } from "@/lib/time";
import { daysSince, waitingLabel } from "@/lib/reservations";
import type { LowStockItem, MovementWithDetails } from "@/lib/types";

const money = (amount: number) =>
  `₱${amount.toLocaleString("en-PH", { maximumFractionDigits: 0 })}`;

const variantDetail = (variant: { size: string | null; color: string | null; fabric: string | null }) =>
  [variant.size, variant.color, variant.fabric].filter(Boolean).join(", ");

const available = (item: LowStockItem) => item.currentStock - (item.reservedStock ?? 0);

function Tile({
  href,
  count,
  title,
  detail,
  loading,
}: {
  href: string;
  count: string | number;
  title: string;
  detail: string;
  loading: boolean;
}) {
  return (
    <Link
      href={href}
      className="flex flex-col gap-1 rounded-[10px] border bg-card p-5 transition-colors hover:border-input focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      {loading ? (
        <Skeleton className="h-10 w-12" />
      ) : (
        <span className="text-[40px] leading-none font-bold tabular-nums">{count}</span>
      )}
      <span className="font-semibold">{title}</span>
      <span className="text-sm text-muted-foreground">{detail}</span>
    </Link>
  );
}

function Panel({
  title,
  action,
  id,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  id?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="min-w-0 scroll-mt-4 rounded-[10px] border bg-card p-5">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-base font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function movementQuantity(movement: MovementWithDetails) {
  if (movement.type === "OUT") return `−${movement.quantity}`;
  if (movement.type === "IN") return `+${movement.quantity}`;
  return `=${movement.quantity}`;
}

function movementNote(movement: MovementWithDetails) {
  const note = movement.note ?? "";
  if (note.startsWith("Reservation #")) return "Reservation delivered";
  if (note.startsWith("Return from Reservation #")) return "Reservation returned";
  return note;
}

function movementTime(createdAt: Date | string, todayKey: string) {
  const date = new Date(createdAt);
  const options: Intl.DateTimeFormatOptions =
    businessDateKey(date) === todayKey
      ? { hour: "numeric", minute: "2-digit" }
      : { month: "short", day: "numeric" };
  return date.toLocaleString("en-PH", { ...options, timeZone: BUSINESS_TZ });
}

export default function TodayPage() {
  const { data, isLoading, isError, refetch } = useDashboard();
  const { data: reservations, isLoading: reservationsLoading } = useReservationCounts();

  const stats = data?.stats;
  const lowStock = data?.lowStockItems ?? [];
  const soldOutCount = lowStock.filter((item) => available(item) <= 0).length;
  // The dashboard lists at most 20 items, lowest stock first, so a full list of
  // sold-out items may not be all of them.
  const soldOutLabel = soldOutCount === 20 ? "20+" : soldOutCount;
  const runningLowCount = Math.max(0, (stats?.lowStockCount ?? 0) - soldOutCount);

  const toShip = reservations?.counts.RESERVED ?? 0;
  const oldest = reservations?.oldestReservedAt;
  const now = new Date();
  const todayKey = businessDateKey(now);
  const todayLabel = now.toLocaleDateString("en-PH", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: BUSINESS_TZ,
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-[32px] leading-tight font-bold tracking-tight">Today</h1>
          <p className="text-muted-foreground">{todayLabel}</p>
        </div>
        <Link
          href="/live"
          className="inline-flex min-h-12 items-center rounded-lg bg-stock-out px-6 text-base font-semibold text-white transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stock-out"
        >
          Go live
        </Link>
      </header>

      {isError && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] border bg-card p-4">
          <p>Today&apos;s numbers couldn&apos;t load.</p>
          <button
            type="button"
            onClick={() => refetch()}
            className="min-h-11 cursor-pointer rounded-lg border border-input px-4 font-medium hover:bg-muted"
          >
            Try again
          </button>
        </div>
      )}

      <section aria-label="Needs attention" className="grid gap-3 sm:grid-cols-3">
        <Tile
          href="/reservations"
          count={toShip}
          title="Reservations to ship"
          detail={
            reservationsLoading
              ? "Checking…"
              : oldest
                ? `Oldest waiting ${waitingLabel(daysSince(oldest)).toLowerCase()}`
                : "Nothing waiting"
          }
          loading={reservationsLoading}
        />
        <Tile
          href="#restock"
          count={soldOutLabel}
          title="Sold out"
          detail={isLoading ? "Checking…" : soldOutCount > 0 ? "Can't be sold until restocked" : "Everything has stock"}
          loading={isLoading}
        />
        <Tile
          href="#restock"
          count={runningLowCount}
          title="Running low"
          detail="At or below their alert level"
          loading={isLoading}
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Restock next" id="restock">
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : lowStock.length === 0 ? (
            <p className="text-muted-foreground">Everything is above its alert level.</p>
          ) : (
            // "relative" keeps the screen-reader-only header inside this scroll area.
            <div className="relative overflow-x-auto">
              <table className="w-full min-w-[26rem] text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground">
                    <th scope="col" className="py-1.5 pr-2 font-medium">Item</th>
                    <th scope="col" className="px-2 py-1.5 text-right font-medium">Available</th>
                    <th scope="col" className="px-2 py-1.5 text-right font-medium">Alert at</th>
                    <th scope="col" className="py-1.5 pl-2"><span className="sr-only">Action</span></th>
                  </tr>
                </thead>
                <tbody>
                  {lowStock.slice(0, 8).map((item) => (
                    <tr key={item.variantId} className="border-t">
                      <td className="py-2 pr-2">
                        <div className="font-medium">{item.productName}</div>
                        <div className="text-[13px] text-muted-foreground">
                          {variantDetail(item) || item.sku || "Standard"}
                        </div>
                      </td>
                      <td className="px-2 py-2 text-right text-base font-bold tabular-nums">{available(item)}</td>
                      <td className="px-2 py-2 text-right text-muted-foreground tabular-nums">{item.lowStockAt}</td>
                      <td className="py-2 pl-2 text-right">
                        <Link
                          href={`/live?mode=stockin&variant=${item.variantId}`}
                          className="inline-flex min-h-11 items-center rounded-lg border border-input bg-card px-3 font-medium whitespace-nowrap hover:bg-muted"
                        >
                          Stock in
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <Panel
          title="Recent movements"
          action={
            <Link href="/movements" className="text-sm font-medium text-stock-in hover:underline">
              View all
            </Link>
          }
        >
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : !stats?.recentMovements.length ? (
            <p className="text-muted-foreground">No movements yet.</p>
          ) : (
            <ul>
              {stats.recentMovements.slice(0, 7).map((movement) => (
                <li key={movement.id} className="flex items-center gap-3 border-t py-2.5 text-sm">
                  <span className="w-11 shrink-0 text-base font-bold tabular-nums">{movementQuantity(movement)}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{movement.variant.product.name}</div>
                    <div className="truncate text-[13px] text-muted-foreground">
                      {[variantDetail(movement.variant), movementNote(movement)].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                  <span className="shrink-0 text-[13px] text-muted-foreground tabular-nums">
                    {movementTime(movement.createdAt, todayKey)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Units moved, last 7 days">
          {isLoading ? <Skeleton className="h-52 w-full" /> : <MovementTrendChart data={stats?.movementTrend ?? []} />}
        </Panel>

        <Panel title="Stock on hand is worth">
          <dl>
            {[
              { label: "Cost", value: money(stats?.totalInventoryCost ?? 0) },
              { label: "If everything sells", value: money(stats?.totalInventoryRevenue ?? 0) },
              { label: "Potential profit", value: money(stats?.totalProfitPotential ?? 0) },
              { label: "Average margin", value: `${Math.round(stats?.averageMarginPercent ?? 0)}%` },
            ].map((row) => (
              <div key={row.label} className="flex items-baseline justify-between gap-3 border-t py-3.5">
                <dt className="text-sm text-muted-foreground">{row.label}</dt>
                <dd className="text-xl font-semibold tabular-nums">
                  {isLoading ? <Skeleton className="h-6 w-24" /> : row.value}
                </dd>
              </div>
            ))}
          </dl>
        </Panel>
      </div>
    </div>
  );
}
