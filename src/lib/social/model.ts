/**
 * Platform accounts connected by official sign-in. Counts come from the platform's own API and are
 * never typed in. Manual links stay links: they show a handle, never a number.
 */

export const SOCIAL_PROVIDERS = ["instagram", "tiktok", "youtube", "twitch"] as const;
export type SocialProvider = (typeof SOCIAL_PROVIDERS)[number];
export const isSocialProvider = (value: string): value is SocialProvider => (SOCIAL_PROVIDERS as readonly string[]).includes(value);

export const SOCIAL_NAME: Record<SocialProvider, string> = { instagram: "Instagram", tiktok: "TikTok", youtube: "YouTube", twitch: "Twitch" };
/** What each platform calls its audience. */
export const AUDIENCE_NOUN: Record<SocialProvider, string> = { instagram: "followers", tiktok: "followers", youtube: "subscribers", twitch: "followers" };
/** Platforms round or delay some numbers; this is what we tell the creator. */
export const COUNT_NOTE: Record<SocialProvider, string> = {
  instagram: "Professional accounts only.",
  tiktok: "",
  youtube: "YouTube rounds subscriber counts.",
  twitch: "",
};

export type SocialAccount = {
  id: string;
  provider: SocialProvider;
  username: string;
  display_name: string;
  profile_url: string | null;
  avatar_url: string | null;
  audience_count: number | null;
  audience_hidden: boolean;
  status: "connected" | "needs_reauth" | "error";
  last_synced_at: string | null;
  last_error: string | null;
  show_on_page: boolean;
  connected_at: string;
};
export const SOCIAL_ACCOUNT_COLUMNS = "id, provider, username, display_name, profile_url, avatar_url, audience_count, audience_hidden, status, last_synced_at, last_error, show_on_page, connected_at";

export type PublicPlatform = { provider: SocialProvider; username: string; display_name: string; profile_url: string | null; avatar_url: string | null; audience_count: number | null; last_synced_at: string | null };

/** A synced count older than this reads as outdated. The sync job refreshes every 6 hours. */
export const STALE_AFTER_MS = 48 * 60 * 60 * 1000;
/** The fewest minutes between two manual refreshes, to respect platform quotas. */
export const MANUAL_REFRESH_MINUTES = 10;

export type AccountState = "synced" | "outdated" | "needs_reauth" | "error";
export function accountState(account: Pick<SocialAccount, "status" | "last_synced_at">, now = Date.now()): AccountState {
  if (account.status === "needs_reauth") return "needs_reauth";
  if (account.status === "error") return "error";
  if (!account.last_synced_at || now - new Date(account.last_synced_at).getTime() > STALE_AFTER_MS) return "outdated";
  return "synced";
}
/** Public platforms with a count synced in the last 48 hours: older numbers are not shown as verified. */
export function freshPlatforms<T extends Pick<PublicPlatform, "audience_count" | "last_synced_at">>(platforms: T[], now = Date.now()) {
  return platforms.filter((item) => item.audience_count !== null && item.last_synced_at !== null && now - new Date(item.last_synced_at).getTime() <= STALE_AFTER_MS);
}
export const ACCOUNT_STATE_LABEL: Record<AccountState, string> = { synced: "Verified", outdated: "Outdated", needs_reauth: "Sign in again", error: "Sync failed" };

/** 284K, 61.4K, 1.2M. Never rounds up past what the platform gave. */
export function formatAudience(count: number) {
  if (count < 1000) return String(count);
  const units: [number, string][] = [[1e9, "B"], [1e6, "M"], [1e3, "K"]];
  for (const [size, suffix] of units) {
    if (count >= size) {
      const value = count / size;
      const digits = value >= 100 ? 0 : 1;
      const floored = Math.floor(value * 10 ** digits) / 10 ** digits;
      return `${floored.toFixed(digits).replace(/\.0$/, "")}${suffix}`;
    }
  }
  return String(count);
}

/**
 * The combined number is a sum of platform audiences, not unique people: one person can follow on
 * several platforms. Returns null when fewer than two counts are known.
 */
export function combinedAudience(accounts: Pick<SocialAccount, "audience_count" | "audience_hidden" | "status">[]) {
  const counts = accounts.filter((item) => item.status === "connected" && !item.audience_hidden && item.audience_count !== null).map((item) => item.audience_count as number);
  return counts.length >= 2 ? { total: counts.reduce((sum, count) => sum + count, 0), platforms: counts.length } : null;
}
export const COMBINED_LABEL = "Combined platform audience";
export const COMBINED_NOTE = "A sum of each platform's audience. One person can follow on several platforms.";
