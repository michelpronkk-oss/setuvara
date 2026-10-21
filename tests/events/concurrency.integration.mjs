/**
 * Event registration under real concurrency, against a LOCAL Setuvara stack: many guests at once
 * through PostgREST, so every call is its own transaction racing for the last seats.
 *
 *   E2E_SUPABASE_URL=http://127.0.0.1:54321 \
 *   E2E_LOCAL_SERVICE_KEY=<local service role key> \
 *   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<local publishable key> \
 *   npm run test:events:concurrency
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, test } from "node:test";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.E2E_SUPABASE_URL ?? "http://127.0.0.1:54321";
const serviceKey = process.env.E2E_LOCAL_SERVICE_KEY;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
assert.equal(new URL(supabaseUrl).hostname, "127.0.0.1", "Runs against local Setuvara only");
assert(serviceKey && publishableKey, "Local service and publishable keys are required");

const admin = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
const stamp = Date.now().toString(36);
let organizer;

before(async () => {
  const email = `evorg${stamp}@example.test`;
  const password = `Ev-${randomUUID()}aA1!`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { username: `evorg${stamp}`.slice(0, 30), display_name: "Organizer" } });
  assert.ifError(error);
  const client = createClient(supabaseUrl, publishableKey, { auth: { autoRefreshToken: false, persistSession: false } });
  assert.ifError((await client.auth.signInWithPassword({ email, password })).error);
  assert.ifError((await client.from("profiles").update({ is_published: true }).eq("id", data.user.id)).error);
  assert.ifError((await client.from("profile_modes").update({ is_enabled: true }).eq("profile_id", data.user.id).eq("slug", "event")).error);
  const { data: mode } = await client.from("profile_modes").select("id").eq("profile_id", data.user.id).eq("slug", "event").single();
  organizer = { id: data.user.id, client, modeId: mode.id };
});
after(async () => { if (organizer) await admin.auth.admin.deleteUser(organizer.id); });

async function newEvent(capacity, waitlist = true) {
  const { data, error } = await organizer.client.from("events").insert({
    profile_id: organizer.id, mode_id: organizer.modeId, title: `Race ${capacity}`, status: "published", timezone: "Europe/Amsterdam",
    starts_at: new Date(Date.now() + 7 * 864e5).toISOString(), ends_at: new Date(Date.now() + 7 * 864e5 + 3 * 36e5).toISOString(), capacity, waitlist_enabled: waitlist,
  }).select("id").single();
  assert.ifError(error);
  return data.id;
}
const register = (eventId, n, email = `guest${n}-${stamp}@example.test`) =>
  admin.rpc("register_for_event", { p_event_id: eventId, p_attendee: null, p_name: `Guest ${n}`, p_email: email, p_idempotency_key: `race-${stamp}-${n}-${randomUUID().slice(0, 8)}`, p_ip_hash: null });
async function state(eventId) {
  const [{ data: event }, { data: rows }] = await Promise.all([
    admin.from("events").select("capacity, confirmed_count, waitlist_count").eq("id", eventId).single(),
    admin.from("event_registrations").select("id, status, created_at, promoted_at").eq("event_id", eventId),
  ]);
  const count = (status) => rows.filter((row) => row.status === status).length;
  return { event, rows, confirmed: count("confirmed"), waitlisted: count("waitlisted"), cancelled: count("cancelled") };
}

describe("concurrent registrations", () => {
  test("60 guests at once for 10 seats: exactly 10 seats, 50 on the waitlist", async () => {
    const id = await newEvent(10);
    const results = await Promise.all(Array.from({ length: 60 }, (_, n) => register(id, n)));
    assert.equal(results.filter((result) => result.error).length, 0, results.find((result) => result.error)?.error?.message);
    const statuses = results.map((result) => result.data.status);
    assert.equal(statuses.filter((status) => status === "confirmed").length, 10);
    assert.equal(statuses.filter((status) => status === "waitlisted").length, 50);
    const now = await state(id);
    assert.deepEqual([now.confirmed, now.waitlisted], [10, 50]);
    assert.deepEqual([now.event.confirmed_count, now.event.waitlist_count], [10, 50], "counters match the rows");
  });

  test("without a waitlist, 40 guests for 5 seats: 5 in, 35 refused", async () => {
    const id = await newEvent(5, false);
    const results = await Promise.all(Array.from({ length: 40 }, (_, n) => register(id, n)));
    assert.equal(results.filter((result) => !result.error).length, 5);
    assert.ok(results.filter((result) => result.error).every((result) => result.error.message.includes("event_full")));
    assert.equal((await state(id)).event.confirmed_count, 5);
  });

  test("the same address 20 times at once is one guest", async () => {
    const id = await newEvent(50);
    const results = await Promise.all(Array.from({ length: 20 }, (_, n) => register(id, n, `twin-${stamp}@example.test`)));
    assert.equal(results.filter((result) => result.error).length, 0);
    assert.equal(results.filter((result) => !result.data.duplicate).length, 1);
    assert.equal((await state(id)).rows.length, 1);
  });

  test("cancellations racing new registrations never overfill and promote in join order", async () => {
    const id = await newEvent(8);
    for (let n = 0; n < 8; n += 1) assert.ifError((await register(id, n)).error);
    const waiting = [];
    for (let n = 8; n < 14; n += 1) { const result = await register(id, n); assert.equal(result.data.status, "waitlisted"); waiting.push(result.data.id); }
    const { rows } = await state(id);
    const seated = rows.filter((row) => row.status === "confirmed").slice(0, 4);
    const jobs = [
      ...seated.map((row) => admin.rpc("cancel_event_registration", { p_registration_id: row.id, p_token_version: 1 })),
      // The same cancellation twice: the second changes nothing.
      admin.rpc("cancel_event_registration", { p_registration_id: seated[0].id, p_token_version: 1 }),
      ...Array.from({ length: 12 }, (_, n) => register(id, 100 + n)),
    ];
    const results = await Promise.all(jobs);
    assert.equal(results.filter((result) => result.error).length, 0, results.find((result) => result.error)?.error?.message);
    const now = await state(id);
    assert.equal(now.confirmed, 8, "never more guests than seats");
    assert.equal(now.cancelled, 4);
    assert.deepEqual([now.event.confirmed_count, now.event.waitlist_count], [now.confirmed, now.waitlisted], "counters match the rows");
    const promoted = now.rows.filter((row) => row.promoted_at).map((row) => row.id);
    assert.deepEqual(promoted.sort(), waiting.slice(0, 4).sort(), "the four oldest on the waitlist got the seats");
  });

  test("raising capacity while guests register keeps the counters exact", async () => {
    const id = await newEvent(3);
    for (let n = 0; n < 9; n += 1) await register(id, n);
    const [raise] = await Promise.all([
      organizer.client.from("events").update({ capacity: 6 }).eq("id", id),
      ...Array.from({ length: 6 }, (_, n) => register(id, 50 + n)),
    ]);
    assert.ifError(raise.error);
    const now = await state(id);
    assert.equal(now.confirmed, 6);
    assert.deepEqual([now.event.confirmed_count, now.event.waitlist_count], [now.confirmed, now.waitlisted]);
  });
});
