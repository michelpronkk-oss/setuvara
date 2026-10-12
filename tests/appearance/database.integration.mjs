/**
 * Appearance database rules against a LOCAL Setuvara stack (after `supabase db reset`):
 * the constraint, the plan trigger, the signup defaults and the public Live Context RPC.
 *
 *   E2E_SUPABASE_URL=http://127.0.0.1:54321 \
 *   E2E_LOCAL_SERVICE_KEY=<local service role key> \
 *   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<local publishable key> \
 *   node --test tests/appearance/database.integration.mjs
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { after, before, describe, test } from "node:test";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.E2E_SUPABASE_URL ?? "http://127.0.0.1:54321";
const serviceKey = process.env.E2E_LOCAL_SERVICE_KEY;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
assert.equal(new URL(supabaseUrl).hostname, "127.0.0.1", "Runs against local Setuvara only");
assert(serviceKey && publishableKey, "Local service and publishable keys are required");

const admin = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
const stamp = Date.now().toString(36);
const users = [];
const localSql = (sql) => execFileSync(process.execPath, [resolve(process.cwd(), "node_modules/supabase/dist/supabase.js"), "db", "query", "--local", "--output-format", "json", sql], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });

async function member(name, plan, metadata = {}) {
  const email = `${name}${stamp}@example.test`;
  const password = `Db-${crypto.randomUUID()}aA1!`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { username: `${name}${stamp}`.slice(0, 30), display_name: name, ...metadata } });
  assert.ifError(error);
  users.push(data.user.id);
  if (plan !== "free") {
    localSql(`insert into public.billing_subscriptions(dodo_subscription_id,user_id,dodo_customer_id,dodo_product_id,plan_code,billing_interval,provider_status,current_period_end,last_provider_event_id,last_provider_event_at,last_sync_started_at)
      values ('sub_dbappearance${data.user.id.replaceAll("-", "").slice(0, 16)}','${data.user.id}','cus_dbappearance','pdt_dbappearance','${plan}','monthly','active',now() + interval '30 days','dbappearancefixture',now(),now())`);
  }
  const client = createClient(supabaseUrl, publishableKey, { auth: { autoRefreshToken: false, persistSession: false } });
  assert.ifError((await client.auth.signInWithPassword({ email, password })).error);
  return { id: data.user.id, client, username: `${name}${stamp}`.slice(0, 30) };
}
const save = (user, appearance, slug = "personal") => user.client.from("profile_modes").update({ appearance }).eq("profile_id", user.id).eq("slug", slug).select("appearance");
const saved = async (user, slug = "personal") => (await admin.from("profile_modes").select("appearance").eq("profile_id", user.id).eq("slug", slug).single()).data.appearance;

let free;
let plus;
before(async () => {
  free = await member("dbfree", "free");
  plus = await member("dbplus", "plus");
});
after(async () => {
  for (const id of users) {
    localSql(`delete from public.billing_subscriptions where user_id = '${id}'`);
    await admin.auth.admin.deleteUser(id);
  }
});

describe("profile_modes appearance", () => {
  test("new accounts start on Immersive (Personal, Event) and Clean (Business)", async () => {
    assert.equal((await saved(free, "personal")).theme, "immersive");
    assert.equal((await saved(free, "event")).theme, "immersive");
    assert.equal((await saved(free, "business")).theme, "clean");
  });

  test("a validated Free signup hint picks Clean; a Plus hint grants nothing", async () => {
    const hinted = await member("dbhintclean", "free", { appearance: "clean" });
    assert.equal((await saved(hinted)).theme, "clean");
    const sneaky = await member("dbhintfilm", "free", { appearance: "film" });
    assert.equal((await saved(sneaky)).theme, "immersive");
  });

  test("Free accepts Immersive, Clean and the Free controls", async () => {
    const { error } = await save(free, { theme: "clean", accent: "#FF5A4F", portraitZoom: 115, portraitShowUsername: true, socialStyle: "row", namePosition: "bottom", readability: "auto", motion: "off", soundtrackPresentation: "minimal" });
    assert.ifError(error);
  });

  test("Social icons placement: Both, In links and Under name are Free; nothing else is accepted", async () => {
    for (const socialPlacement of ["both", "links", "name"]) {
      const { error } = await save(free, { theme: "immersive", accent: "#FF5A4F", socialStyle: "rail", socialPlacement });
      assert.ifError(error);
    }
    assert(await save(free, { theme: "immersive", accent: "#FF5A4F", socialPlacement: "everywhere" }).then((result) => result.error), "unknown placement rejected");
  });

  test("Alignment is Free: auto, left and center save; nothing else", async () => {
    for (const identityAlign of ["auto", "left", "center"]) assert.ifError((await save(free, { theme: "immersive", accent: "#FF5A4F", identityAlign })).error);
    assert(await save(free, { theme: "immersive", accent: "#FF5A4F", identityAlign: "right" }).then((result) => result.error), "unknown alignment rejected");
  });

  test("Free cannot introduce a Plus Appearance or Plus control", async () => {
    for (const appearance of [{ theme: "glow" }, { theme: "immersive", namePosition: "top" }, { theme: "immersive", readability: "deep" }, { theme: "immersive", motion: "full" }, { theme: "immersive", soundtrackPresentation: "featured" }, { theme: "immersive", portraitNameSize: "statement" }]) {
      const { error } = await save(free, { accent: "#FF5A4F", ...appearance });
      assert(error, `rejected: ${JSON.stringify(appearance)}`);
    }
  });

  test("Plus accepts all ten and every control", async () => {
    for (const theme of ["immersive", "motion", "aura", "clean", "glow", "scene", "frame", "stack", "social", "film"]) {
      const { error } = await save(plus, { theme, accent: "#6B4EFF", namePosition: "top", readability: "soft", motion: "full", soundtrackPresentation: "featured", portraitNameSize: "large", portraitZoom: 140 });
      assert.ifError(error);
    }
  });

  test("a downgraded member keeps the saved look and can still edit other values", async () => {
    localSql(`update public.billing_subscriptions set provider_status = 'expired' where user_id = '${plus.id}'`);
    const before = await saved(plus);
    assert.equal(before.theme, "film");
    const { error } = await save(plus, { ...before, accent: "#C7FF4A" });
    assert.ifError(error);
    assert.equal((await saved(plus)).theme, "film", "downgrade never deletes configuration");
    assert(await save(plus, { ...before, theme: "glow" }).then((result) => result.error), "but cannot switch to another Plus look");
  });

  test("the constraint rejects center, unknown keys, bad zoom and imageFocus", async () => {
    for (const appearance of [{ namePosition: "center" }, { imageFocus: { x: 1, y: 1 } }, { portraitZoom: 125 }, { theme: "neon" }, { accent: "red" }]) {
      const { error } = await save(free, { theme: "immersive", accent: "#FF5A4F", ...appearance });
      assert(error, `rejected: ${JSON.stringify(appearance)}`);
    }
  });

  test("RLS: a member cannot change someone else's Mode", async () => {
    const { data } = await free.client.from("profile_modes").update({ appearance: { theme: "clean", accent: "#FF5A4F" } }).eq("profile_id", plus.id).select("id");
    assert.equal(data?.length ?? 0, 0);
  });
});

describe("get_public_live_context", () => {
  test("only a live context's label, type and expiry; nothing once it ends", async () => {
    localSql(`update public.profiles set is_published = true where id = '${free.id}'`);
    const anon = createClient(supabaseUrl, publishableKey, { auth: { autoRefreshToken: false, persistSession: false } });
    assert.deepEqual((await anon.rpc("get_public_live_context", { p_username: free.username })).data, []);
    localSql(`insert into public.live_contexts(owner_user_id, context_type, label, venue, city, expires_at) values ('${free.id}', 'event', 'Rooftop', 'Secret venue', 'Lisbon', now() + interval '2 hours')`);
    const { data } = await anon.rpc("get_public_live_context", { p_username: free.username });
    assert.equal(data.length, 1);
    assert.deepEqual(Object.keys(data[0]).sort(), ["context_type", "expires_at", "label"]);
    assert.equal(data[0].label, "Rooftop");
    localSql(`update public.live_contexts set is_active = false where owner_user_id = '${free.id}'`);
    assert.deepEqual((await anon.rpc("get_public_live_context", { p_username: free.username })).data, []);
    assert.equal((await anon.from("live_contexts").select("id").eq("owner_user_id", free.id)).data?.length ?? 0, 0, "the table itself stays owner-only");
  });
});

describe("profile_modes slideshow and zoom out", () => {
  // Own members: the suites above expire the shared Plus subscription.
  let plus;
  let pro;
  before(async () => {
    plus = await member("dbslideplus", "plus");
    pro = await member("dbslidepro", "pro");
  });
  const slide = (user, x = 50) => ({ path: `${user.id}/${crypto.randomUUID()}.webp`, x, y: 40 });
  const setSlides = (user, slide_photos) => user.client.from("profile_modes").update({ slide_photos }).eq("profile_id", user.id).eq("slug", "personal").select("slide_photos");

  test("zoom out (70, 85) and slideshow speed are Free settings", async () => {
    for (const portraitZoom of [70, 85]) assert.ifError((await save(free, { theme: "immersive", accent: "#FF5A4F", portraitZoom })).error);
    for (const slideSpeed of ["slow", "medium", "fast"]) assert.ifError((await save(free, { theme: "immersive", accent: "#FF5A4F", slideSpeed })).error);
    assert(await save(free, { theme: "immersive", accent: "#FF5A4F", portraitZoom: 60 }).then((result) => result.error), "zoom 60 rejected");
    assert(await save(free, { theme: "immersive", accent: "#FF5A4F", slideSpeed: "warp" }).then((result) => result.error), "unknown speed rejected");
  });

  test("Free adds no slides; Plus one extra; Pro three", async () => {
    assert.match((await setSlides(free, [slide(free)])).error?.message ?? "", /slideshow_requires_plan/);
    assert.equal((await setSlides(plus, [slide(plus)])).error?.message, undefined, "Plus adds one");
    assert.match((await setSlides(plus, [slide(plus), slide(plus)])).error?.message ?? "", /slideshow_requires_plan/);
    assert.equal((await setSlides(pro, [slide(pro), slide(pro), slide(pro)])).error?.message, undefined, "Pro adds three");
    assert((await setSlides(pro, [slide(pro), slide(pro), slide(pro), slide(pro)])).error, "never more than three extras");
  });

  test("a downgraded member can still remove slides", async () => {
    const kept = [slide(free), slide(free)];
    assert.ifError((await admin.from("profile_modes").update({ slide_photos: kept }).eq("profile_id", free.id).eq("slug", "personal")).error);
    assert.ifError((await setSlides(free, kept.slice(1))).error);
    assert.ifError((await setSlides(free, [])).error);
  });

  test("slides must be the owner's own photo paths with a face point in range", async () => {
    for (const bad of [
      [{ path: `${free.id}/../x.webp`, x: 50, y: 50 }],
      [slide(free)],
      [{ ...slide(plus), x: 120 }],
      [{ ...slide(plus), extra: true }],
      [{ path: `${plus.id}/${crypto.randomUUID()}.gif`, x: 50, y: 50 }],
      [{ path: 123, x: 50, y: 50 }],
    ]) assert((await setSlides(plus, bad)).error, `rejected: ${JSON.stringify(bad)}`);
  });
});
