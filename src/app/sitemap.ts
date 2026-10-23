import type { MetadataRoute } from "next";

import { BLOG_POSTS } from "@/lib/marketing/blog-content";
import { COMPARE_ORDER } from "@/lib/marketing/compare-content";
import { FEATURE_ORDER } from "@/lib/marketing/features-content";
import { SETUVARA_ORIGIN } from "@/lib/marketing/metadata";
import { MODE_ORDER } from "@/lib/marketing/modes-content";
import { TEMPLATE_SLUGS } from "@/lib/marketing/templates-content";
import { TOOLS } from "@/lib/marketing/tools";
import { USE_CASE_ORDER } from "@/lib/marketing/use-cases-content";
import { createClient } from "@/lib/supabase/server";
import { isAllowedUsername, isTestUsername } from "@/lib/usernames";

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
  { url: `${SETUVARA_ORIGIN}/product`, changeFrequency: "monthly", priority: 0.7 },
  { url: `${SETUVARA_ORIGIN}/teams`, changeFrequency: "monthly", priority: 0.7 },
  { url: `${SETUVARA_ORIGIN}/roadmap`, changeFrequency: "monthly", priority: 0.7 },
  { url: `${SETUVARA_ORIGIN}/privacy`, changeFrequency: "yearly", priority: 0.3 },
  { url: `${SETUVARA_ORIGIN}/terms`, changeFrequency: "yearly", priority: 0.3 },
  { url: `${SETUVARA_ORIGIN}/cookies`, changeFrequency: "yearly", priority: 0.3 },
  { url: `${SETUVARA_ORIGIN}/refunds`, changeFrequency: "yearly", priority: 0.3 },
  { url: `${SETUVARA_ORIGIN}/data-deletion`, changeFrequency: "yearly", priority: 0.3 },
  { url: `${SETUVARA_ORIGIN}/modes`, changeFrequency: "monthly", priority: 0.8 },
  { url: `${SETUVARA_ORIGIN}/contact`, changeFrequency: "yearly", priority: 0.5 },
  { url: `${SETUVARA_ORIGIN}/what-is-setuvara`, changeFrequency: "monthly", priority: 0.8 },
  { url: `${SETUVARA_ORIGIN}/help`, changeFrequency: "monthly", priority: 0.6 },
  ...MODE_ORDER.map((slug) => ({ url: `${SETUVARA_ORIGIN}/${slug}`, changeFrequency: "monthly" as const, priority: 0.8 })),
  { url: `${SETUVARA_ORIGIN}/features`, changeFrequency: "monthly", priority: 0.7 },
  ...FEATURE_ORDER.map((slug) => ({ url: `${SETUVARA_ORIGIN}/features/${slug}`, changeFrequency: "monthly" as const, priority: 0.7 })),
  { url: `${SETUVARA_ORIGIN}/gallery`, changeFrequency: "daily", priority: 0.7 },
  { url: `${SETUVARA_ORIGIN}/templates`, changeFrequency: "monthly", priority: 0.7 },
  ...TEMPLATE_SLUGS.map((slug) => ({ url: `${SETUVARA_ORIGIN}/templates/${slug}`, changeFrequency: "monthly" as const, priority: 0.6 })),
  { url: `${SETUVARA_ORIGIN}/use-cases`, changeFrequency: "monthly", priority: 0.7 },
  ...USE_CASE_ORDER.map((slug) => ({ url: `${SETUVARA_ORIGIN}/use-cases/${slug}`, changeFrequency: "monthly" as const, priority: 0.7 })),
  { url: `${SETUVARA_ORIGIN}/compare`, changeFrequency: "monthly", priority: 0.7 },
  ...COMPARE_ORDER.map((slug) => ({ url: `${SETUVARA_ORIGIN}/compare/${slug}`, changeFrequency: "monthly" as const, priority: 0.7 })),
  { url: `${SETUVARA_ORIGIN}/tools`, changeFrequency: "monthly", priority: 0.6 },
  ...TOOLS.map((tool) => ({ url: `${SETUVARA_ORIGIN}${tool.path}`, changeFrequency: "monthly" as const, priority: 0.8 })),
  { url: `${SETUVARA_ORIGIN}/blog`, changeFrequency: "weekly", priority: 0.6 },
  ...BLOG_POSTS.map((post) => ({ url: `${SETUVARA_ORIGIN}/blog/${post.slug}`, lastModified: new Date(`${post.updated ?? post.published}T00:00:00Z`), changeFrequency: "yearly" as const, priority: 0.6 })),
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
        if (!profile || !isAllowedUsername(profile.username) || isTestUsername(profile.username)) continue;
        profiles.push({
          url: `${SETUVARA_ORIGIN}/${encodeURIComponent(profile.username)}`,
          lastModified: parseLastModified(row.updated_at, profile.updated_at),
          changeFrequency: "weekly",
          priority: 0.6,
        });
      }

      if (rows.length < profileBatchSize) break;
    }

    // Business and Creator handles whose owners turned search listing on.
    const room = profileUrlLimit - profiles.length;
    if (room > 0) {
      const { data: handles } = await supabase.rpc("list_indexed_mode_handles", { p_limit: room });
      for (const row of (handles ?? []) as { handle: string; updated_at: string | null }[]) {
        if (!isAllowedUsername(row.handle) || isTestUsername(row.handle)) continue;
        profiles.push({
          url: `${SETUVARA_ORIGIN}/${row.handle}`,
          lastModified: parseLastModified(row.updated_at, null),
          changeFrequency: "weekly",
          priority: 0.6,
        });
      }
    }

    return [...marketingUrls, ...profiles];
  } catch {
    // If public data is temporarily unavailable, keep the marketing sitemap valid.
    return marketingUrls;
  }
}
