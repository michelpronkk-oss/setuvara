/**
 * E2E helper: public URLs for a profile's Modes under the opaque share contract.
 *
 * Personal is the canonical `/<username>`. Event and Business open only at
 * `/s/<short id>`. The helper reads (or mints, through the same database
 * default the app uses) each Mode's short id. Local Supabase only.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash, createHmac, randomBytes } from "node:crypto";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const appUrl = process.env.E2E_APP_URL ?? "http://127.0.0.1:3014";

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.E2E_LOCAL_SERVICE_KEY;
  assert(url && new URL(url).hostname === "127.0.0.1", "Mode share helper is local-only");
  assert(key, "Local service key is required to mint Mode share locators");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

// Legacy tokens only: any key works, since the database stores just the hash.
function derive(profileId, modeId, nonceHex) {
  const encoded = process.env.QUICK_SHARE_TOKEN_KEY ?? randomBytes(32).toString("base64url");
  return createHmac("sha256", Buffer.from(encoded, "base64url"))
    .update("setuvara-mode-share-v1\0", "utf8")
    .update(profileId.toLowerCase(), "utf8")
    .update("\0", "utf8")
    .update(modeId.toLowerCase(), "utf8")
    .update(Buffer.from(nonceHex, "hex"))
    .digest("base64url");
}

// Production's service role cannot read profiles or profile_modes, so the
// helper looks the ids up straight in the local database, like the fixtures do.
function modeIds(username, mode) {
  assert.match(username, /^[a-z0-9_]{3,24}$/);
  assert.match(mode, /^(event|business)$/);
  const sql = `select profiles.id as profile_id, profile_modes.id as mode_id from public.profiles join public.profile_modes on profile_modes.profile_id = profiles.id where profiles.username = '${username}' and profile_modes.slug = '${mode}'`;
  const output = execFileSync(process.execPath, [resolve(process.cwd(), "node_modules/supabase/dist/supabase.js"), "db", "query", "--local", "--output-format", "json", sql], { encoding: "utf8" });
  const row = JSON.parse(output.slice(output.indexOf("{"))).rows?.[0];
  assert(row?.profile_id && row?.mode_id, `No local ${mode} Mode for ${username}`);
  return row;
}

/** Absolute public URL for one Mode, with an optional `source`. */
export async function publicModeUrl(username, mode, { source } = {}) {
  let path = `/${username}`;
  if (mode !== "personal") path = `/s/${await modeShortId(username, mode)}`;
  const url = new URL(path, appUrl);
  if (source) url.searchParams.set("source", source);
  return url.toString();
}

/** The Mode's stable short id, minted the same way the app does (database default). */
export async function modeShortId(username, mode) {
  const db = admin();
  const ids = modeIds(username, mode);
  const read = () => db.from("mode_share_locators").select("short_id").eq("mode_id", ids.mode_id).maybeSingle();
  let { data: locator } = await read();
  if (!locator) {
    await db.from("mode_share_locators").insert({ profile_id: ids.profile_id, mode_id: ids.mode_id });
    ({ data: locator } = await read());
  }
  assert.match(locator?.short_id ?? "", /^[0-9A-Za-z]{8}$/);
  return locator.short_id;
}

/**
 * Gives the Mode's locator a legacy 43-character token, as links shared before
 * short ids carry, and returns that token. The short id stays as it is.
 */
export async function mintLegacyModeToken(username, mode) {
  const db = admin();
  const ids = modeIds(username, mode);
  await modeShortId(username, mode);
  const nonce = randomBytes(32).toString("hex");
  const token = derive(ids.profile_id, ids.mode_id, nonce);
  const { error } = await db.from("mode_share_locators").update({
    nonce: `\\x${nonce}`,
    token_hash: `\\x${createHash("sha256").update(token, "utf8").digest("hex")}`,
  }).eq("mode_id", ids.mode_id);
  assert.ifError(error);
  return token;
}

/** Path form of publicModeUrl, for helpers that prefix the app origin themselves. */
export async function publicModePath(username, mode, options) {
  const url = new URL(await publicModeUrl(username, mode, options));
  return `${url.pathname}${url.search}`;
}

/** Which Mode a public URL or redirect location lands on, resolved like the app does. */
export async function landedMode(location) {
  const url = new URL(location, appUrl);
  assert.equal(url.searchParams.get("mode"), null, "Public URLs never carry ?mode=");
  const token = url.pathname.match(/^\/s\/([0-9A-Za-z]{8}|[A-Za-z0-9_-]{43})$/)?.[1];
  if (!token) return "personal";
  const { data, error } = await admin().rpc("resolve_mode_share", { p_token: token });
  assert.ifError(error);
  return data?.mode ?? null;
}
