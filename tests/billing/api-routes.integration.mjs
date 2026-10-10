import assert from "node:assert/strict";
import { after, test } from "node:test";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SETUVARA_LOCAL_SUPABASE_URL;
const publishableKey = process.env.SETUVARA_LOCAL_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SETUVARA_LOCAL_SUPABASE_SERVICE_ROLE_KEY;
const appUrl = process.env.SETUVARA_LOCAL_APP_URL;

assert(supabaseUrl && publishableKey && serviceRoleKey && appUrl, "Local billing route test configuration is missing.");
assert(["127.0.0.1", "localhost"].includes(new URL(supabaseUrl).hostname), "Billing route tests require local Supabase.");
assert(["127.0.0.1", "localhost"].includes(new URL(appUrl).hostname), "Billing route tests require a local Setuvara app.");

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
});
const accounts = [];

async function createAccount(label, activePlan = null) {
  const suffix = crypto.randomUUID().replaceAll("-", "").slice(0, 16);
  const email = `billing-route-${label}-${suffix}@example.test`;
  const password = `${crypto.randomUUID()}Aa9!`;
  const username = `route_${suffix}`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { username, display_name: "Billing route fixture", plan: "pro" },
  });
  assert.ifError(error);
  assert(data.user?.id);
  const account = { id: data.user.id, email, password, username };
  accounts.push(account);

  if (activePlan) {
    const customerId = `cus_${crypto.randomUUID().replaceAll("-", "")}`;
    const { error: customerError } = await admin.from("billing_customers").insert({
      user_id: account.id,
      dodo_customer_id: customerId,
    });
    assert.ifError(customerError);

    const now = new Date();
    const { error: subscriptionError } = await admin.from("billing_subscriptions").insert({
      dodo_subscription_id: `sub_${crypto.randomUUID().replaceAll("-", "")}`,
      user_id: account.id,
      dodo_customer_id: customerId,
      dodo_product_id: "pdt_localfixture123",
      plan_code: activePlan,
      billing_interval: "monthly",
      provider_status: "active",
      current_period_start: new Date(now.getTime() - 60_000).toISOString(),
      current_period_end: new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      last_provider_event_id: `billing_route_${suffix}`,
      last_provider_event_at: now.toISOString(),
      last_sync_started_at: now.toISOString(),
    });
    assert.ifError(subscriptionError);
  }
  return account;
}

async function cookieFor(account) {
  const client = createClient(supabaseUrl, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  const { data, error } = await client.auth.signInWithPassword({ email: account.email, password: account.password });
  assert.ifError(error);
  assert(data.session);

  const jar = new Map();
  const serverClient = createServerClient(supabaseUrl, publishableKey, {
    cookies: {
      getAll() {
        return [...jar].map(([name, value]) => ({ name, value }));
      },
      setAll(values) {
        for (const { name, value } of values) {
          if (value) jar.set(name, value);
          else jar.delete(name);
        }
      },
    },
  });
  const { error: sessionError } = await serverClient.auth.setSession({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  });
  assert.ifError(sessionError);
  return [...jar].map(([name, value]) => `${name}=${value}`).join("; ");
}

after(async () => {
  for (const account of accounts) {
    await admin.from("billing_subscriptions").delete().eq("user_id", account.id);
    await admin.from("billing_customers").delete().eq("user_id", account.id);
    await admin.from("billing_checkout_attempts").delete().eq("user_id", account.id);
    await admin.auth.admin.deleteUser(account.id);
  }
});

test("billing APIs enforce authenticated ownership and stop duplicate checkout before provider calls", async () => {
  const catalogResponse = await fetch(`${appUrl}/api/billing/catalog`);
  assert.equal(catalogResponse.status, 200, "public catalog is available");
  const catalogBody = await catalogResponse.json();
  assert.deepEqual(catalogBody.plans.map(({ code, monthlyPriceMinor, yearlyPriceMinor }) => [code, monthlyPriceMinor, yearlyPriceMinor]), [
    ["free", 0, 0], ["plus", 699, 6900], ["pro", 1299, 12900],
  ]);
  const catalogSerialized = JSON.stringify(catalogBody);
  assert.equal(catalogSerialized.includes("pdt_"), false, "provider product IDs are never public");
  assert.equal(catalogSerialized.includes("DODO_PAYMENTS_"), false, "provider configuration is never public");

  const owner = await createAccount("active-owner", "plus");
  const freeOwner = await createAccount("free-owner");
  const proOwner = await createAccount("pro-owner", "pro");
  const other = await createAccount("other-user");
  const ownerCookie = await cookieFor(owner);
  const freeCookie = await cookieFor(freeOwner);
  const proCookie = await cookieFor(proOwner);
  const otherCookie = await cookieFor(other);

  const unauthMe = await fetch(`${appUrl}/api/billing/me`);
  assert.equal(unauthMe.status, 401, "billing state requires a confirmed authenticated user");

  for (const fixture of [
    { account: freeOwner, cookie: freeCookie, plan: "free", plusFeature: false, proFeature: false },
    { account: owner, cookie: ownerCookie, plan: "plus", plusFeature: true, proFeature: false },
    { account: proOwner, cookie: proCookie, plan: "pro", plusFeature: true, proFeature: true },
  ]) {
    const response = await fetch(`${appUrl}/api/billing/me`, { headers: { cookie: fixture.cookie } });
    assert.equal(response.status, 200, `${fixture.plan} billing snapshot succeeds`);
    const body = await response.json();
    assert.equal(body.billing.plan, fixture.plan);
    assert.equal(body.entitlements.plan, fixture.plan);
    assert.equal(body.entitlements.capabilities["analytics.sources"].available, fixture.plusFeature);
    assert.equal(body.entitlements.capabilities["analytics.csv_export"].available, fixture.proFeature);
    assert.equal(body.entitlements.capabilities["domain.custom"].state, "unavailable");
    assert.equal(JSON.stringify(body).includes("dodo_"), false, "provider identifiers never leave the server boundary");
    assert.equal("currentPeriodEnd" in body.billing, false, "raw subscription dates are not exposed");
  }

  const unauthCheckout = await fetch(`${appUrl}/api/billing/checkout`, {
    method: "POST",
    headers: {
      origin: appUrl,
      "content-type": "application/json",
      "idempotency-key": crypto.randomUUID(),
    },
    body: JSON.stringify({ plan: "plus", interval: "monthly" }),
  });
  const unauthCheckoutBody = await unauthCheckout.json();
  assert.equal(unauthCheckout.status, 401, `checkout rejects unauthenticated callers; response: ${JSON.stringify(unauthCheckoutBody)}`);

  const forgedCheckout = await fetch(`${appUrl}/api/billing/checkout`, {
    method: "POST",
    headers: {
      origin: appUrl,
      "content-type": "application/json",
      cookie: otherCookie,
      "idempotency-key": crypto.randomUUID(),
    },
    body: JSON.stringify({ plan: "pro", interval: "yearly", customer_id: "cus_other123", email: other.email }),
  });
  assert.equal(forgedCheckout.status, 400, "checkout rejects caller-supplied customer or email fields");

  const activeCheckout = await fetch(`${appUrl}/api/billing/checkout`, {
    method: "POST",
    headers: {
      origin: appUrl,
      "content-type": "application/json",
      cookie: ownerCookie,
      "idempotency-key": crypto.randomUUID(),
    },
    body: JSON.stringify({ plan: "pro", interval: "yearly" }),
  });
  assert.equal(activeCheckout.status, 409, "an existing active paid plan blocks a duplicate checkout before any Dodo call");

  const forgedPortal = await fetch(`${appUrl}/api/billing/portal`, {
    method: "POST",
    headers: { origin: appUrl, "content-type": "application/json", cookie: otherCookie },
    body: JSON.stringify({ customer_id: "cus_owner_isolation_test", dodo_customer_id: "cus_owner_isolation_test" }),
  });
  assert.equal(forgedPortal.status, 404, "a user without a Dodo mapping cannot access another user's portal");
  assert.deepEqual(await forgedPortal.json(), { error: "billing_customer_unavailable" });

  const unauthPortal = await fetch(`${appUrl}/api/billing/portal`, {
    method: "POST",
    headers: { origin: appUrl, "content-type": "application/json" },
    body: JSON.stringify({}),
  });
  assert.equal(unauthPortal.status, 401, "portal rejects unauthenticated callers");
});
