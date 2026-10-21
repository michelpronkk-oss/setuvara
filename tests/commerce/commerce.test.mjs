/**
 * Creator Commerce: seller states, fees, order rules, reporting, Stripe event mapping, webhook
 * signatures and download tokens.
 *
 *   npm run test:commerce
 *
 * Bundles the modules with esbuild and runs offline: webhook signatures are generated with
 * Stripe's own test helper, never sent to Stripe. Database rules (RLS, payment checks, refunds,
 * replay protection, download limits) are in supabase/tests/creator_commerce_security.sql.
 */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { after, before, describe, test } from "node:test";
import { build } from "esbuild";

const root = resolve(import.meta.dirname, "../..");
const cache = join(root, "node_modules/.cache");
mkdirSync(cache, { recursive: true });
const out = mkdtempSync(join(cache, "setuvara-commerce-"));
let model, stripe, server, events;

before(async () => {
  const stub = join(out, "server-only.js");
  writeFileSync(stub, "");
  const bundle = async (entry, name) => {
    await build({ entryPoints: [join(root, entry)], bundle: true, format: "cjs", platform: "node", alias: { "@": join(root, "src"), "server-only": stub }, outfile: join(out, `${name}.cjs`), logLevel: "silent" });
    return createRequire(import.meta.url)(join(out, `${name}.cjs`));
  };
  [model, stripe, server, events] = await Promise.all([
    bundle("src/lib/commerce/model.ts", "model"),
    bundle("src/lib/commerce/stripe.ts", "stripe"),
    bundle("src/lib/commerce/server.ts", "server"),
    bundle("src/lib/commerce/events.ts", "events"),
  ]);
});
after(() => rmSync(out, { recursive: true, force: true }));

const account = (over = {}) => ({
  provider: "stripe", status: "pending", charges_enabled: false, payouts_enabled: false, details_submitted: false,
  country_code: "NL", default_currency: "EUR", card_payments_status: "inactive", currently_due: [], past_due: [], pending: [],
  errors: [], disabled_reason: null, current_deadline: null, livemode: false, synced_at: null, disconnected_at: null, ...over,
});

describe("seller states", () => {
  test("no account or a disconnected one is Not connected", () => {
    assert.equal(model.sellerState(null), "not_connected");
    assert.equal(model.sellerState({ suspended: false, account: null }), "not_connected");
    assert.equal(model.sellerState({ suspended: false, account: account({ disconnected_at: "2026-10-20T00:00:00Z", charges_enabled: true }) }), "not_connected");
  });
  test("returning from onboarding without submitted details is Setup required", () => {
    assert.equal(model.sellerState({ suspended: false, account: account({ currently_due: ["individual.dob.day"] }) }), "setup_required");
  });
  test("submitted details under review are Verification pending, never enabled", () => {
    const state = model.sellerState({ suspended: false, account: account({ details_submitted: true, pending: ["individual.verification.document"] }) });
    assert.equal(state, "verification_pending");
  });
  test("charges on but payouts off is Payouts restricted", () => {
    assert.equal(model.sellerState({ suspended: false, account: account({ details_submitted: true, charges_enabled: true, card_payments_status: "active" }) }), "payouts_restricted");
  });
  test("Payments enabled needs charges, card payments active and payouts", () => {
    const ready = account({ details_submitted: true, charges_enabled: true, payouts_enabled: true, card_payments_status: "active" });
    assert.equal(model.sellerState({ suspended: false, account: ready }), "payments_enabled");
    assert.notEqual(model.sellerState({ suspended: false, account: { ...ready, card_payments_status: "pending" } }), "payments_enabled");
    assert.notEqual(model.sellerState({ suspended: false, account: { ...ready, disabled_reason: "requirements.past_due" } }), "payments_enabled");
  });
  test("past-due requirements or errors are Action required", () => {
    assert.equal(model.sellerState({ suspended: false, account: account({ details_submitted: true, charges_enabled: true, past_due: ["external_account"] }) }), "action_required");
    assert.equal(model.sellerState({ suspended: false, account: account({ details_submitted: true, errors: [{ code: "x", reason: "y", requirement: "z" }] }) }), "action_required");
  });
  test("a Setuvara suspension wins over Stripe", () => {
    assert.equal(model.sellerState({ suspended: true, account: account({ details_submitted: true, charges_enabled: true, payouts_enabled: true, card_payments_status: "active" }) }), "suspended");
  });
  test("every state has copy", () => {
    for (const state of ["not_connected", "setup_required", "verification_pending", "payments_enabled", "payouts_restricted", "action_required", "rejected", "suspended"]) assert.ok(model.SELLER_STATE_COPY[state].label);
  });
  test("requirement keys read as plain words", () => {
    assert.equal(model.requirementLabel("individual.verification.document"), "ID document");
    assert.equal(model.requirementLabel("external_account"), "Bank account");
  });
});

describe("money", () => {
  test("platform fee mirrors the database: basis points rounded down plus fixed", () => {
    assert.equal(model.platformFee(1500, 500), 75);
    assert.equal(model.platformFee(999, 500), 49);
    assert.equal(model.platformFee(1000, 250, 30), 55);
    assert.equal(model.platformFee(0, 500, 30), 0);
    assert.equal(model.platformFee(1500, 0), 0);
  });
  test("invalid fee inputs throw", () => {
    assert.throws(() => model.platformFee(-1, 500));
    assert.throws(() => model.platformFee(100, 10_001));
    assert.throws(() => model.platformFee(100, 1.5));
  });
  test("amounts format per currency", () => {
    assert.equal(model.formatAmount(1500, "EUR"), "€15");
    assert.equal(model.formatAmount(1599, "GBP"), "£15.99");
  });
  test("minimum prices are Stripe's card minimums", () => {
    assert.deepEqual(model.MIN_PRICE_MINOR, { EUR: 50, USD: 50, GBP: 30 });
  });
});

describe("orders", () => {
  test("paid can be refunded or disputed but never go back to pending", () => {
    assert.ok(model.canMoveOrder("pending", "paid"));
    assert.ok(model.canMoveOrder("paid", "refunded"));
    assert.ok(model.canMoveOrder("paid", "disputed"));
    assert.ok(!model.canMoveOrder("paid", "pending"));
    assert.ok(!model.canMoveOrder("refunded", "paid"));
  });
  test("only purchases that are paid or partly refunded can be refunded, up to what's left", () => {
    assert.equal(model.refundable({ order_kind: "purchase", status: "paid", gross_amount_minor: 1500, amount_refunded_minor: 0 }), 1500);
    assert.equal(model.refundable({ order_kind: "purchase", status: "partially_refunded", gross_amount_minor: 1500, amount_refunded_minor: 500 }), 1000);
    assert.equal(model.refundable({ order_kind: "purchase", status: "disputed", gross_amount_minor: 1500, amount_refunded_minor: 0 }), 0);
    assert.equal(model.refundable({ order_kind: "free_claim", status: "paid", gross_amount_minor: 0, amount_refunded_minor: 0 }), 0);
  });
});

const order = (over) => ({
  id: "o1", offer_id: "p1", offer_title: "Presets", offer_type: "digital", order_kind: "purchase", status: "paid", currency: "EUR",
  gross_amount_minor: 1500, platform_fee_amount_minor: 75, provider_fee_amount_minor: 47, amount_refunded_minor: 0,
  buyer_email: "aanya@example.test", buyer_name: "Aanya Rao", buyer_country: "NL", fulfillment_status: "delivered", delivery_attempts: 1,
  livemode: false, created_at: "2026-10-20T10:00:00Z", paid_at: "2026-10-20T10:01:00Z", refunded_at: null, failure_code: null, ...over,
});

describe("reporting", () => {
  test("totals stay per currency and Setuvara's fee is net of fees returned", () => {
    const totals = model.commerceTotals([
      order({}),
      order({ id: "o2", status: "partially_refunded", amount_refunded_minor: 500 }),
      order({ id: "o3", currency: "GBP", gross_amount_minor: 1000, platform_fee_amount_minor: 0, provider_fee_amount_minor: null }),
      order({ id: "o4", status: "pending", paid_at: null }),
      order({ id: "o5", order_kind: "free_claim", gross_amount_minor: 0, platform_fee_amount_minor: 0 }),
    ], [{ order_id: "o2", amount_minor: 500, currency: "EUR", status: "succeeded", platform_fee_refunded_minor: 25, created_at: "" }]);
    const eur = totals.find((t) => t.currency === "EUR");
    const gbp = totals.find((t) => t.currency === "GBP");
    assert.equal(totals.length, 2);
    assert.equal(eur.orders, 2);
    assert.equal(eur.gross, 3000);
    assert.equal(eur.refunds, 500);
    assert.equal(eur.platformFees, 125);
    assert.equal(eur.processingFees, 94);
    assert.equal(eur.net, 3000 - 500 - 125 - 94);
    assert.equal(gbp.feesPending, 1, "an unknown Stripe fee is counted as pending, not as zero");
  });
  test("customers group by email across orders", () => {
    const rows = model.customersOf([order({}), order({ id: "o2", buyer_email: "AANYA@example.test" }), order({ id: "o3", buyer_email: "lucas@example.test", buyer_name: "Lucas Meyer" })]);
    assert.equal(rows.length, 2);
    assert.equal(rows.find((row) => row.email === "aanya@example.test").orders, 2);
  });
  test("conversion is null without views, never invented", () => {
    const funnels = model.productFunnels([], [order({})], { p1: "Presets" });
    assert.equal(funnels[0].conversion, null);
  });
});

describe("Stripe mapping", () => {
  test("an account maps to a snapshot without trusting missing flags", () => {
    const snap = stripe.sellerFromAccount({ id: "acct_1", country: "GB", default_currency: "gbp", requirements: { currently_due: ["external_account"], past_due: [], pending_verification: [], errors: [], disabled_reason: "requirements.past_due", current_deadline: null }, capabilities: {} }, false);
    assert.equal(snap.chargesEnabled, false);
    assert.equal(snap.payoutsEnabled, false);
    assert.equal(snap.cardPayments, "unrequested");
    assert.equal(snap.defaultCurrency, "GBP");
    assert.equal(snap.disabledReason, "requirements.past_due");
  });
  test("checkout events need a connected account and carry the order id", () => {
    const session = { id: "cs_test_1", metadata: { setuvara_order_id: "ord-1" }, payment_intent: "pi_1", amount_total: 1500, currency: "eur", payment_status: "paid", customer_details: { address: { country: "NL" } } };
    const mapped = stripe.normalizeEvent({ id: "evt_1", type: "checkout.session.completed", account: "acct_1", data: { object: session } });
    assert.equal(mapped.kind, "checkout.completed");
    assert.equal(mapped.payment.orderId, "ord-1");
    assert.equal(mapped.payment.currency, "EUR");
    assert.equal(mapped.payment.paid, true);
    assert.equal(stripe.normalizeEvent({ id: "evt_2", type: "checkout.session.completed", data: { object: session } }).kind, "ignored", "a platform-account session is not a creator sale");
  });
  test("an unpaid completed session is not paid", () => {
    const mapped = stripe.normalizeEvent({ id: "evt_3", type: "checkout.session.completed", account: "acct_1", data: { object: { id: "cs_2", metadata: {}, payment_status: "unpaid", amount_total: 1500, currency: "eur" } } });
    assert.equal(mapped.payment.paid, false);
  });
  test("refunds, disputes and payouts map; unknown events are ignored", () => {
    assert.equal(stripe.normalizeEvent({ id: "e", type: "refund.updated", account: "acct_1", data: { object: { id: "re_1", payment_intent: "pi_1", amount: 500, currency: "eur", status: "succeeded", metadata: {} } } }).refund.status, "succeeded");
    assert.equal(stripe.normalizeEvent({ id: "e", type: "charge.dispute.created", account: "acct_1", data: { object: { id: "dp_1", payment_intent: "pi_1", amount: 1500, currency: "eur", status: "needs_response", reason: "fraudulent", evidence_details: { due_by: 1_800_000_000 } } } }).kind, "dispute.updated");
    assert.equal(stripe.normalizeEvent({ id: "e", type: "payout.paid", account: "acct_1", data: { object: { id: "po_1", amount: 1000, currency: "eur", status: "paid", arrival_date: 1_800_000_000 } } }).payout.status, "paid");
    assert.equal(stripe.normalizeEvent({ id: "e", type: "customer.created", account: "acct_1", data: { object: { id: "cus_1" } } }).kind, "ignored");
  });
});

describe("webhook signatures (offline)", () => {
  const secret = "whsec_test_offline_secret";
  const payload = JSON.stringify({ id: "evt_sig", object: "event", type: "checkout.session.expired", account: "acct_1", livemode: false, created: Math.floor(Date.now() / 1000), data: { object: { id: "cs_x", metadata: { setuvara_order_id: "ord-9" } } } });
  const provider = () => new stripe.StripeCommerceProvider("sk_test_offline", secret);
  const header = (timestamp, body = payload, key = secret) => provider().stripe.webhooks.generateTestHeaderString({ payload: body, secret: key, timestamp });

  test("a correctly signed event verifies and maps", () => {
    const verified = provider().verifyWebhook(payload, header(Math.floor(Date.now() / 1000)));
    assert.equal(verified.id, "evt_sig");
    assert.equal(verified.accountId, "acct_1");
    assert.equal(verified.event.kind, "checkout.expired");
    assert.equal(verified.event.orderId, "ord-9");
  });
  test("a tampered body, a wrong secret or no signature is rejected", () => {
    const now = Math.floor(Date.now() / 1000);
    assert.throws(() => provider().verifyWebhook(payload.replace("ord-9", "ord-0"), header(now)));
    assert.throws(() => provider().verifyWebhook(payload, header(now, payload, "whsec_other")));
    assert.throws(() => provider().verifyWebhook(payload, null), /webhook_unsigned/);
    assert.throws(() => new stripe.StripeCommerceProvider("sk_test_offline", null).verifyWebhook(payload, header(now)), /webhook_unconfigured/);
  });
  test("an old signature is rejected (replay window)", () => {
    assert.throws(() => provider().verifyWebhook(payload, header(Math.floor(Date.now() / 1000) - 600)));
  });
  test("livemode comes from the key", () => {
    assert.equal(provider().livemode, false);
    assert.equal(new stripe.StripeCommerceProvider("sk_live_x", secret).livemode, true);
  });
});

describe("configuration and tokens", () => {
  test("a live key is refused unless live charges are switched on", () => {
    const saved = { ...process.env };
    try {
      process.env.STRIPE_SECRET_KEY = "sk_live_example";
      delete process.env.COMMERCE_LIVE_ENABLED;
      assert.equal(server.commerceProvider(), null);
      process.env.STRIPE_SECRET_KEY = "sk_test_example";
      assert.ok(server.commerceProvider());
      delete process.env.STRIPE_SECRET_KEY;
      assert.equal(server.commerceProvider(), null);
      delete process.env.COMMERCE_ENABLED;
      assert.equal(server.commerceEnabled(), false);
    } finally {
      process.env = saved;
    }
  });
  test("download tokens are 256-bit, url-safe and stored only as SHA-256", () => {
    const a = server.newDownloadToken();
    const b = server.newDownloadToken();
    assert.notEqual(a.token, b.token);
    assert.ok(server.isDownloadToken(a.token));
    assert.match(a.hash, /^[0-9a-f]{64}$/);
    assert.equal(server.hashToken(a.token), a.hash);
    assert.ok(!server.isDownloadToken("short"));
    assert.ok(!server.isDownloadToken(`${a.token.slice(0, 42)}/`));
  });
});

describe("refund events", () => {
  // A fake service: creator_orders holds one order paid on acct_A; every rpc call is recorded.
  const fake = (orders = [{ id: "order-a", provider: "stripe", provider_account_id: "acct_A", provider_payment_id: "pi_A" }]) => {
    const calls = [];
    const query = (rows) => {
      let found = rows;
      const chain = {
        select: () => chain,
        eq: (key, value) => { found = found.filter((row) => row[key] === value); return chain; },
        neq: () => chain,
        maybeSingle: async () => ({ data: found[0] ?? null }),
        then: (resolve) => resolve({ data: [] }),
      };
      return chain;
    };
    return { calls, service: { from: (table) => query(table === "creator_orders" ? orders : []), rpc: async (name, args) => { calls.push({ name, args }); return { data: null, error: null }; } } };
  };
  const provider = { code: "stripe", livemode: false, platformFeeRefundedTotal: async () => 0 };
  const refundEvent = (accountId, refund) => ({ id: "evt_1", livemode: false, accountId, event: { kind: "refund.updated", refund: { refundId: "re_1", amountMinor: 500, currency: "EUR", status: "succeeded", reason: null, ...refund } } });

  test("a refund resolves its order from the payment on the connected account", async () => {
    const { calls, service } = fake();
    assert.equal(await events.handleCommerceEvent(service, provider, refundEvent("acct_A", { paymentId: "pi_A", orderId: null }), "https://setuvara.com"), "processed");
    assert.equal(calls[0].args.p_order_id, "order-a");
  });
  test("metadata pointing at another seller's order is ignored", async () => {
    const { calls, service } = fake([
      { id: "order-a", provider: "stripe", provider_account_id: "acct_A", provider_payment_id: "pi_A" },
      { id: "order-b", provider: "stripe", provider_account_id: "acct_B", provider_payment_id: "pi_B" },
    ]);
    assert.equal(await events.handleCommerceEvent(service, provider, refundEvent("acct_A", { paymentId: "pi_A", orderId: "order-b" }), "https://setuvara.com"), "ignored");
    assert.equal(await events.handleCommerceEvent(service, provider, refundEvent("acct_A", { paymentId: "pi_other", orderId: "order-b" }), "https://setuvara.com"), "ignored");
    assert.equal(calls.length, 0);
  });
  test("matching metadata is accepted", async () => {
    const { calls, service } = fake();
    assert.equal(await events.handleCommerceEvent(service, provider, refundEvent("acct_A", { paymentId: "pi_A", orderId: "order-a" }), "https://setuvara.com"), "processed");
    assert.equal(calls.length, 1);
  });
});
