/**
 * E2E helper: public URLs for a profile's Modes under the opaque share contract.
 *
 * Personal is the canonical `/<username>`. Event and Business open only at
 * `/s/<token>`. The helper mints (or re-derives) the same locator the app does,
 * using the runner's local server key, so a mismatch with the app shows up as
 * a 404 in the calling test. Local Supabase only.
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

function derive(profileId, modeId, nonceHex) {
  const encoded = process.env.QUICK_SHARE_TOKEN_KEY;
  assert(encoded, "QUICK_SHARE_TOKEN_KEY is required (set by the local E2E runner)");
  return createHmac("sha256", Buffer.from(encoded, "base64url"))
    .update("setuvara-mode-share-v1\0", "utf8")
    .update(profileId.toLowerCase(), "utf8")
    .update("\0", "utf8")
    .update(modeId.toLowerCase(), "utf8")
    .update(Buffer.from(nonceHex, "hex"))
    .digest("base64url");
}

const hex = (value) => String(value).replace(/^\\x/, "");

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
  if (mode !== "personal") {
    const db = admin();
    const ids = modeIds(username, mode);
    const profile = { id: ids.profile_id };
    const modeRow = { id: ids.mode_id };
    const read = () => db.from("mode_share_locators").select("nonce").eq("mode_id", modeRow.id).maybeSingle();
    let { data: locator } = await read();
    if (!locator) {
      const nonce = randomBytes(32).toString("hex");
      const token = derive(profile.id, modeRow.id, nonce);
      await db.from("mode_share_locators").insert({
        profile_id: profile.id,
        mode_id: modeRow.id,
        nonce: `\\x${nonce}`,
        token_hash: `\\x${createHash("sha256").update(token, "utf8").digest("hex")}`,
      });
      ({ data: locator } = await read());
    }
    path = `/s/${derive(profile.id, modeRow.id, hex(locator.nonce))}`;
  }
  const url = new URL(path, appUrl);
  if (source) url.searchParams.set("source", source);
  return url.toString();
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
  const token = url.pathname.match(/^\/s\/([A-Za-z0-9_-]{43})$/)?.[1];
  if (!token) return "personal";
  const { data, error } = await admin().rpc("resolve_mode_share", { p_token: token });
  assert.ifError(error);
  return data?.mode ?? null;
}
