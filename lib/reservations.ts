import type { ReservationState } from "@prisma/client";

export type ReservationTabId = "RESERVED" | "SHIPPING" | "SHIPPED" | "CLOSED";

export const RESERVATION_TABS: {
  id: ReservationTabId;
  label: string;
  states: ReservationState[];
  /** Work still to do is shown oldest first, so nothing sits forgotten. */
  oldestFirst: boolean;
}[] = [
  { id: "RESERVED", label: "Reserved", states: ["RESERVED"], oldestFirst: true },
  { id: "SHIPPING", label: "Shipping", states: ["SHIPPING"], oldestFirst: true },
  { id: "SHIPPED", label: "Shipped", states: ["SHIPPED"], oldestFirst: false },
  { id: "CLOSED", label: "Closed", states: ["RELEASED", "RETURNED", "CANCELLED"], oldestFirst: false },
];

/** A reservation still unshipped after this many days gets flagged for follow-up. */
export const FOLLOW_UP_AFTER_DAYS = 3;

const DAY_MS = 24 * 60 * 60 * 1000;

export function daysSince(date: Date | string, now: Date = new Date()): number {
  return Math.max(0, Math.floor((now.getTime() - new Date(date).getTime()) / DAY_MS));
}

export function waitingLabel(days: number): string {
  if (days === 0) return "Today";
  return days === 1 ? "1 day" : `${days} days`;
}

export function needsFollowUp(state: ReservationState, days: number): boolean {
  return state === "RESERVED" && days >= FOLLOW_UP_AFTER_DAYS;
}

/** Date inputs give a bare day; the business day runs on Manila time. */
export const startOfDayParam = (day: string) => (day ? `${day}T00:00:00.000+08:00` : undefined);
export const endOfDayParam = (day: string) => (day ? `${day}T23:59:59.999+08:00` : undefined);
