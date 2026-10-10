import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { AnalyticsDashboard } from "@/components/app/analytics/analytics-dashboard";
import { getPublicOrigin, getViewerPlan } from "@/lib/app/viewer";
import { createClient } from "@/lib/supabase/server";
import { WALLET_PUBLICLY_LAUNCHED } from "@/lib/wallet/launch";

export const metadata: Metadata = {
  title: "Analytics · Setuvara",
  description: "See how people find and connect through your Setuvara.",
};

export default async function AnalyticsPage() {
  const supabase = await createClient();
  const { data: claims, error } = await supabase.auth.getClaims();
  const userId = typeof claims?.claims?.sub === "string" ? claims.claims.sub : null;
  if (error || !userId) redirect("/login?next=/app/analytics");

  const [{ data: profile }, { data: personal }, viewer, requestHeaders] = await Promise.all([
    supabase.from("profiles").select("username, is_published").eq("id", userId).maybeSingle(),
    supabase.from("profile_modes").select("is_enabled").eq("profile_id", userId).eq("slug", "personal").maybeSingle(),
    getViewerPlan(userId),
    headers(),
  ]);
  const origin = await getPublicOrigin(requestHeaders);
  // Same copy-link URL as the Home share sheet: only offered while the profile is live.
  const shareUrl = profile?.username && profile.is_published && personal?.is_enabled
    ? `${origin}/${profile.username}?source=link`
    : null;

  return <AnalyticsDashboard initialPlan={viewer.plan} shareMode="personal" shareUrl={shareUrl} walletLaunched={WALLET_PUBLICLY_LAUNCHED} />;
}
