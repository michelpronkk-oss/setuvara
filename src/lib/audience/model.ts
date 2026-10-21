/**
 * Audience: a member's confirmed Newsletter subscribers and the campaigns they send them. The database
 * (20261021140000_audience_core.sql) is the source of truth for consent, quotas and delivery; this file
 * mirrors it for the dashboard and the composer.
 */

import type { ModeSlug } from "@/components/profile/types";

export const CAMPAIGN_STATUSES = ["draft", "queued", "sending", "sent", "failed", "canceled"] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];
export const CAMPAIGN_STATUS_LABEL: Record<CampaignStatus, string> = { draft: "Draft", queued: "Queued", sending: "Sending", sent: "Sent", failed: "Failed", canceled: "Canceled" };

export const SUBJECT_MAX = 150;
export const PREHEADER_MAX = 150;
export const BODY_MAX = 20000;

export type Campaign = {
  id: string;
  mode_id: string | null;
  list_ids: string[];
  subject: string;
  preheader: string;
  body: string;
  reply_to: string | null;
  status: CampaignStatus;
  recipient_count: number;
  sent_count: number;
  failed_count: number;
  skipped_count: number;
  test_count: number;
  queued_at: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
};
export const CAMPAIGN_COLUMNS = "id, mode_id, list_ids, subject, preheader, body, reply_to, status, recipient_count, sent_count, failed_count, skipped_count, test_count, queued_at, started_at, finished_at, created_at, updated_at";

export type AudienceList = { id: string; title: string; status: string; mode: ModeSlug; subscribed: number; pending: number };
export type AudienceSummary = {
  people: number;
  pending: number;
  left: number;
  joined_30d: number;
  left_30d: number;
  lists: AudienceList[];
  daily: { day: string; joined: number; left: number }[];
};
export const EMPTY_SUMMARY: AudienceSummary = { people: 0, pending: 0, left: 0, joined_30d: 0, left_30d: 0, lists: [], daily: [] };

export type AudienceLimits = { plan: "free" | "plus" | "pro"; can_send: boolean; monthly_emails: number; daily_campaigns: number; campaign_tests: number; used_this_month: number; campaigns_today: number };
/** Defaults the migration installs; the database row wins when it is read. */
export const DEFAULT_AUDIENCE_LIMITS: Record<AudienceLimits["plan"], Omit<AudienceLimits, "used_this_month" | "campaigns_today">> = {
  free: { plan: "free", can_send: false, monthly_emails: 0, daily_campaigns: 0, campaign_tests: 0 },
  plus: { plan: "plus", can_send: true, monthly_emails: 2500, daily_campaigns: 2, campaign_tests: 5 },
  pro: { plan: "pro", can_send: true, monthly_emails: 20000, daily_campaigns: 10, campaign_tests: 10 },
};

/** Friendly copy for database refusals. */
export const AUDIENCE_ERRORS: Record<string, string> = {
  plan_send_unavailable: "Sending to your list comes with Plus.",
  plan_daily_campaigns: "You've sent today's campaigns. Try again tomorrow.",
  plan_monthly_emails: "This would go past this month's email allowance.",
  plan_campaign_tests: "That's all the test emails for this campaign.",
  campaign_no_recipients: "No one on these lists has confirmed yet.",
  campaign_subject_required: "Add a subject.",
  campaign_body_required: "Write something first.",
  campaign_list_required: "Pick at least one list.",
  campaign_list_invalid: "Pick lists from your own Newsletters.",
  campaign_locked: "This campaign has already gone out.",
};
export function audienceErrorMessage(message: string | undefined) {
  for (const [key, copy] of Object.entries(AUDIENCE_ERRORS)) if (message?.includes(key)) return copy;
  return "That didn't work. Try again.";
}

/** Campaign text: blank lines split paragraphs, bare https links become links. Nothing else is interpreted. */
export function campaignParagraphs(body: string) {
  return body.replace(/\r\n?/g, "\n").split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);
}
