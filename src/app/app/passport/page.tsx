import { redirect } from "next/navigation";
import { PassportDashboard, type PassportData } from "./passport-dashboard";
import { PassportUnavailable } from "./passport-states";
import { createClient } from "@/lib/supabase/server";
import { getViewerPlan } from "@/lib/app/viewer";

export default async function PassportPage() {
  const supabase = await createClient();
  const { data: claims, error: authError } = await supabase.auth.getClaims();
  const userId = typeof claims?.claims?.sub === "string" ? claims.claims.sub : null;
  if (authError || !userId) redirect("/login?next=/app/passport");
  const [{ data: profile }, { data: result, error }, billing] = await Promise.all([
    supabase.from("profiles").select("username,display_name,created_at").eq("id", userId).maybeSingle(),
    supabase.rpc("get_passport_overview"),
    getViewerPlan(userId),
  ]);
  if (!profile || error || !result) return <PassportUnavailable />;
  const overview = result as Partial<PassportData>;
  const stamps = Array.isArray(overview.stamps) ? overview.stamps : [];
  const data: PassportData = {
    connectionCount: overview.connectionCount ?? 0,
    cities: overview.cities ?? 0,
    events: overview.events ?? 0,
    countries: overview.countries ?? 0,
    stampTotal: overview.stampTotal ?? stamps.length,
    hasMoreStamps: overview.hasMoreStamps ?? stamps.length >= 100,
    milestones: Array.isArray(overview.milestones) ? overview.milestones : [],
    rewards: Array.isArray(overview.rewards) ? overview.rewards : [],
    stamps,
    preferences: overview.preferences ?? {},
    presentation: overview.presentation ?? {
      coverId: "standard",
      memberFinishEnabled: null,
      featuredStampId: null,
      featuredStamp: null,
    },
  };
  return <PassportDashboard displayName={profile.display_name} initialData={data} plan={billing.plan} since={profile.created_at ?? null} username={profile.username} />;
}
