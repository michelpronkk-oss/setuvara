import type { BillingInterval } from "./catalog";

/** Browser-side calls to the billing routes. Provider URLs are checked before any redirect. */

const CHECKOUT_HOSTS = ["checkout.dodopayments.com", "test.checkout.dodopayments.com"];
const PORTAL_HOSTS = ["customer.dodopayments.com", "test.customer.dodopayments.com"];

function providerUrl(value: unknown, hosts: readonly string[]) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && hosts.includes(url.hostname) ? url.toString() : null;
  } catch {
    return null;
  }
}

const MESSAGES: Readonly<Record<string, string>> = {
  unauthorized: "Log in again, and confirm your email if you haven’t yet, then try again.",
  subscription_already_active: "You already have a plan. Change it from Billing.",
  subscription_already_exists: "A subscription is already being set up for you. Refresh in a minute.",
  checkout_in_progress: "A checkout is already open. Finish it, or try again in a few minutes.",
  subscription_ending: "Your plan is set to end. Resume it in Manage billing before changing plans.",
  subscription_not_active: "Your subscription needs attention first. Open Manage billing to fix the payment.",
  already_on_plan: "That is already your plan.",
  no_active_subscription: "There is no paid plan to change. Choose a plan to start one.",
  subscription_not_linked: "This plan was granted without a payment, so there is nothing to change. Plan changes work on plans bought through checkout.",
  billing_customer_unavailable: "There is no billing account yet. Choose a plan to start one.",
};

export const BILLING_FALLBACK = "Billing could not open right now. Your plan is unchanged.";

export function billingMessage(code: string | undefined) {
  return (code && MESSAGES[code]) || BILLING_FALLBACK;
}

type Result<T> = { ok: true; value: T } | { ok: false; message: string };

async function post(path: string, body: unknown, idempotent = false) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json", ...(idempotent ? { "idempotency-key": crypto.randomUUID() } : {}) },
    body: JSON.stringify(body),
  });
  const result = await response.json().catch(() => ({})) as Record<string, unknown>;
  return { response, result };
}

export async function openCheckout(plan: "plus" | "pro", interval: BillingInterval): Promise<Result<string>> {
  try {
    const { response, result } = await post("/api/billing/checkout", { plan, interval }, true);
    const url = response.ok ? providerUrl(result.checkoutUrl, CHECKOUT_HOSTS) : null;
    return url ? { ok: true, value: url } : { ok: false, message: billingMessage(result.error as string | undefined) };
  } catch {
    return { ok: false, message: BILLING_FALLBACK };
  }
}

export async function openPortal(): Promise<Result<string>> {
  try {
    const { response, result } = await post("/api/billing/portal", {});
    const url = response.ok ? providerUrl(result.portalUrl, PORTAL_HOSTS) : null;
    return url ? { ok: true, value: url } : { ok: false, message: billingMessage(result.error as string | undefined) };
  } catch {
    return { ok: false, message: BILLING_FALLBACK };
  }
}

export type PlanChangePreview = { kind: "upgrade" | "downgrade"; effectiveAt: string | null; amountMinor: number; currency: string };

export async function previewPlanChange(plan: "plus" | "pro", interval: BillingInterval): Promise<Result<PlanChangePreview>> {
  try {
    const { response, result } = await post("/api/billing/change-plan", { plan, interval, mode: "preview" });
    if (!response.ok || (result.kind !== "upgrade" && result.kind !== "downgrade") || typeof result.amountMinor !== "number") {
      return { ok: false, message: billingMessage(result.error as string | undefined) };
    }
    return {
      ok: true,
      value: {
        kind: result.kind,
        effectiveAt: typeof result.effectiveAt === "string" ? result.effectiveAt : null,
        amountMinor: result.amountMinor,
        currency: typeof result.currency === "string" ? result.currency : "USD",
      },
    };
  } catch {
    return { ok: false, message: BILLING_FALLBACK };
  }
}

export async function applyPlanChange(plan: "plus" | "pro", interval: BillingInterval): Promise<Result<{ kind: "upgrade" | "downgrade"; effectiveAt: string | null }>> {
  try {
    const { response, result } = await post("/api/billing/change-plan", { plan, interval, mode: "apply" }, true);
    if (!response.ok || (result.kind !== "upgrade" && result.kind !== "downgrade")) {
      return { ok: false, message: billingMessage(result.error as string | undefined) };
    }
    return { ok: true, value: { kind: result.kind, effectiveAt: typeof result.effectiveAt === "string" ? result.effectiveAt : null } };
  } catch {
    return { ok: false, message: BILLING_FALLBACK };
  }
}
