/**
 * Creator Commerce route boundaries against a running build (no database or Stripe needed).
 *   COMMERCE off:  node scripts/e2e-commerce-routes.mjs http://localhost:3000
 *   COMMERCE on:   start with COMMERCE_ENABLED=true STRIPE_SECRET_KEY=sk_test_… STRIPE_CONNECT_WEBHOOK_SECRET=<s>, then
 *                  node scripts/e2e-commerce-routes.mjs http://localhost:3000 <s>
 */
import Stripe from "stripe";
const base = process.argv[2];
const secret = process.argv[3];
const out = [];
const check = async (label, path, init, expect) => {
  const res = await fetch(base + path, { redirect: "manual", ...init });
  const ok = expect(res);
  out.push(`${ok ? "PASS" : "FAIL"} ${res.status} ${label}${res.headers.get("location") ? ` -> ${res.headers.get("location")}` : ""}`);
};
const origin = { origin: base, "content-type": "application/json", "x-setuvara-request": "same-origin" };
const body = JSON.stringify({ id: "evt_local_1", object: "event", type: "checkout.session.completed", account: "acct_x", livemode: false, created: Math.floor(Date.now() / 1000), data: { object: { id: "cs_test_x", payment_status: "paid", amount_total: 1500, currency: "eur", metadata: { setuvara_order_id: "00000000-0000-4000-8000-000000000000" }, payment_intent: "pi_x" } } });
if (!secret) {
  await check("webhook without Stripe configured is closed", "/api/commerce/stripe/webhook", { method: "POST", body: "{}" }, (r) => r.status === 503);
  await check("checkout closed while commerce is off", "/api/commerce/checkout", { method: "POST", headers: origin, body: "{}" }, (r) => r.status === 404);
  await check("free claim closed while commerce is off", "/api/commerce/claim", { method: "POST", headers: origin, body: "{}" }, (r) => r.status === 404);
} else {
  const stripe = new Stripe("sk_test_offline");
  const sig = (ts, payload = body) => stripe.webhooks.generateTestHeaderString({ payload, secret, timestamp: ts });
  const now = Math.floor(Date.now() / 1000);
  await check("webhook without a signature is rejected", "/api/commerce/stripe/webhook", { method: "POST", body }, (r) => r.status === 400);
  await check("webhook with a forged signature is rejected", "/api/commerce/stripe/webhook", { method: "POST", body, headers: { "stripe-signature": sig(now, body.replace("1500", "1")) } }, (r) => r.status === 400);
  await check("webhook replayed after 10 minutes is rejected", "/api/commerce/stripe/webhook", { method: "POST", body, headers: { "stripe-signature": sig(now - 600) } }, (r) => r.status === 400);
  await check("a valid signature reaches the database step (unreachable here, so Stripe would retry)", "/api/commerce/stripe/webhook", { method: "POST", body, headers: { "stripe-signature": sig(now) } }, (r) => r.status === 500);
  await check("checkout from another site is refused", "/api/commerce/checkout", { method: "POST", headers: { origin: "https://evil.example", "content-type": "application/json", "x-setuvara-request": "same-origin" }, body: "{}" }, (r) => r.status === 403);
  await check("checkout with a bad body is refused", "/api/commerce/checkout", { method: "POST", headers: origin, body: JSON.stringify({ offerId: "x" }) }, (r) => r.status === 400);
}
await check("refund needs the same origin", "/api/commerce/orders/00000000-0000-4000-8000-000000000000/refund", { method: "POST", headers: { origin: "https://evil.example" }, body: "{}" }, (r) => r.status === 403);
await check("refund needs sign-in", "/api/commerce/orders/00000000-0000-4000-8000-000000000000/refund", { method: "POST", headers: origin, body: "{}" }, (r) => r.status === 401);
await check("enable payments needs sign-in", "/api/commerce/payments/enable", { method: "POST", headers: origin, body: "{}" }, (r) => r.status === 401);
await check("onboarding link needs sign-in", "/api/commerce/payments/onboarding", {}, (r) => r.status === 303 && r.headers.get("location").includes("/login"));
await check("returning from Stripe without sign-in proves nothing", "/api/commerce/payments/return", {}, (r) => r.status === 303 && r.headers.get("location").includes("/login"));
await check("reconcile without the cron secret is hidden", "/api/commerce/reconcile", {}, (r) => r.status === 404);
await check("download with a malformed token goes back", "/api/commerce/download", { method: "POST", headers: { origin: base, "content-type": "application/x-www-form-urlencoded" }, body: "token=abc&file=x" }, (r) => r.status === 303 && !r.headers.get("location").includes("supabase"));
await check("purchase page without the checkout id shows nothing", "/purchase/00000000-0000-4000-8000-000000000000", {}, (r) => r.status === 200);
console.log(out.join("\n"));
