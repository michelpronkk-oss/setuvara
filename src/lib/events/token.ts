import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function secret() {
  return process.env.EVENT_TOKEN_SECRET?.trim() || process.env.ACTIONS_HASH_SECRET?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";
}

// Each purpose signs with its own domain, so a guest link can never be replayed as an admission ticket.
type Purpose = "guest" | "pass";

function mac(purpose: Purpose, id: string, version: number, key: string) {
  return createHmac("sha256", key).update(`setuvara-event-${purpose}-v1:${id}:${version}`).digest("base64url").slice(0, 32);
}

function sign(purpose: Purpose, registrationId: string, version: number) {
  const key = secret();
  if (!key) throw new Error("event_secret_missing");
  return `${registrationId}.${version}.${mac(purpose, registrationId, version, key)}`;
}

function read(purpose: Purpose, token: string | null | undefined) {
  if (typeof token !== "string" || token.length > 100) return null;
  const [id, versionText, signature, extra] = token.split(".");
  const key = secret();
  if (!key || extra !== undefined || !id || !UUID.test(id) || !/^[1-9][0-9]{0,3}$/.test(versionText ?? "") || !signature) return null;
  const version = Number(versionText);
  const expected = Buffer.from(mac(purpose, id, version, key));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given) ? { id, version } : null;
}

/** A guest's private link token: the registration, its version and a signature. */
export const signGuestToken = (registrationId: string, version: number) => sign("guest", registrationId, version);

/** The registration and version a guest token belongs to, or null when it was altered. */
export const readGuestToken = (token: string | null | undefined) => read("guest", token);

/**
 * A guest's door pass, shown as a QR code on their page. It only opens the organizer's check-in
 * screen, so it can be shown to anyone at the door without handing over the private link.
 */
export const signPassToken = (registrationId: string, version: number) => sign("pass", registrationId, version);

export const readPassToken = (token: string | null | undefined) => read("pass", token);
