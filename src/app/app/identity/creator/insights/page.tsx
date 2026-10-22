import type { Metadata } from "next";

import { InsightsView } from "@/components/creator/insights-view";
import { analyticsCapabilities } from "@/lib/analytics/capabilities";
import { resolveAnalyticsQuery } from "@/lib/analytics/range";
import { getProfileAnalyticsReport, type ProfileAnalyticsReport } from "@/lib/analytics/server";
import { getViewerPlan } from "@/lib/app/viewer";
import { ORDER_COLUMNS, type CommerceOrder, type DayStat, type RefundRow } from "@/lib/commerce/model";
import { DEAL_COLUMNS, type Deal, type DealActivity } from "@/lib/creator/deals";
import { audienceInsight, dealInsight, rangeSince, storeInsight, type Subscriber } from "@/lib/creator/insights";
import { loadCreatorStudio } from "@/lib/creator/studio-server";

export const metadata: Metadata = { title: "Insights · Creator · Setuvara" };

const RANGES = [{ value: "7d", label: "7 days", say: "Last 7 days", days: 7 }, { value: "30d", label: "30 days", say: "Last 30 days", days: 30 }, { value: "90d", label: "90 days", say: "Last 90 days", days: 90 }] as const;

export default async function CreatorInsightsPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const [studio, query] = await Promise.all([loadCreatorStudio("/app/identity/creator/insights"), searchParams]);
  if (!studio.mode) return null;
  const { plan } = await getViewerPlan(studio.userId);
  const capabilities = analyticsCapabilities(plan);
  const range = RANGES.find((item) => item.value === query.range && capabilities.availableRanges.includes(item.value)) ?? RANGES[0];
  // Creator-only numbers need the Mode filter, which comes with Plus. Free sees what Setuvara itself holds.
  const resolved = capabilities.modeBreakdown ? resolveAnalyticsQuery(new URLSearchParams({ range: range.value, mode: "creator" }), capabilities) : null;
  // The report and the creator's own rows load side by side.
  const reportLoad: Promise<ProfileAnalyticsReport | null> = resolved?.ok ? getProfileAnalyticsReport({ profileId: studio.userId, plan, query: resolved.data }).catch(() => null) : Promise.resolve(null);
  const since = rangeSince(range.days);
  const lists = studio.actions.filter((action) => action.kind === "newsletter").map((action) => action.id);
  const { supabase, userId } = studio;
  // Everything below is the creator's own rows under RLS; a table that isn't there yet reads as empty.
  const [report, subscribers, deals, moves, orders, refunds, stats, campaigns] = await Promise.all([
    reportLoad,
    lists.length ? supabase.from("action_submissions").select("email, status, verified_at, unsubscribed_at").eq("kind", "newsletter").in("action_id", lists).limit(20000) : Promise.resolve({ data: [] }),
    supabase.from("creator_deals").select(DEAL_COLUMNS).eq("creator_user_id", userId).limit(2000),
    supabase.from("creator_deal_activities").select("deal_id, kind, from_stage, created_at").eq("creator_user_id", userId).eq("kind", "stage").gte("created_at", since).limit(5000),
    supabase.from("creator_orders").select(ORDER_COLUMNS).eq("creator_user_id", userId).not("paid_at", "is", null).order("paid_at", { ascending: false }).limit(5000),
    supabase.from("creator_refunds").select("order_id, amount_minor, currency, status, platform_fee_refunded_minor, created_at").eq("creator_user_id", userId),
    supabase.from("creator_offer_daily_stats").select("offer_id, day, views, checkout_starts").eq("creator_user_id", userId).gte("day", since.slice(0, 10)),
    supabase.from("audience_campaigns").select("sent_count").eq("mode_id", studio.mode.id).eq("status", "sent").gte("finished_at", since),
  ]);
  const audience = audienceInsight((subscribers.data ?? []) as Subscriber[], range.days);
  const collabs = dealInsight((deals.data ?? []) as unknown as Deal[], (moves.data ?? []) as Pick<DealActivity, "deal_id" | "kind" | "from_stage" | "created_at">[], range.days);
  const store = storeInsight((orders.data ?? []) as unknown as CommerceOrder[], (refunds.data ?? []) as RefundRow[], (stats.data ?? []) as DayStat[], range.days);
  const emailsSent = (campaigns.data ?? []).reduce((total, row) => total + Number(row.sent_count ?? 0), 0);
  // Submissions span every Mode; only this page's Actions count here.
  const creatorActions = new Set(studio.actions.map((action) => action.id));
  const responses = studio.submissions.filter((item) => creatorActions.has(item.action_id) && item.kind !== "newsletter" && item.status !== "pending_verification" && item.status !== "spam" && item.created_at >= since).length;

  return (
    <InsightsView
      audience={audience}
      collabs={collabs}
      emailsSent={emailsSent}
      platforms={studio.socials}
      range={{ ...range, allowed: true }}
      ranges={RANGES.map((item) => ({ ...item, allowed: capabilities.availableRanges.includes(item.value) }))}
      report={report}
      responses={responses}
      store={store}
    />
  );
}
