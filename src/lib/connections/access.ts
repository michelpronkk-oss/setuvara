import type { ModeSlug } from "@/components/profile/types";

export type ConnectPolicy = "anyone" | "direct_only" | "nobody";

export const CONNECT_POLICIES: ConnectPolicy[] = ["anyone", "direct_only", "nobody"];

export function parseConnectPolicy(value: unknown): ConnectPolicy {
  return value === "direct_only" || value === "nobody" ? value : "anyone";
}

export const passTokenPattern = /^[A-Za-z0-9_-]{43}$/;

/**
 * A visitor's Connection Pass lives in an HttpOnly cookie scoped by name to one
 * profile and one Mode, so a Personal pass can never be read for Event or Business.
 * The server re-validates it against the database on every read.
 */
export function visitorPassCookie(username: string, mode: ModeSlug) {
  return `sv-pass-${username}-${mode}`;
}

/** The owner's own current pass per Mode, kept so Connect in person reuses it. */
export function ownerPassCookie(mode: ModeSlug) {
  return `sv-own-pass-${mode}`;
}

export function profilePath(username: string, mode: ModeSlug) {
  return `/${username}${mode === "personal" ? "" : `?mode=${mode}`}`;
}
