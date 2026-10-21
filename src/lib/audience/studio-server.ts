import "server-only";

import { cache } from "react";

import type { ModeSlug } from "@/components/profile/types";
import { loadModeActions } from "@/lib/actions/studio-server";
import { CAMPAIGN_COLUMNS, DEFAULT_AUDIENCE_LIMITS, EMPTY_SUMMARY, type AudienceLimits, type AudienceSummary, type Campaign } from "./model";

/** Where the Audience lives in the app. Creator keeps it inside the Creator studio. */
export function audienceBase(slug: ModeSlug) {
  return slug === "creator" ? "/app/identity/creator/audience" : "/app/identity/audience";
}
export function audienceHref(slug: ModeSlug, path = "") {
  return `${audienceBase(slug)}${path}${slug === "creator" ? "" : `?mode=${slug}`}`;
}

export type AudiencePerson = { id: string; action_id: string; name: string; email: string | null; status: "subscribed" | "pending_verification"; verified_at: string | null; created_at: string };

/**
 * The signed-in member's Audience, seen from one Mode: numbers and growth across every list, the
 * newest subscribers and the campaign history. Everything is read as the owner, under RLS.
 */
export const loadAudience = cache(async (slug: ModeSlug, next: string) => {
  const data = await loadModeActions(slug, next);
  if (!data.mode) return { ...data, ready: false as const };
  const { supabase } = data;
  const [summary, limits, campaigns, people] = await Promise.all([
    supabase.rpc("my_audience_summary"),
    supabase.rpc("my_audience_limits"),
    supabase.from("audience_campaigns").select(CAMPAIGN_COLUMNS).order("created_at", { ascending: false }).limit(60),
    supabase.from("action_submissions").select("id, action_id, name, email, status, verified_at, created_at").eq("kind", "newsletter").in("status", ["subscribed", "pending_verification"]).order("created_at", { ascending: false }).limit(500),
  ]);
  const ready = !summary.error && !limits.error && !campaigns.error;
  return {
    ...data,
    ready,
    summary: (summary.data as AudienceSummary | null) ?? EMPTY_SUMMARY,
    audienceLimits: (limits.data as AudienceLimits | null) ?? { ...DEFAULT_AUDIENCE_LIMITS.free, used_this_month: 0, campaigns_today: 0 },
    campaigns: (campaigns.data ?? []) as unknown as Campaign[],
    people: (people.data ?? []) as AudiencePerson[],
  };
});
