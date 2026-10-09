import { z } from "zod";

import { createBillingAdminClient } from "@/lib/billing/admin";
import { readDodoConfiguration } from "@/lib/billing/config";
import { getDodoApiClient, getDodoWebhookClient } from "@/lib/billing/provider";
import { mapConfiguredProduct } from "@/lib/billing/products";

export const runtime = "nodejs";

const genericEventSchema = z.object({
  type: z.string().min(1).max(100),
  timestamp: z.string().datetime({ offset: true }),
}).passthrough();

const subscriptionEventSchema = genericEventSchema.extend({
  data: z.object({
    subscription_id: z.string().regex(/^sub_[A-Za-z0-9]+$/),
    customer: z.object({ customer_id: z.string().regex(/^cus_[A-Za-z0-9]+$/) }),
    past_due_ends_at: z.string().datetime({ offset: true }).nullable().optional(),
  }).passthrough(),
}).passthrough();

const subscriptionEvents = new Set([
  "subscription.active",
  "subscription.updated",
  "subscription.renewed",
  "subscription.plan_changed",
  "subscription.on_hold",
  "subscription.paused",
  "subscription.unpaused",
  "subscription.cancelled",
  "subscription.failed",
  "subscription.expired",
  "subscription.past_due",
  "subscription.update_payment_method",
]);

const validStatuses = new Set(["pending", "active", "on_hold", "paused", "cancelled", "failed", "expired", "past_due"]);

async function updateWebhook(admin: ReturnType<typeof createBillingAdminClient>, eventId: string, status: "processed" | "ignored" | "failed", code?: string) {
  await admin.from("billing_webhook_events").update({
    processing_status: status,
    processed_at: new Date().toISOString(),
    safe_error_code: code ?? null,
  }).eq("provider_event_id", eventId);
}

export async function POST(request: Request) {
  const eventId = request.headers.get("webhook-id") ?? "";
  const signature = request.headers.get("webhook-signature") ?? "";
  const timestamp = request.headers.get("webhook-timestamp") ?? "";
  if (!/^[A-Za-z0-9_.:-]{1,160}$/.test(eventId) || !signature || !timestamp) {
    return Response.json({ error: "invalid_webhook" }, { status: 401 });
  }

  const rawBody = await request.text();
  if (rawBody.length > 1_000_000) return Response.json({ error: "payload_too_large" }, { status: 413 });

  let event: unknown;
  try {
    event = getDodoWebhookClient().webhooks.unwrap(rawBody, {
      headers: {
        "webhook-id": eventId,
        "webhook-signature": signature,
        "webhook-timestamp": timestamp,
      },
    });
  } catch {
    return Response.json({ error: "invalid_webhook" }, { status: 401 });
  }

  const genericParsed = genericEventSchema.safeParse(event);
  if (!genericParsed.success) return Response.json({ error: "invalid_webhook" }, { status: 400 });
  const payload = genericParsed.data;
  const subscriptionPayload = subscriptionEvents.has(payload.type)
    ? subscriptionEventSchema.safeParse(event)
    : null;
  if (subscriptionPayload && !subscriptionPayload.success) {
    return Response.json({ error: "invalid_webhook" }, { status: 400 });
  }
  const admin = createBillingAdminClient();

  try {
    const { data: claim, error: claimError } = await admin.rpc("claim_billing_webhook_event", {
      p_provider_event_id: eventId,
      p_event_type: payload.type,
      p_received_at: payload.timestamp,
    });
    if (claimError) return Response.json({ error: "webhook_temporarily_unavailable" }, { status: 503 });
    if (claim === "duplicate") return Response.json({ received: true });
    if (claim === "busy") return Response.json({ error: "webhook_in_progress" }, { status: 503 });
    if (claim !== "claimed") return Response.json({ error: "webhook_temporarily_unavailable" }, { status: 503 });

    if (!subscriptionEvents.has(payload.type)) {
      await updateWebhook(admin, eventId, "ignored");
      return Response.json({ received: true });
    }

    if (!subscriptionPayload?.success) return Response.json({ received: true });
    const subscriptionData = subscriptionPayload.data;

    const config = readDodoConfiguration();
    if (!config) {
      await updateWebhook(admin, eventId, "failed", "billing_provider_unconfigured");
      return Response.json({ error: "webhook_temporarily_unavailable" }, { status: 503 });
    }

    const subscriptionId = subscriptionData.data.subscription_id;
    const eventCustomerId = subscriptionData.data.customer.customer_id;
    const { data: mapping, error: mappingError } = await admin.from("billing_customers")
      .select("user_id,dodo_customer_id").eq("dodo_customer_id", eventCustomerId).maybeSingle();
    if (mappingError) throw new Error("billing_mapping_unavailable");
    if (!mapping) {
      await updateWebhook(admin, eventId, "ignored", "billing_customer_mapping_missing");
      return Response.json({ received: true });
    }

    const subscription = await getDodoApiClient().subscriptions.retrieve(subscriptionId);
    if (
      subscription.subscription_id !== subscriptionId ||
      subscription.customer.customer_id !== mapping.dodo_customer_id ||
      subscription.customer.customer_id !== eventCustomerId ||
      !validStatuses.has(subscription.status) ||
      !/^pdt_[A-Za-z0-9]+$/.test(subscription.product_id)
    ) throw new Error("billing_subscription_verification_failed");

    const plan = mapConfiguredProduct(subscription.product_id, config.products);
    const syncStartedAt = new Date().toISOString();
    const { error: syncError } = await admin.rpc("sync_billing_subscription", {
      p_user_id: mapping.user_id,
      p_dodo_subscription_id: subscription.subscription_id,
      p_dodo_customer_id: subscription.customer.customer_id,
      p_dodo_product_id: subscription.product_id,
      p_plan_code: plan?.plan ?? null,
      p_billing_interval: plan?.interval ?? null,
      p_provider_status: subscription.status,
      p_provider_created_at: subscription.created_at,
      p_current_period_start: subscription.previous_billing_date,
      p_current_period_end: subscription.next_billing_date,
      p_cancel_at_next_billing_date: subscription.cancel_at_next_billing_date,
      p_cancelled_at: subscription.cancelled_at ?? null,
      p_past_due_ends_at: subscriptionData.data.past_due_ends_at ?? null,
      p_provider_event_id: eventId,
      p_provider_event_at: payload.timestamp,
      p_sync_started_at: syncStartedAt,
    });
    if (syncError) throw new Error("billing_subscription_sync_failed");

    if (subscription.status === "active" || payload.type === "subscription.plan_changed") {
      await admin.from("billing_checkout_attempts").update({ status: "complete", updated_at: syncStartedAt })
        .eq("user_id", mapping.user_id).eq("dodo_product_id", subscription.product_id)
        .in("status", ["open", "creating"]);
    }
    await updateWebhook(admin, eventId, "processed");
    return Response.json({ received: true });
  } catch {
    await updateWebhook(admin, eventId, "failed", "billing_webhook_processing_failed");
    return Response.json({ error: "webhook_temporarily_unavailable" }, { status: 503 });
  }
}
