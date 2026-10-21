import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function secret() {
  return process.env.AUDIENCE_UNSUBSCRIBE_SECRET?.trim() || process.env.ACTIONS_HASH_SECRET?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";
}

function mac(id: string, key: string) {
  return createHmac("sha256", key).update(`unsubscribe:${id}`).digest("base64url").slice(0, 32);
}

/** The unsubscribe link's token: the recipient row and a signature, so nobody can guess another person's link. */
export function signUnsubscribe(recipientId: string) {
  const key = secret();
  if (!key) throw new Error("audience_secret_missing");
  return `${recipientId}.${mac(recipientId, key)}`;
}

/** The recipient a token belongs to, or null when it was altered. */
export function readUnsubscribe(token: string | null | undefined) {
  if (typeof token !== "string" || token.length > 80) return null;
  const [id, signature] = token.split(".");
  const key = secret();
  if (!key || !id || !signature || !UUID.test(id)) return null;
  const expected = Buffer.from(mac(id, key));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given) ? id : null;
}
