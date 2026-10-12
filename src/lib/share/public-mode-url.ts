import type { ModeSlug } from "@/components/profile/types";

/**
 * Builds the public URL for one of the owner's Modes. The default Personal
 * Mode lives at the canonical username URL; Event and Business use their
 * opaque share URL (`/s/<token>`) from the server and never a `?mode=` query.
 * Returns "" when a non-default Mode has no share URL yet.
 */
export function publicModeUrl({ origin, username, shareUrls, mode, source }: {
  origin: string;
  username: string;
  shareUrls: Partial<Record<ModeSlug, string | null>>;
  mode: ModeSlug;
  source?: string;
}) {
  const base = mode === "personal" ? `${origin}/${username}` : shareUrls[mode] ?? null;
  if (!base) return "";
  if (!source) return base;
  const url = new URL(base);
  url.searchParams.set("source", source);
  return url.toString();
}
