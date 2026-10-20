import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Token sealing and OAuth state for platform sign-in. Server only: provider tokens are sealed with
 * AES-256-GCM under a key that lives outside the database, and bound to their account so a sealed
 * token copied onto another row does not open.
 */

const VERSION = "v1";

/** SOCIAL_TOKEN_KEY: 32 bytes, as base64 or 64 hex characters. */
export function tokenKey(raw = process.env.SOCIAL_TOKEN_KEY?.trim() ?? "") {
  const key = /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("social_token_key_invalid");
  return key;
}

export function sealToken(plain: string, binding: string, key = tokenKey()) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(binding));
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return `${VERSION}.${Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64url")}`;
}

export function openToken(sealed: string, binding: string, key = tokenKey()) {
  const [version, payload] = sealed.split(".");
  if (version !== VERSION || !payload) throw new Error("social_token_unreadable");
  const raw = Buffer.from(payload, "base64url");
  const decipher = createDecipheriv("aes-256-gcm", key, raw.subarray(0, 12));
  decipher.setAAD(Buffer.from(binding));
  decipher.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8");
}

export function randomToken(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}

/** PKCE (RFC 7636), S256. */
export function pkcePair() {
  const verifier = randomToken(48);
  return { verifier, challenge: createHash("sha256").update(verifier).digest("base64url") };
}

export type OAuthState = { provider: string; state: string; user: string; verifier?: string; exp: number };

/** The short-lived state cookie: signed, so it can't be forged, and tied to the signed-in member. */
export function signState(value: OAuthState, key = tokenKey()) {
  const body = Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${body}.${createHmac("sha256", key).update(`state:${body}`).digest("base64url")}`;
}

export function readState(cookie: string | undefined, key = tokenKey(), now = Date.now()): OAuthState | null {
  if (!cookie) return null;
  const [body, mac] = cookie.split(".");
  if (!body || !mac) return null;
  const expected = createHmac("sha256", key).update(`state:${body}`).digest();
  const given = Buffer.from(mac, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const value = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as OAuthState;
    return typeof value.exp === "number" && value.exp > now ? value : null;
  } catch {
    return null;
  }
}

export function sameSecret(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
