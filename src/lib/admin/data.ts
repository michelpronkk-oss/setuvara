import "server-only";

import { getInternalAnalyticsAggregate } from "@/lib/analytics/server";
import { createBillingAdminClient } from "@/lib/billing/admin";
import { getPublicPlan, type BillingInterval, type PlanCode } from "@/lib/billing/catalog";
import {
  resolveBillingSnapshot,
  selectEffectiveSubscription,
  type BillingSnapshot,
  type ProviderSubscriptionRecord,
} from "@/lib/billing/state";

/** Every admin read goes through a server-only SECURITY DEFINER function granted to service_role alone. */
async function rpc<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await createBillingAdminClient().rpc(name, args);
  if (error) throw new Error(`${name}_unavailable`);
  return data as T;
}

export const ADMIN_RANGES = [7, 30, 90] as const;
export type AdminRange = (typeof ADMIN_RANGES)[number];

export function parseRange(value: unknown): AdminRange {
  const days = Number(value);
  return (ADMIN_RANGES as readonly number[]).includes(days) ? days as AdminRange : 30;
}

export function rangeDates(days: number) {
  const today = new Date();
  const end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const start = new Date(end.getTime() - (days - 1) * 86_400_000);
  return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) };
}

type Subscription = ProviderSubscriptionRecord & { billing_interval: string | null; plan_code: string | null };

export type ModeUsage = { slug: string; enabled: number; with_photo: number; with_content: number; views: number; shares: number; encounters: number };

export type Overview = {
  accounts: { total: number; confirmed: number; new_in_range: number; new_in_previous: number; signed_in_7d: number; signed_in_30d: number };
  profiles: { total: number; published: number; with_bio: number };
  activation: { cohort: number; profile_created: number; published: number; identity_completed: number; first_share: number; first_connection: number };
  engagement: { profile_views: number; profile_shares: number; qr_scans: number; connections: number; members_viewed: number; members_shared: number };
  engagement_previous: { profile_views: number; profile_shares: number; connections: number };
  connections: { total: number; with_members: number; with_guests: number; encounters_in_range: number };
  daily: { date: string; signups: number; views: number; shares: number; connections: number }[];
  modes: ModeUsage[];
  sources: { source: string; count: number }[];
  devices: { device: string; count: number }[];
};

export type SiteTraffic = {
  recording_since: string | null;
  totals: { views: number; views_previous: number; home: number; home_previous: number; countries: number };
  daily: { date: string; views: number; home: number }[];
  pages: { page: string; count: number }[];
  countries: { country: string | null; count: number }[];
};

export type Journey = {
  guestConnections: number;
  guestClaims: number;
  firstShares: number;
  repeatShares: number;
  newConnectionsAfterFirstShare: number;
};

function count(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0;
}

export async function getOverview(days: AdminRange) {
  const { from, to } = rangeDates(days);
  const [overview, traffic, journeyPayload, billing] = await Promise.all([
    rpc<Overview>("admin_overview", { p_from: from, p_to: to }),
    // Site traffic arrived after the console; until its migration runs the section says so.
    rpc<SiteTraffic>("admin_site_traffic", { p_from: from, p_to: to }).catch(() => null),
    // The existing internal product report (same source as /internal/analytics) covers the guest journey.
    getInternalAnalyticsAggregate(from, to).catch(() => null),
    getBillingOverview(),
  ]);
  const summary = (journeyPayload?.summary ?? {}) as Record<string, unknown>;
  const journey: Journey | null = journeyPayload ? {
    guestConnections: count(summary.guest_connections),
    guestClaims: count(summary.guest_claims),
    firstShares: count(summary.first_shares),
    repeatShares: count(summary.repeat_shares),
    newConnectionsAfterFirstShare: count(summary.new_connections_after_first_share),
  } : null;
  return { from, to, overview, traffic, journey, plans: billing.plans };
}

/* Billing */

export type SubscriptionRow = Subscription & {
  user_id: string;
  username: string | null;
  display_name: string | null;
  dodo_subscription_id: string;
  last_provider_event_at: string | null;
  created_at: string;
};

type BillingPayload = {
  subscriptions: SubscriptionRow[];
  checkouts_30d: Record<string, number>;
  webhooks_30d: { event_type: string; status: string; count: number; last_at: string }[];
  customers: number;
};

export type PaidMember = {
  userId: string;
  username: string | null;
  displayName: string | null;
  snapshot: BillingSnapshot;
  subscriptionId: string;
  monthlyListMinor: number;
};

/** Monthly list price of a plan: yearly plans are spread over twelve months. */
export function monthlyListPriceMinor(plan: PlanCode, interval: BillingInterval | null) {
  const catalog = getPublicPlan(plan);
  if (interval === "yearly") return Math.round(catalog.yearlyPriceMinor / 12);
  if (interval === "monthly") return catalog.monthlyPriceMinor;
  return 0;
}

/**
 * Plans are resolved with the app's own rules (selectEffectiveSubscription), so the admin view
 * says exactly what the product grants: a row only counts while it grants access today.
 */
export async function getBillingOverview() {
  const payload = await rpc<BillingPayload>("admin_billing_overview");
  const byUser = new Map<string, SubscriptionRow[]>();
  for (const row of payload.subscriptions) byUser.set(row.user_id, [...(byUser.get(row.user_id) ?? []), row]);

  const paid: PaidMember[] = [];
  for (const [userId, rows] of byUser) {
    const selected = selectEffectiveSubscription(rows);
    if (!selected) continue;
    const snapshot = resolveBillingSnapshot(rows);
    paid.push({
      userId,
      username: selected.username,
      displayName: selected.display_name,
      snapshot,
      subscriptionId: selected.dodo_subscription_id,
      monthlyListMinor: monthlyListPriceMinor(snapshot.plan, snapshot.interval),
    });
  }
  paid.sort((left, right) => right.monthlyListMinor - left.monthlyListMinor || (left.username ?? "").localeCompare(right.username ?? ""));

  const plans = {
    plus: paid.filter((member) => member.snapshot.plan === "plus").length,
    pro: paid.filter((member) => member.snapshot.plan === "pro").length,
    yearly: paid.filter((member) => member.snapshot.interval === "yearly").length,
    cancelling: paid.filter((member) => member.snapshot.cancelAtPeriodEnd).length,
    pastDue: paid.filter((member) => member.snapshot.status === "past_due").length,
    listRunRateMinor: paid.reduce((sum, member) => sum + member.monthlyListMinor, 0),
  };

  const now = Date.now();
  const lapsed = payload.subscriptions.filter((row) => !selectEffectiveSubscription([row], now) && row.provider_status === "active");

  return { ...payload, paid, plans, lapsed, paidUserIds: paid.map((member) => member.userId) };
}

/* Members */

export type MemberListRow = {
  id: string;
  email: string | null;
  username: string | null;
  display_name: string | null;
  is_published: boolean | null;
  created_at: string;
  last_sign_in_at: string | null;
  email_confirmed: boolean;
  banned: boolean;
  connections: number;
  views_30d: number;
  subscriptions: Subscription[];
};

export const MEMBER_PAGE_SIZE = 25;
export const MEMBER_FILTERS = ["all", "paid", "free", "unpublished"] as const;
export type MemberFilter = (typeof MEMBER_FILTERS)[number];

export async function listMembers(input: { query: string; filter: MemberFilter; page: number }) {
  const paidIds = input.filter === "paid" || input.filter === "free" ? (await getBillingOverview()).paidUserIds : null;
  const payload = await rpc<{ total: number; rows: MemberListRow[] }>("admin_list_members", {
    p_query: input.query || null,
    p_include: input.filter === "paid" ? paidIds : null,
    p_exclude: input.filter === "free" ? paidIds : null,
    p_unpublished_only: input.filter === "unpublished",
    p_limit: MEMBER_PAGE_SIZE,
    p_offset: (input.page - 1) * MEMBER_PAGE_SIZE,
  });
  return { total: payload.total, rows: payload.rows.map((row) => ({ ...row, billing: resolveBillingSnapshot(row.subscriptions) })) };
}

export type MemberDetail = {
  account: {
    id: string; email: string | null; created_at: string; last_sign_in_at: string | null; email_confirmed_at: string | null;
    banned_until: string | null; banned: boolean; deleted_at: string | null; providers: string[]; mfa_factors: number;
  };
  profile: { username: string; display_name: string; bio: string | null; is_published: boolean; created_at: string; updated_at: string } | null;
  modes: { slug: string; label: string; is_enabled: boolean; connect_policy: string; has_photo: boolean; theme: string | null; blocks: number; links: number; updated_at: string }[];
  counts: { links: number; connections: number; guest_connections: number; encounters: number; passport_stamps: number; tap_devices: number };
  activity_30d: { profile_views: number; profile_shares: number; qr_scans: number; connections: number; last_event_at: string | null };
  subscriptions: (Subscription & {
    dodo_subscription_id: string; dodo_customer_id: string; current_period_start: string | null; cancelled_at: string | null;
    last_provider_event_at: string | null; synchronized_at: string | null; created_at: string;
  })[];
  checkouts: { plan_code: string; billing_interval: string; status: string; created_at: string }[];
  feedback: { id: string; kind: string; status: string; message: string; created_at: string }[];
  emails: { template_key: string; category: string; status: string; failure_code: string | null; sent_at: string | null; created_at: string }[];
  admin_role: string | null;
};

export async function getMemberDetail(userId: string) {
  const detail = await rpc<MemberDetail | null>("admin_member_detail", { p_user_id: userId });
  if (!detail) return null;
  return { ...detail, billing: resolveBillingSnapshot(detail.subscriptions) };
}

/* Feedback */

export const FEEDBACK_STATUSES = ["open", "reviewing", "done"] as const;
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];

export type FeedbackRow = {
  id: string; user_id: string; username: string | null; display_name: string | null; email: string | null;
  kind: string; message: string; has_screenshot: boolean; route: string | null; mode: string | null; plan: string | null;
  viewport: string | null; locale: string | null; user_agent: string | null; status: FeedbackStatus; created_at: string; updated_at: string;
};

export async function listFeedback(status: FeedbackStatus | null, page: number) {
  return rpc<{ total: number; rows: FeedbackRow[] }>("admin_list_feedback", {
    p_status: status, p_limit: 30, p_offset: (page - 1) * 30,
  });
}

/* Health, audit, access */

export type Health = {
  checked_at: string;
  webhooks: { last_received_at: string | null; received_7d: number; failed_7d: number; stuck: number };
  webhook_failures: { event_type: string; error: string | null; attempts: number; received_at: string }[];
  emails: { last_sent_at: string | null; sent_7d: number; failed_7d: number; suppressed_7d: number; overdue: number };
  email_failures: { template_key: string; error: string | null; attempts: number; created_at: string }[];
  checkouts: { open: number; failed_7d: number; stale_open: number };
  analytics: { last_event_at: string | null; events_24h: number };
  feedback: { open: number; reviewing: number; oldest_open_at: string | null };
  accounts: { unconfirmed_over_24h: number; without_profile: number };
};

export async function getHealth() {
  return rpc<Health>("admin_health");
}

export type AuditRow = {
  id: number; occurred_at: string; actor_user_id: string | null; actor_email: string | null; actor_role: string | null;
  action: string; target_type: string | null; target_id: string | null;
  before: Record<string, unknown> | null; after: Record<string, unknown> | null; context: Record<string, unknown>;
};

export async function listAudit(input: { targetType?: string; targetId?: string; page: number; pageSize?: number }) {
  const pageSize = input.pageSize ?? 50;
  return rpc<{ total: number; rows: AuditRow[] }>("admin_list_audit", {
    p_target_type: input.targetType ?? null,
    p_target_id: input.targetId ?? null,
    p_limit: pageSize,
    p_offset: (input.page - 1) * pageSize,
  });
}

export type AdminMemberRow = {
  user_id: string; email: string | null; username: string | null; role: string; note: string | null;
  created_at: string; revoked_at: string | null; last_sign_in_at: string | null; mfa_factors: number;
};

export async function listAdmins() {
  return rpc<AdminMemberRow[]>("admin_list_admins");
}
