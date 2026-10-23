/** Usernames and Business/Creator handles change at most once per this many days (enforced in the database). */
export const HANDLE_CHANGE_DAYS = 30;

export const HANDLE_CHANGE_RULE = "You can change it once every 30 days.";

/** "24 November", for "You can change it again on …". */
export function formatChangeDate(value: string | Date, locale?: string) {
  const date = typeof value === "string" ? new Date(value) : value;
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString(locale, { day: "numeric", month: "long" });
}

/** When a change made now would let the next one through. */
export function nextWindowFromNow(now = new Date()) {
  return new Date(now.getTime() + HANDLE_CHANGE_DAYS * 24 * 60 * 60 * 1000);
}

/** handle_next_change_at answers an ISO time while locked, null when a change is allowed now. */
export function parseNextChangeAt(value: unknown, now = Date.now()): string | null {
  if (typeof value !== "string") return null;
  const time = Date.parse(value);
  return Number.isFinite(time) && time > now ? new Date(time).toISOString() : null;
}
