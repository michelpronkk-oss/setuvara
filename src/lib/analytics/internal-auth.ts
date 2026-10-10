import "server-only";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Checks a caller-verified Supabase user ID against a server-only allowlist.
 * The caller must verify the identity with Supabase Auth before calling this;
 * this function deliberately accepts no request, headers, or user metadata.
 */
export function isSetuvaraInternalAnalyticsAdmin(userId: string | null | undefined): boolean {
  if (!userId || !UUID_PATTERN.test(userId)) return false;

  const configured = process.env.SETUVARA_ANALYTICS_ADMIN_USER_IDS;
  if (!configured?.trim()) return false;

  const entries = configured.split(",").map((entry) => entry.trim());
  if (entries.length === 0 || entries.some((entry) => !UUID_PATTERN.test(entry))) return false;

  const allowedIds = new Set(entries.map((entry) => entry.toLowerCase()));
  return allowedIds.has(userId.toLowerCase());
}
