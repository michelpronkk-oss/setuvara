import type { MetadataRoute } from "next";

import { SETUVARA_ORIGIN } from "@/lib/marketing/metadata";
import { createClient } from "@/lib/supabase/server";
import { isAllowedUsername } from "@/lib/usernames";

export const dynamic = "force-dynamic";

const profileBatchSize = 1000;
// Reserve space for all public marketing pages; partition before reaching Google's limit.
const sitemapUrlLimit = 50_000;

type SitemapProfileMode = {
  updated_at: string | null;
  profiles: { username: string; updated_at: string | null } | { username: string; updated_at: string | null }[] | null;
};

const marketingUrls: MetadataRoute.Sitemap = [
  { url: `${SETUVARA_ORIGIN}/`, changeFrequency: "weekly", priority: 1 },
  { url: `${SETUVARA_ORIGIN}/pricing`, changeFrequency: "monthly", priority: 0.8 },
  { url: `${SETUVARA_ORIGIN}/events`, changeFrequency: "monthly", priority: 0.7 },
  { url: `${SETUVARA_ORIGIN}/teams`, changeFrequency: "monthly", priority: 0.7 },
  { url: `${SETUVARA_ORIGIN}/roadmap`, changeFrequency: "monthly", priority: 0.7 },
];

const profileUrlLimit = sitemapUrlLimit - marketingUrls.length;

function parseLastModified(modeDate: string | null, profileDate: string | null) {
  const values = [modeDate, profileDate].filter((value): value is string => Boolean(value)).map((value) => new Date(value)).filter((value) => Number.isFinite(value.getTime()));
  return values.length ? new Date(Math.max(...values.map((value) => value.getTime()))) : undefined;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  try {
    const supabase = await createClient();
    const profiles: MetadataRoute.Sitemap = [];

    for (let start = 0; start < profileUrlLimit; start += profileBatchSize) {
      const end = Math.min(start + profileBatchSize - 1, profileUrlLimit - 1);
      const { data, error } = await supabase
        .from("profile_modes")
        .select("updated_at, profiles!inner(username, updated_at)")
        .eq("slug", "personal")
        .eq("is_enabled", true)
        .eq("profiles.is_published", true)
        .order("profile_id", { ascending: true })
        .range(start, end);

      if (error) return marketingUrls;
      const rows = (data ?? []) as unknown as SitemapProfileMode[];
      for (const row of rows) {
        const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
        if (!profile || !isAllowedUsername(profile.username)) continue;
        profiles.push({
          url: `${SETUVARA_ORIGIN}/${encodeURIComponent(profile.username)}`,
          lastModified: parseLastModified(row.updated_at, profile.updated_at),
          changeFrequency: "weekly",
          priority: 0.6,
        });
      }

      if (rows.length < profileBatchSize) break;
    }

    return [...marketingUrls, ...profiles];
  } catch {
    // If public data is temporarily unavailable, keep the marketing sitemap valid.
    return marketingUrls;
  }
}
