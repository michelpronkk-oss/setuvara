/** Usernames and Business/Creator handles change at most once per this many days (enforced in the database). */
export const HANDLE_CHANGE_DAYS = 30;

export const HANDLE_CHANGE_RULE = "You can change it once every 30 days.";

/** What happens to the name someone leaves behind (enforced in the database). */
export const OLD_NAME_RULE = "Your old link stays yours for 30 days and redirects here. After that someone else can claim it.";

/** "24 November", for "You can change it again on …". */
export function formatChangeDate(value: string | Date, locale?: string) {
  const date = typeof value === "string" ? new Date(value) : value;
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString(locale, { day: "numeric", month: "long" });
}

/** When a change made now would let the next one through. */
export function nextWindowFromNow(now = new Date()) {
  return new Date(now.getTime() + HANDLE_CHANGE_DAYS * 24 * 60 * 60 * 1000);
}

export type ChangeState = { nextChangeAt: string | null; switchBack: string | null };
export const OPEN_CHANGE_STATE: ChangeState = { nextChangeAt: null, switchBack: null };

/** handle_change_state: when the next change opens (null = now) and the name the owner may still switch back to. */
export function parseChangeState(value: unknown, now = Date.now()): ChangeState {
  if (!value || typeof value !== "object" || Array.isArray(value)) return OPEN_CHANGE_STATE;
  const row = value as Record<string, unknown>;
  const time = typeof row.next_change_at === "string" ? Date.parse(row.next_change_at) : NaN;
  if (!Number.isFinite(time) || time <= now) return OPEN_CHANGE_STATE;
  const back = typeof row.switch_back === "string" && /^[a-z0-9_]{3,24}$/.test(row.switch_back) ? row.switch_back : null;
  return { nextChangeAt: new Date(time).toISOString(), switchBack: back };
}
