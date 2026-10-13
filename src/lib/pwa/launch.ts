import type { ModeSlug } from "@/components/profile/types";

/**
 * Home Screen launch. The installed app starts at `/app?launch=home`, where
 * Home opens its own Share sheet straight away on the Mode chosen for this
 * device. The choice lives in a cookie so the server can render the sheet
 * already open, without a flash of the dashboard.
 */
export const LAUNCH_PARAM = "launch";
export const LAUNCH_VALUE = "home";
export const LAUNCH_START_URL = `/app?${LAUNCH_PARAM}=${LAUNCH_VALUE}`;
export const LAUNCH_MODE_COOKIE = "sv-launch-mode";
/** Set once per app session, so only the cold launch opens Share, not every visit to Home. */
export const LAUNCH_SESSION_KEY = "sv-launched";

export const LAUNCH_MODES = ["personal", "event", "business"] as const satisfies readonly ModeSlug[];
export type LaunchMode = (typeof LAUNCH_MODES)[number];

export function parseLaunchMode(value: string | null | undefined): LaunchMode {
  return LAUNCH_MODES.includes(value as LaunchMode) ? (value as LaunchMode) : "personal";
}
