// The business runs in the Philippines. "Today", daily trends, etc. must follow
// Manila time no matter what time zone the server or container is set to.
export const BUSINESS_TZ = "Asia/Manila";
// Manila has no daylight saving time, so the offset is fixed.
const BUSINESS_UTC_OFFSET = "+08:00";

const DAY_MS = 24 * 60 * 60 * 1000;

const dateKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: BUSINESS_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** The calendar date (YYYY-MM-DD) of an instant, in business time. */
export function businessDateKey(date: Date): string {
  return dateKeyFormatter.format(date);
}

/** Midnight (business time) at the start of the business day containing `date`. */
export function startOfBusinessDay(date: Date = new Date()): Date {
  return new Date(`${businessDateKey(date)}T00:00:00${BUSINESS_UTC_OFFSET}`);
}

/** Shifts an instant by whole days. Exact because the business zone has no DST. */
export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}
