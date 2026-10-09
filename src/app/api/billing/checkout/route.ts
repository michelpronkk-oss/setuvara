import { z } from "zod";

import { getConfirmedBillingUser } from "@/lib/billing/auth";
import { getProductId, readDodoConfiguration, getSetuvaraOrigin, BillingUnavailableError } from "@/lib/billing/config";
import { isPaidPlanCode, isBillingInterval } from "@/lib/billing/catalog";
import { createBillingAdminClient } from "@/lib/billing/admin";
import { getDodoApiClient } from "@/lib/billing/provider";
import { productMatchesSetuvaraPrice } from "@/lib/billing/products";
import { resolveBillingSnapshot, type ProviderSubscriptionRecord } from "@/lib/billing/state";
import { json, readJson, safeProviderUrl } from "@/lib/billing/http";

const requestSchema = z.object({
  plan: z.string().refine(isPaidPlanCode),
  interval: z.string().refine(isBillingInterval),
}).strict();

export async function POST(request: Request) {
  const parsed = await readJson(request, requestSchema);
  if (!parsed.ok) return json({ error: "invalid_request" }, 400);

  const idempotencyKey = request.headers.get("idempotency-key");
  if (!idempotencyKey || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(idempotencyKey)) {
    return json({ error: "idempotency_key_required" }, 400);
  }

  const user = await getConfirmedBillingUser();
  if (!user) return json({ error: "unauthorized" }, 401);
  const config = readDodoConfiguration();
  if (!config) return json({ error: "billing_unavailable" }, 503);

  const plan = parsed.data.plan;
  const interval = parsed.data.interval;
  let productId: string;
  try {
    productId = getProductId(config, plan, interval);
  } catch {
    return json({ error: "billing_unavailable" }, 503);
  }

  const admin = createBillingAdminClient();
  try {
    const { data: existingSubscriptions, error: stateError } = await admin
      .from("billing_subscriptions")
      .select("plan_code,billing_interval,provider_status,current_period_end,cancel_at_next_billing_date,past_due_ends_at")
      .eq("user_id", user.id);
    if (stateError) throw stateError;
    const current = resolveBillingSnapshot((existingSubscriptions ?? []) as ProviderSubscriptionRecord[]);
    if (current.plan !== "free") return json({ error: "subscription_already_active" }, 409);

    const client = getDodoApiClient();
    const product = await client.products.retrieve(productId);
    if (product.product_id !== productId || !productMatchesSetuvaraPrice(product, plan, interval)) {
      return json({ error: "billing_product_misconfigured" }, 503);
    }

    const customerLookup = await admin
      .from("billing_customers")
      .select("dodo_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();
    let customerRow = customerLookup.data;
    const customerLookupError = customerLookup.error;
    if (customerLookupError) throw customerLookupError;

    if (!customerRow) {
      const customer = await client.customers.create({
        email: user.email,
        name: user.displayName,
        metadata: { setuvara_user_id: user.id },
      }, { idempotencyKey: `setuvara-customer-${user.id}` });
      const { error: mappingError } = await admin.from("billing_customers").insert({
        user_id: user.id,
        dodo_customer_id: customer.customer_id,
      });
      if (mappingError) {
        const retry = await admin.from("billing_customers")
          .select("dodo_customer_id").eq("user_id", user.id).maybeSingle();
        if (retry.error || !retry.data) throw mappingError;
        customerRow = retry.data;
      } else {
        customerRow = { dodo_customer_id: customer.customer_id };
      }
    }

    // Reconcile with Dodo before checkout so delayed webhooks cannot cause a
    // second paid subscription for the same Setuvara customer.
    for await (const subscription of client.subscriptions.list({ customer_id: customerRow.dodo_customer_id })) {
      if (["pending", "active", "on_hold", "paused", "past_due"].includes(subscription.status)) {
        return json({ error: "subscription_already_exists" }, 409);
      }
    }

    const { data: reservation, error: reserveError } = await admin.rpc("reserve_billing_checkout", {
      p_user_id: user.id,
      p_idempotency_key: idempotencyKey,
      p_plan_code: plan,
      p_billing_interval: interval,
      p_dodo_product_id: productId,
    });
    if (reserveError || !reservation || typeof reservation !== "object") throw reserveError;
    const reserved = reservation as {
      result?: string;
      attemptId?: string;
      sessionId?: string | null;
      checkoutUrl?: string | null;
      status?: string;
    };

    if (reserved.result === "existing" && reserved.status === "open" && reserved.checkoutUrl) {
      const checkoutUrl = safeProviderUrl(reserved.checkoutUrl, "checkout");
      return checkoutUrl && reserved.sessionId
        ? json({ checkoutUrl, sessionId: reserved.sessionId })
        : json({ error: "billing_unavailable" }, 503);
    }
    if (reserved.result === "checkout_in_progress") return json({ error: "checkout_in_progress" }, 409);
    if (reserved.result === "idempotency_conflict") return json({ error: "idempotency_conflict" }, 409);
    if (
      !reserved.attemptId ||
      !(reserved.result === "created" || (reserved.result === "existing" && reserved.status === "creating"))
    ) return json({ error: "checkout_expired" }, 409);

    try {
      const origin = getSetuvaraOrigin();
      const checkout = await client.checkoutSessions.create({
        product_cart: [{ product_id: productId, quantity: 1 }],
        customer: { customer_id: customerRow.dodo_customer_id },
        metadata: {
          setuvara_user_id: user.id,
          setuvara_plan: plan,
          setuvara_interval: interval,
        },
        return_url: `${origin}/app?billing=return`,
        cancel_url: `${origin}/app?billing=cancelled`,
      }, { idempotencyKey: reserved.attemptId });
      const checkoutUrl = safeProviderUrl(checkout.checkout_url, "checkout");
      if (!checkoutUrl || !checkout.session_id) throw new Error("billing_checkout_response_invalid");
      const { data: stored, error: storeError } = await admin.rpc("store_billing_checkout_session", {
        p_attempt_id: reserved.attemptId,
        p_session_id: checkout.session_id,
        p_checkout_url: checkoutUrl,
      });
      if (storeError || stored !== true) throw storeError ?? new Error("billing_checkout_store_failed");
      return json({ checkoutUrl, sessionId: checkout.session_id }, 201);
    } catch {
      // Preserve the reservation and provider idempotency key so the same request can
      // safely retry after a network timeout without creating a second session.
      throw new Error("billing_checkout_unavailable");
    }
  } catch (error) {
    if (error instanceof BillingUnavailableError) return json({ error: "billing_unavailable" }, 503);
    return json({ error: "billing_checkout_unavailable" }, 503);
  }
}
