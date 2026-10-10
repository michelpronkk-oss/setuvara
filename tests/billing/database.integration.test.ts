/// <reference lib="deno.ns" />

import { createClient } from "npm:@supabase/supabase-js@2.117.3";
import assert from "node:assert/strict";

import { getPlanEntitlements } from "../../src/lib/billing/entitlements.ts";
import { resolveBillingSnapshot, type ProviderSubscriptionRecord } from "../../src/lib/billing/state.ts";

const supabaseUrl = Deno.env.get("SETUVARA_LOCAL_SUPABASE_URL");
const publishableKey = Deno.env.get("SETUVARA_LOCAL_SUPABASE_PUBLISHABLE_KEY");
const serviceRoleKey = Deno.env.get("SETUVARA_LOCAL_SUPABASE_SERVICE_ROLE_KEY");

if (!supabaseUrl || !publishableKey || !serviceRoleKey) {
  throw new Error("Run through npm run test:billing:integration to use local Supabase only.");
}

const localHost = new URL(supabaseUrl).hostname;
if (localHost !== "127.0.0.1" && localHost !== "localhost") {
  throw new Error("Billing database integration tests refuse non-local Supabase endpoints.");
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
});
const anonymous = createClient(supabaseUrl, publishableKey, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
});

type FixtureAccount = { id: string; email: string; password: string; username: string };

function assertEquals(actual: unknown, expected: unknown, message?: string) {
  assert.deepEqual(actual, expected, message);
}

function assertTruthy(value: unknown, message: string) {
  assert.ok(value, message);
}

function requireSuccess(error: unknown, message: string): asserts error is null {
  if (error) throw new Error(message);
}

async function createFixtureAccount(label: string, published: boolean): Promise<FixtureAccount> {
  const suffix = crypto.randomUUID().replaceAll("-", "").slice(0, 16);
  const email = `billing-${label}-${suffix}@example.test`;
  const username = `bill_${suffix}`;
  const password = `${crypto.randomUUID()}Aa9!`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { username, display_name: "Billing E2E", plan: "pro" },
  });
  requireSuccess(error, `Could not create local billing fixture account (${label}).`);
  if (!data.user?.id) throw new Error(`Local billing fixture account (${label}) has no ID.`);

  const { error: profileError } = await admin.from("profiles")
    .update({ is_published: published })
    .eq("id", data.user.id);
  requireSuccess(profileError, `Could not configure local billing fixture profile (${label}).`);
  return { id: data.user.id, email, password, username };
}

async function seedSubscription(
  account: FixtureAccount,
  plan: "plus" | "pro" | null,
  status: string,
  productSuffix: string,
) {
  const customerId = `cus_${crypto.randomUUID().replaceAll("-", "")}`;
  const subscriptionId = `sub_${crypto.randomUUID().replaceAll("-", "")}`;
  const eventId = `billing_fixture_${crypto.randomUUID().replaceAll("-", "")}`;
  const now = new Date();

  const { error: customerError } = await admin.from("billing_customers").insert({
    user_id: account.id,
    dodo_customer_id: customerId,
  });
  requireSuccess(customerError, "Could not seed a local billing customer mapping.");

  const { error: subscriptionError } = await admin.from("billing_subscriptions").insert({
    dodo_subscription_id: subscriptionId,
    user_id: account.id,
    dodo_customer_id: customerId,
    dodo_product_id: `pdt_${productSuffix}`,
    plan_code: plan,
    billing_interval: plan === "pro" ? "yearly" : plan === "plus" ? "monthly" : null,
    provider_status: status,
    current_period_start: new Date(now.getTime() - 60_000).toISOString(),
    current_period_end: status === "expired"
      ? new Date(now.getTime() - 60_000).toISOString()
      : new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    last_provider_event_id: eventId,
    last_provider_event_at: now.toISOString(),
    last_sync_started_at: now.toISOString(),
  });
  requireSuccess(subscriptionError, "Could not seed a local billing subscription row.");
  return { customerId, subscriptionId, eventId };
}

async function readSnapshot(userId: string) {
  const { data, error } = await admin.from("billing_subscriptions")
    .select("plan_code,billing_interval,provider_status,current_period_end,cancel_at_next_billing_date,past_due_ends_at")
    .eq("user_id", userId);
  requireSuccess(error, "Could not read the local database-backed billing state.");
  return resolveBillingSnapshot((data ?? []) as ProviderSubscriptionRecord[]);
}

Deno.test("database-backed billing security, webhook reconciliation and entitlement matrix", async () => {
  const accounts: FixtureAccount[] = [];
  const eventIds: string[] = [];

  try {
    const free = await createFixtureAccount("free", true);
    const plus = await createFixtureAccount("plus", true);
    const pro = await createFixtureAccount("pro", true);
    const expired = await createFixtureAccount("expired", true);
    const unknown = await createFixtureAccount("unknown", true);
    const unpublished = await createFixtureAccount("unpublished", false);
    accounts.push(free, plus, pro, expired, unknown, unpublished);

    const plusRows = await seedSubscription(plus, "plus", "active", "fixtureplus");
    const proRows = await seedSubscription(pro, "pro", "active", "fixturepro");
    const expiredRows = await seedSubscription(expired, "plus", "expired", "fixtureexpired");
    const unknownRows = await seedSubscription(unknown, null, "active", "unknownproduct");
    eventIds.push(plusRows.eventId, proRows.eventId, expiredRows.eventId, unknownRows.eventId);

    assertEquals((await readSnapshot(free.id)).plan, "free", "no billing row and editable user metadata resolve to Free");
    assertEquals((await readSnapshot(free.id)).canManageBilling, false);
    assertEquals(getPlanEntitlements("free"), [
      "identity.create", "identity.edit", "mode.personal", "mode.event", "mode.business",
      "profile.public", "profile.links", "profile.content", "appearance.core",
      "share.link", "share.qr", "share.quick_qr", "share.tap", "tap.devices",
      "tap.connect_intent", "connections.core", "connections.guest_connect",
      "connections.private_memory", "passport.core", "passport.standard_progression",
      "soundtrack.core", "analytics.basic_7d",
    ]);
    assertEquals((await readSnapshot(plus.id)).plan, "plus");
    assertEquals(getPlanEntitlements("plus"), [
      "identity.create", "identity.edit", "identity.plus_badge",
      "mode.personal", "mode.event", "mode.business", "profile.public", "profile.links",
      "profile.content", "appearance.core", "share.link", "share.qr", "share.quick_qr",
      "share.tap", "tap.devices", "tap.connect_intent", "connections.core",
      "connections.guest_connect", "connections.private_memory", "passport.core",
      "passport.standard_progression", "soundtrack.core", "analytics.basic_7d",
      "analytics.history_30d", "analytics.history_90d", "analytics.sources",
      "analytics.modes", "analytics.conversion",
    ]);
    assertEquals((await readSnapshot(pro.id)).plan, "pro");
    assertEquals(getPlanEntitlements("pro"), [
      "identity.create", "identity.edit", "identity.plus_badge", "identity.pro_badge",
      "mode.personal", "mode.event", "mode.business", "profile.public", "profile.links",
      "profile.content", "appearance.core", "share.link", "share.qr", "share.quick_qr",
      "share.tap", "tap.devices", "tap.connect_intent", "connections.core",
      "connections.guest_connect", "connections.private_memory", "passport.core",
      "passport.standard_progression", "soundtrack.core", "analytics.basic_7d",
      "analytics.history_30d", "analytics.history_90d", "analytics.sources",
      "analytics.modes", "analytics.conversion", "analytics.custom_range", "analytics.funnels",
      "analytics.device_insights", "analytics.csv_export",
    ]);
    assertEquals((await readSnapshot(expired.id)).plan, "free");
    assertEquals((await readSnapshot(unknown.id)).plan, "free", "an unknown provider product with no plan mapping grants Free");

    const anonRead = await anonymous.from("billing_subscriptions").select("dodo_subscription_id").limit(1);
    assertTruthy(anonRead.error, "anonymous clients cannot read private subscription rows");

    const owner = createClient(supabaseUrl, publishableKey, {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    });
    const { data: signInData, error: signInError } = await owner.auth.signInWithPassword({
      email: free.email,
      password: free.password,
    });
    requireSuccess(signInError, "Could not authenticate the local normal-user billing fixture.");
    assertTruthy(signInData.session?.access_token, "local test account receives an authenticated session");

    const privateRead = await owner.from("billing_subscriptions").select("dodo_subscription_id").limit(1);
    assertTruthy(privateRead.error, "authenticated users cannot read provider subscription state");

    const forgedSubscription = await owner.from("billing_subscriptions").insert({
      dodo_subscription_id: `sub_${crypto.randomUUID().replaceAll("-", "")}`,
      user_id: free.id,
      dodo_customer_id: "cus_forged123",
      dodo_product_id: "pdt_forged123",
      plan_code: "pro",
      billing_interval: "yearly",
      provider_status: "active",
      last_provider_event_id: "forged_event",
      last_provider_event_at: new Date().toISOString(),
      last_sync_started_at: new Date().toISOString(),
    });
    assertTruthy(forgedSubscription.error, "authenticated users cannot insert a self-granted Pro subscription");

    const forgedCustomer = await owner.from("billing_customers")
      .update({ dodo_customer_id: "cus_forged123" })
      .eq("user_id", free.id);
    assertTruthy(forgedCustomer.error, "authenticated users cannot change Dodo customer mappings");

    const forgedEvent = await owner.from("billing_webhook_events").insert({
      provider_event_id: `forged_${crypto.randomUUID()}`,
      event_type: "subscription.active",
      received_at: new Date().toISOString(),
    });
    assertTruthy(forgedEvent.error, "authenticated users cannot insert fake webhook events");

    const { data: publicPlus, error: publicPlusError } = await anonymous.rpc(
      "get_public_profile_billing_entitlements",
      { p_username: plus.username },
    );
    requireSuccess(publicPlusError, "Public Plus entitlement lookup failed.");
    assertEquals(publicPlus, [{ verified_badge: true, remove_setuvara_branding: false }]);

    const { data: hiddenProfileEntitlements, error: hiddenProfileError } = await anonymous.rpc(
      "get_public_profile_billing_entitlements",
      { p_username: unpublished.username },
    );
    requireSuccess(hiddenProfileError, "Unpublished profile entitlement lookup failed.");
    assertEquals(hiddenProfileEntitlements, [], "unpublished profile billing flags remain private");

    const eventId = `billing_integration_${crypto.randomUUID().replaceAll("-", "")}`;
    const eventTime = new Date().toISOString();
    eventIds.push(eventId);
    const { data: firstClaim, error: firstClaimError } = await admin.rpc("claim_billing_webhook_event", {
      p_provider_event_id: eventId,
      p_event_type: "subscription.active",
      p_received_at: eventTime,
    });
    requireSuccess(firstClaimError, "Could not claim the local provider event.");
    assertEquals(firstClaim, "claimed");

    const syncStartedAt = new Date(Date.now() + 2_000).toISOString();
    const { data: syncResult, error: syncError } = await admin.rpc("sync_billing_subscription", {
      p_user_id: plus.id,
      p_dodo_subscription_id: plusRows.subscriptionId,
      p_dodo_customer_id: plusRows.customerId,
      p_dodo_product_id: "pdt_fixturepro",
      p_plan_code: "pro",
      p_billing_interval: "yearly",
      p_provider_status: "active",
      p_provider_created_at: eventTime,
      p_current_period_start: eventTime,
      p_current_period_end: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      p_cancel_at_next_billing_date: false,
      p_cancelled_at: null,
      p_past_due_ends_at: null,
      p_provider_event_id: eventId,
      p_provider_event_at: eventTime,
      p_sync_started_at: syncStartedAt,
    });
    requireSuccess(syncError, "Could not synchronize the verified local provider event.");
    assertEquals(syncResult, true, "a verified provider update is persisted");

    const { error: markProcessedError } = await admin.from("billing_webhook_events")
      .update({ processing_status: "processed", processed_at: new Date().toISOString() })
      .eq("provider_event_id", eventId);
    requireSuccess(markProcessedError, "Could not mark the local webhook test event processed.");

    const { data: duplicateClaim, error: duplicateClaimError } = await admin.rpc("claim_billing_webhook_event", {
      p_provider_event_id: eventId,
      p_event_type: "subscription.active",
      p_received_at: eventTime,
    });
    requireSuccess(duplicateClaimError, "Could not verify duplicate webhook behavior.");
    assertEquals(duplicateClaim, "duplicate", "the same processed event is idempotently rejected");

    const { data: staleResult, error: staleError } = await admin.rpc("sync_billing_subscription", {
      p_user_id: plus.id,
      p_dodo_subscription_id: plusRows.subscriptionId,
      p_dodo_customer_id: plusRows.customerId,
      p_dodo_product_id: "pdt_fixtureplus",
      p_plan_code: "plus",
      p_billing_interval: "monthly",
      p_provider_status: "cancelled",
      p_provider_created_at: eventTime,
      p_current_period_start: eventTime,
      p_current_period_end: eventTime,
      p_cancel_at_next_billing_date: true,
      p_cancelled_at: eventTime,
      p_past_due_ends_at: null,
      p_provider_event_id: `stale_${eventId}`,
      p_provider_event_at: eventTime,
      p_sync_started_at: new Date(Date.now() - 60_000).toISOString(),
    });
    requireSuccess(staleError, "Could not verify stale webhook handling.");
    assertEquals(staleResult, false, "a stale provider update is ignored");
    assertEquals((await readSnapshot(plus.id)).plan, "pro", "stale state cannot replace the newer canonical plan");

    const downgradeSyncStartedAt = new Date(Date.now() + 4_000).toISOString();
    const { data: downgradeResult, error: downgradeError } = await admin.rpc("sync_billing_subscription", {
      p_user_id: plus.id,
      p_dodo_subscription_id: plusRows.subscriptionId,
      p_dodo_customer_id: plusRows.customerId,
      p_dodo_product_id: "pdt_fixtureplus",
      p_plan_code: "plus",
      p_billing_interval: "monthly",
      p_provider_status: "active",
      p_provider_created_at: eventTime,
      p_current_period_start: eventTime,
      p_current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      p_cancel_at_next_billing_date: false,
      p_cancelled_at: null,
      p_past_due_ends_at: null,
      p_provider_event_id: `downgrade_${eventId}`,
      p_provider_event_at: eventTime,
      p_sync_started_at: downgradeSyncStartedAt,
    });
    requireSuccess(downgradeError, "Could not verify the local plan downgrade path.");
    assertEquals(downgradeResult, true, "a current provider downgrade is persisted");
    assertEquals((await readSnapshot(plus.id)).plan, "plus", "downgrade removes Pro-only capabilities");

    const { data: eventRows, error: eventRowsError } = await admin.from("billing_webhook_events")
      .select("provider_event_id")
      .eq("provider_event_id", eventId);
    requireSuccess(eventRowsError, "Could not verify persisted webhook event uniqueness.");
    assertEquals(eventRows?.length, 1, "duplicate provider delivery persists one event row");
  } finally {
    for (const eventId of eventIds) {
      await admin.from("billing_webhook_events").delete().eq("provider_event_id", eventId);
    }
    for (const account of accounts) {
      await admin.from("billing_subscriptions").delete().eq("user_id", account.id);
      await admin.from("billing_customers").delete().eq("user_id", account.id);
      await admin.from("billing_checkout_attempts").delete().eq("user_id", account.id);
      await admin.auth.admin.deleteUser(account.id);
    }
  }
});
