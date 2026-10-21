import "server-only";

import { createActionsServiceClient } from "@/lib/actions/server";
import { renderCampaignEmail, sendCampaignBatch } from "./mail";
import { signUnsubscribe } from "./token";

/** Sending stays off until this is set, so merging never mails anyone by itself. */
export function audienceSendEnabled() {
  return process.env.AUDIENCE_SEND_ENABLED === "true";
}

type Claimed = {
  campaign_id: string; profile_id: string; mode_id: string | null; batch_key: string;
  subject: string; preheader: string; body: string; reply_to: string | null; list_ids: string[];
  recipients: { id: string; email: string; name: string; attempts: number }[];
};

export function unsubscribeUrl(origin: string, recipientId: string) {
  return `${origin}/api/audience/unsubscribe?t=${encodeURIComponent(signUnsubscribe(recipientId))}`;
}

/**
 * Sends queued campaign emails in batches of up to 100 until the time budget runs out. Every batch
 * is claimed with a lease in the database, so two runs never send the same person, and a run that
 * dies mid-batch leaves it for the next run under the same idempotency key.
 */
export async function dispatchAudience({ campaignId = null, origin, budgetMs = 45_000 }: { campaignId?: string | null; origin: string; budgetMs?: number }) {
  if (!audienceSendEnabled()) return { batches: 0, sent: 0, failed: 0 };
  const service = createActionsServiceClient();
  const started = Date.now();
  const senders = new Map<string, { name: string; lists: string[] }>();
  let batches = 0, sent = 0, failed = 0;

  while (Date.now() - started < budgetMs) {
    const { data, error } = await service.rpc("claim_audience_batch", { p_campaign_id: campaignId, p_limit: 100 });
    if (error) { console.error("Audience claim failed", { code: error.code }); break; }
    const batch = data as Claimed | null;
    if (!batch?.recipients?.length) break;
    batches += 1;

    if (!senders.has(batch.campaign_id)) {
      const [{ data: profile }, { data: lists }] = await Promise.all([
        service.from("profiles").select("display_name").eq("id", batch.profile_id).maybeSingle(),
        service.from("profile_actions").select("title").in("id", batch.list_ids),
      ]);
      senders.set(batch.campaign_id, { name: profile?.display_name || "A Setuvara member", lists: (lists ?? []).map((item) => item.title) });
    }
    const sender = senders.get(batch.campaign_id)!;
    const emails = batch.recipients.map((recipient) => renderCampaignEmail({
      to: recipient.email, senderDisplay: sender.name, subject: batch.subject, preheader: batch.preheader, body: batch.body,
      replyTo: batch.reply_to, lists: sender.lists, unsubscribeUrl: unsubscribeUrl(origin, recipient.id),
    }));
    const result = await sendCampaignBatch(emails, `audience-${batch.batch_key}`);
    const ids = result.ok ? Object.fromEntries(batch.recipients.map((recipient, index) => [recipient.id, result.ids[index] ?? ""])) : {};
    // An unknown outcome (network) is left to the lease: the batch comes back with the same key.
    if (!result.ok && result.error === "network") { failed += batch.recipients.length; break; }
    const { error: completeError } = await service.rpc("complete_audience_batch", {
      p_batch_key: batch.batch_key, p_ok: result.ok, p_provider_ids: ids, p_error: result.ok ? null : result.error, p_retry: result.ok ? false : result.retry,
    });
    if (completeError) { console.error("Audience completion failed", { code: completeError.code }); break; }
    if (result.ok) sent += batch.recipients.length; else { failed += batch.recipients.length; break; }
    // Stay well under Resend's request rate.
    await new Promise((resolve) => setTimeout(resolve, 600));
  }
  return { batches, sent, failed };
}
