import { z } from "zod";

import { getConfirmedBillingUser } from "@/lib/billing/auth";
import { createBillingAdminClient } from "@/lib/billing/admin";
import { isBillingInterval, isPaidPlanCode } from "@/lib/billing/catalog";
import { getProductId, readDodoConfiguration } from "@/lib/billing/config";
import { json, readJson } from "@/lib/billing/http";
import { classifyPlanChange } from "@/lib/billing/plan-change";
import { getDodoApiClient } from "@/lib/billing/provider";
import { productMatchesSetuvaraPrice } from "@/lib/billing/products";
import { selectEffectiveSubscription, type ProviderSubscriptionRecord } from "@/lib/billing/state";

const requestSchema = z.object({
  plan: z.string().refine(isPaidPlanCode),
  interval: z.string().refine(isBillingInterval),
  mode: z.enum(["preview", "apply"]),
}).strict();

type SubscriptionRow = ProviderSubscriptionRecord & { dodo_subscription_id: string; dodo_customer_id: string };

/**
 * Moves an existing paid subscription to another plan or interval. Upgrades apply now and
 * bill the prorated difference to the saved payment method (the change is kept back if that
 * payment fails). Downgrades take effect at the next renewal, so paid time is never lost.
 * The webhook (subscription.plan_changed) writes the new plan; this route never does.
 */
export async function POST(request: Request) {
  const parsed = await readJson(request, requestSchema);
  if (!parsed.ok) return json({ error: "invalid_request" }, 400);

  const idempotencyKey = request.headers.get("idempotency-key");
  if (parsed.data.mode === "apply" && (!idempotencyKey || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(idempotencyKey))) {
    return json({ error: "idempotency_key_required" }, 400);
  }

  const user = await getConfirmedBillingUser();
  if (!user) return json({ error: "unauthorized" }, 401);
  const config = readDodoConfiguration();
  if (!config) return json({ error: "billing_unavailable" }, 503);

  const { plan, interval, mode } = parsed.data;
  let productId: string;
  try {
    productId = getProductId(config, plan, interval);
  } catch {
    return json({ error: "billing_unavailable" }, 503);
  }

  try {
    const admin = createBillingAdminClient();
    const { data, error } = await admin
      .from("billing_subscriptions")
      .select("dodo_subscription_id,dodo_customer_id,plan_code,billing_interval,provider_status,current_period_end,cancel_at_next_billing_date,past_due_ends_at")
      .eq("user_id", user.id);
    if (error) throw error;
    const current = selectEffectiveSubscription((data ?? []) as SubscriptionRow[]);
    if (!current) return json({ error: "no_active_subscription" }, 409);
    if (current.provider_status !== "active") return json({ error: "subscription_not_active" }, 409);
    if (current.cancel_at_next_billing_date) return json({ error: "subscription_ending" }, 409);

    const kind = classifyPlanChange({ plan: current.plan_code, interval: current.billing_interval }, { plan, interval });
    if (kind === "same") return json({ error: "already_on_plan" }, 409);

    const { data: customer, error: customerError } = await admin.from("billing_customers")
      .select("dodo_customer_id").eq("user_id", user.id).maybeSingle();
    if (customerError) throw customerError;
    if (!customer || customer.dodo_customer_id !== current.dodo_customer_id) return json({ error: "billing_unavailable" }, 503);

    const client = getDodoApiClient();
    const [product, live] = await Promise.all([
      client.products.retrieve(productId),
      client.subscriptions.retrieve(current.dodo_subscription_id),
    ]);
    if (product.product_id !== productId || !productMatchesSetuvaraPrice(product, plan, interval)) {
      return json({ error: "billing_product_misconfigured" }, 503);
    }
    if (live.customer.customer_id !== customer.dodo_customer_id || live.status !== "active") {
      return json({ error: "subscription_not_active" }, 409);
    }
    if (live.product_id === productId) return json({ error: "already_on_plan" }, 409);

    const change = kind === "upgrade"
      ? {
          product_id: productId,
          quantity: 1,
          proration_billing_mode: "prorated_immediately" as const,
          effective_at: "immediately" as const,
          on_payment_failure: "prevent_change" as const,
          cancel_scheduled_change_plan: true,
        }
      : {
          product_id: productId,
          quantity: 1,
          proration_billing_mode: "do_not_bill" as const,
          effective_at: "next_billing_date" as const,
          cancel_scheduled_change_plan: true,
        };

    if (mode === "preview") {
      if (kind === "downgrade") {
        return json({ kind, effectiveAt: live.next_billing_date, amountMinor: 0, currency: product.price.currency });
      }
      const preview = await client.subscriptions.previewChangePlan(current.dodo_subscription_id, change);
      return json({
        kind,
        effectiveAt: preview.immediate_charge.effective_at,
        amountMinor: preview.immediate_charge.summary.total_amount,
        currency: preview.immediate_charge.summary.currency,
      });
    }

    await client.subscriptions.changePlan(current.dodo_subscription_id, change, { idempotencyKey: `setuvara-plan-${idempotencyKey}` });
    return json({ kind, effectiveAt: kind === "upgrade" ? new Date().toISOString() : live.next_billing_date });
  } catch {
    return json({ error: "billing_unavailable" }, 503);
  }
}
