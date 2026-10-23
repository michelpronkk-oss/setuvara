import type { ModeSlug } from "@/components/profile/types";

/**
 * Business and Creator Modes may claim their own setuvara.com/<handle>, in the same namespace as
 * usernames. Claiming, going live and search listing are three separate owner choices; the
 * database enforces all of it (claim_mode_handle, set_mode_handle_visibility, release_mode_handle).
 * Personal uses the username; Event keeps its /s/ link.
 */
export const MODE_HANDLE_SLUGS = ["business", "creator"] as const;
export type ModeHandleSlug = (typeof MODE_HANDLE_SLUGS)[number];

export function isModeHandleSlug(slug: ModeSlug | string): slug is ModeHandleSlug {
  return (MODE_HANDLE_SLUGS as readonly string[]).includes(slug);
}

export type ModeHandleState = { handle: string; is_live: boolean; search_indexed: boolean };

/** What check_handle answers while the owner types. */
export type HandleCheck = "free" | "yours" | "taken" | "reserved" | "invalid";

export function parseModeHandleState(value: unknown): ModeHandleState | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (typeof row.handle !== "string" || !/^[a-z0-9_]{3,24}$/.test(row.handle)) return null;
  return { handle: row.handle, is_live: row.is_live === true, search_indexed: row.is_live === true && row.search_indexed === true };
}

/** Database error codes from the RPCs, as the Share screen says them. */
export function handleErrorMessage(message: string | undefined) {
  if (!message) return "Couldn’t save that. Try again.";
  if (message.includes("handle_taken")) return "That name is taken.";
  if (message.includes("handle_reserved")) return "That name is reserved for Setuvara.";
  if (message.includes("handle_invalid")) return "Use 3–24 lowercase letters, numbers or _.";
  if (message.includes("handle_change_limit")) return "You can change this link once every 30 days.";
  if (message.includes("handle_history_limit")) return "You’ve used 20 names. Take back an old one, or write to us.";
  return "Couldn’t save that. Try again.";
}

/** Share URLs with each live Business or Creator handle in place of the Mode's /s/ link. */
export function withLiveHandles<T extends Partial<Record<ModeSlug, string | null>>>(urls: T, handles: Partial<Record<ModeHandleSlug, ModeHandleState>>, origin: string): T {
  const next = { ...urls };
  for (const slug of MODE_HANDLE_SLUGS) {
    const state = handles[slug];
    if (state?.is_live) (next as Partial<Record<ModeSlug, string | null>>)[slug] = `${origin}/${state.handle}`;
  }
  return next;
}
