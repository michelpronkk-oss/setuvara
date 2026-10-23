import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

// Public handle foundation against local Setuvara Supabase and a running app: /@ alias, renamed
// usernames (kept for their owner, 307 to the current one), reserved routes, unpublished owners,
// Quick QR, Tap and /s/ links after a rename, and a concurrent rename/claim race.
const appUrl = process.env.E2E_APP_URL ?? "http://127.0.0.1:3014";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceKey = process.env.E2E_LOCAL_SERVICE_KEY;
const dbUrl = process.env.E2E_LOCAL_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:55432/postgres";
assert(supabaseUrl && new URL(supabaseUrl).hostname === "127.0.0.1", "Handles E2E requires local Setuvara Supabase");
assert(new URL(dbUrl).hostname === "127.0.0.1", "Handles E2E only touches the local database");
assert(publishableKey && serviceKey, "Local keys must be supplied in process memory");

const options = { auth: { autoRefreshToken: false, persistSession: false } };
const admin = createClient(supabaseUrl, serviceKey, options);
const suffix = `${Date.now().toString(36).slice(-4)}${randomBytes(2).toString("hex")}`;
const userIds = [];
const psql = (sql) => execFileSync("psql", [dbUrl, "-v", "ON_ERROR_STOP=1", "-Atc", sql], { encoding: "utf8" }).trim();
let checks = 0;
const check = (label) => { checks += 1; console.log(`ok ${checks} - ${label}`); };
const get = (path) => fetch(`${appUrl}${path}`, { redirect: "manual" });
const where = (response) => response.headers.get("location") && new URL(response.headers.get("location"), appUrl);

async function member(role, published = true) {
  const username = `hd_${role}_${suffix}`;
  const email = `${username}@example.test`;
  const password = `${randomBytes(18).toString("base64url")}Aa1!`;
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { username, display_name: `Handle ${role}` } });
  assert.ifError(created.error);
  userIds.push(created.data.user.id);
  if (published) psql(`update public.profiles set is_published = true where id = '${created.data.user.id}'`);
  const client = createClient(supabaseUrl, publishableKey, options);
  assert.ifError((await client.auth.signInWithPassword({ email, password })).error);
  return { id: created.data.user.id, username, client };
}
const rename = async (who, next) => who.client.from("profiles").update({ username: next }).eq("id", who.id);

try {
  const ana = await member("ana");
  const ben = await member("ben");
  const cy = await member("cy", false);

  // /@ alias.
  let response = await get(`/@${ana.username}?source=qr`);
  assert.equal(response.status, 308); assert.equal(where(response).pathname, `/${ana.username}`); assert.equal(where(response).searchParams.get("source"), "qr");
  check("/@handle is a 308 to /handle and keeps the query");
  response = await get(`/%40${ana.username.toUpperCase()}`);
  assert.equal(response.status, 308); assert.equal(where(response).pathname, `/${ana.username}`); check("encoded and upper-case /@ resolve to the lower-case handle");
  assert.equal((await get(`/@${ana.username}`).then((r) => fetch(new URL(r.headers.get("location"), appUrl)))).status, 200); check("the alias lands on the live page");
  for (const path of ["/@ab", "/@roadmap", "/@a-b-c", "/@x/../admin"]) assert.notEqual((await get(path)).status, 308, path);
  check("short, reserved and malformed /@ paths are not redirected");
  assert.equal((await get("/roadmap")).status, 200); check("reserved routes still serve their own page");

  // Fixtures that must survive a rename: Quick QR, Tap, /s/ for Business.
  const quickToken = randomBytes(32).toString("base64url");
  psql(`insert into public.quick_share_locators (profile_id, nonce, token_hash) values ('${ana.id}', decode('${randomBytes(32).toString("hex")}','hex'), decode('${createHash("sha256").update(quickToken).digest("hex")}','hex'))`);
  const tapToken = randomBytes(32).toString("base64url");
  psql(`insert into public.tap_devices (owner_profile_id, token_hash, label, kind, status, claimed_at) values ('${ana.id}', decode('${createHash("sha256").update(tapToken).digest("hex")}','hex'), 'Card', 'card', 'active', now())`);
  const shortId = psql(`insert into public.mode_share_locators (profile_id, mode_id, nonce, token_hash) select '${ana.id}', id, decode('${randomBytes(32).toString("hex")}','hex'), decode('${randomBytes(32).toString("hex")}','hex') from public.profile_modes where profile_id='${ana.id}' and slug='business' returning short_id`).split("\n")[0];
  assert.match(shortId, /^[0-9A-Za-z]{8}$/);

  // Rename: old link 307s to the new one, keeping a safe source.
  const oldName = ana.username;
  const newName = `hd_ana2_${suffix}`;
  assert.ifError((await rename(ana, newName)).error);
  response = await get(`/${oldName}?source=qr`);
  assert.equal(response.status, 307); assert.equal(where(response).pathname, `/${newName}`); assert.equal(where(response).searchParams.get("source"), "qr");
  check("the old username 307s to the new one with its source");
  response = await get(`/${oldName}?source=${encodeURIComponent("x<script>")}`);
  assert.equal(response.status, 307); assert.equal(where(response).search, ""); check("an unsafe source is dropped from the redirect");
  response = await get(`/@${oldName}`);
  assert.equal(where(response).pathname, `/${oldName}`); check("/@old goes through the alias, then one 307 hop");
  assert.equal((await get(`/${newName}`)).status, 200); check("the new username serves the page");
  const canonical = (await (await get(`/${newName}`)).text()).match(/<link rel="canonical" href="([^"]+)"/)?.[1];
  assert.equal(canonical, `https://setuvara.com/${newName}`); check("canonical points at the current username");

  // Everything printed before the rename still works.
  response = await get(`/q/${quickToken}`);
  assert.equal(response.status, 303); assert.equal(where(response).pathname, `/${newName}`); check("Quick QR resolves to the new username");
  response = await get(`/t/${tapToken}`);
  assert.equal(response.status, 303); assert.equal(where(response).pathname, `/${newName}`); check("Tap (NFC) resolves to the new username");
  assert.equal((await get(`/s/${shortId}`)).status, 200); check("the Business /s/ link still renders in place");
  assert.equal((await get(`/u/${oldName}`)).status, 308); check("/u/old still 308s, then the old name 307s");

  // Ownership: nobody else can take the old name; the owner can.
  const taken = await rename(ben, oldName);
  assert.ok(taken.error); assert.equal(taken.error.code, "23505"); check("another member cannot claim the old name");
  assert.equal((await ben.client.rpc("is_username_available", { candidate_username: oldName })).data, false); check("availability says taken to others");
  assert.equal((await ana.client.rpc("is_username_available", { candidate_username: oldName })).data, true); check("and available to its owner");
  assert.ok((await rename(ben, "roadmap")).error); check("a reserved route can't be taken by renaming");
  assert.ok((await ana.client.from("handle_history").select("handle")).error || (await ana.client.from("handle_history").select("handle")).data.length === 0); check("members can't read handle history");

  // Owner takes it back (after the 30-day window): no loop, the in-between name points back in one hop.
  assert.ok((await rename(ana, oldName)).error?.message.includes("username_change_limit")); check("a second change in 30 days is refused by the database");
  psql(`update private.username_changes set changed_at = now() - interval '31 days' where profile_id='${ana.id}'`);
  assert.ifError((await rename(ana, oldName)).error);
  assert.equal((await get(`/${oldName}`)).status, 200);
  response = await get(`/${newName}`);
  assert.equal(response.status, 307); assert.equal(where(response).pathname, `/${oldName}`); check("taking it back serves it live and redirects the other way, one hop");

  // Rate limit: the owner can see when the next change opens; another member is not affected.
  assert.ok(new Date((await ana.client.rpc("handle_next_change_at", { p_mode: "personal" })).data) > new Date(Date.now() + 29 * 864e5)); check("the owner sees when the next change opens");
  assert.equal((await ben.client.rpc("handle_next_change_at", { p_mode: "personal" })).data, null); check("a member who hasn't changed can change now");

  // Unpublished owners don't redirect.
  const cyOld = cy.username;
  assert.ifError((await rename(cy, `hd_cy2_${suffix}`)).error);
  assert.equal((await get(`/${cyOld}`)).status, 404); check("an unpublished owner's old name is a plain 404");
  assert.equal((await get(`/hd_nobody_${suffix}`)).status, 404); check("unknown names are the same 404");

  // Race: Ana renames away from a name while Ben claims it at the same moment.
  for (let round = 0; round < 3; round += 1) {
    const current = psql(`select username from public.profiles where id='${ben.id}'`);
    const away = `hd_race${round}_${suffix}`;
    const slow = new Promise((resolve) => {
      const child = spawn("psql", [dbUrl, "-qAt", "-c", `begin; update public.profiles set username='${away}' where id='${ben.id}'; select pg_sleep(1); commit;`], { stdio: "ignore" });
      child.on("exit", resolve);
    });
    await new Promise((resolve) => setTimeout(resolve, 300));
    let raced = "";
    try { psql(`update public.profiles set username='${current}' where id='${cy.id}'`); raced = "won"; } catch (error) { raced = String(error.stderr ?? error.message); }
    await slow;
    assert.match(raced, /username_held/, `round ${round}`);
    assert.equal(psql(`select coalesce((select 'ben' from public.handle_history where handle='${current}' and profile_id='${ben.id}'), 'lost')`), "ben");
    if (round < 2) psql(`delete from private.username_changes where profile_id='${ben.id}'`);
  }
  check("a concurrent claim of a name being renamed away is refused every time (3 rounds)");

  console.log(`Handles E2E passed (${checks} checks).`);
} finally {
  for (const id of userIds) await admin.auth.admin.deleteUser(id);
}
