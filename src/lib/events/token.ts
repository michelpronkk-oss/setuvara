import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function secret() {
  return process.env.EVENT_TOKEN_SECRET?.trim() || process.env.ACTIONS_HASH_SECRET?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";
}

// Each purpose signs with its own domain, so a guest link can never be replayed as an admission ticket.
type Purpose = "guest";

function mac(purpose: Purpose, id: string, version: number, key: string) {
  return createHmac("sha256", key).update(`setuvara-event-${purpose}-v1:${id}:${version}`).digest("base64url").slice(0, 32);
}

/** A guest's private link token: the registration, its version and a signature. */
export function signGuestToken(registrationId: string, version: number) {
  const key = secret();
  if (!key) throw new Error("event_secret_missing");
  return `${registrationId}.${version}.${mac("guest", registrationId, version, key)}`;
}

/** The registration and version a guest token belongs to, or null when it was altered. */
export function readGuestToken(token: string | null | undefined) {
  if (typeof token !== "string" || token.length > 100) return null;
  const [id, versionText, signature, extra] = token.split(".");
  const key = secret();
  if (!key || extra !== undefined || !id || !UUID.test(id) || !/^[1-9][0-9]{0,3}$/.test(versionText ?? "") || !signature) return null;
  const version = Number(versionText);
  const expected = Buffer.from(mac("guest", id, version, key));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given) ? { id, version } : null;
}
