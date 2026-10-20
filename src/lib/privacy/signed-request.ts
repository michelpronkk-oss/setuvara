import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Meta's signed_request, as sent to the deauthorize and data deletion callbacks:
 * `<base64url HMAC-SHA256 signature>.<base64url JSON payload>`, signed over the encoded payload
 * with the app secret. Pure, so it can be tested without a server.
 * https://developers.facebook.com/docs/development/create-an-app/app-dashboard/data-deletion-callback
 */

export type SignedRequest = { userId: string; issuedAt: Date };
export type SignedRequestError = "malformed" | "bad_signature" | "bad_algorithm" | "no_user" | "bad_time";

const MAX_LENGTH = 4096;
/** A signal from the future is forged or a broken clock. Old signals stay valid: Meta retries. */
const CLOCK_SKEW_MS = 10 * 60 * 1000;

const base64url = /^[A-Za-z0-9_-]+={0,2}$/;

function decode(part: string) {
  return Buffer.from(part.replace(/=+$/, ""), "base64url");
}

/** Checks the signature against each configured secret, then reads user_id and issued_at. */
export function verifySignedRequest(raw: unknown, secrets: string[], now = Date.now()): { ok: true; value: SignedRequest } | { ok: false; error: SignedRequestError } {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > MAX_LENGTH) return { ok: false, error: "malformed" };
  const dot = raw.indexOf(".");
  if (dot <= 0 || dot === raw.length - 1) return { ok: false, error: "malformed" };
  const signature = raw.slice(0, dot);
  const payload = raw.slice(dot + 1);
  if (!base64url.test(signature) || !base64url.test(payload)) return { ok: false, error: "malformed" };

  const given = decode(signature);
  const matches = secrets.filter(Boolean).some((secret) => {
    const expected = createHmac("sha256", secret).update(payload).digest();
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
  if (!matches) return { ok: false, error: "bad_signature" };

  let data: Record<string, unknown>;
  try {
    const parsed = JSON.parse(decode(payload).toString("utf8")) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return { ok: false, error: "malformed" };
    data = parsed as Record<string, unknown>;
  } catch {
    return { ok: false, error: "malformed" };
  }

  if (typeof data.algorithm !== "string" || data.algorithm.toUpperCase() !== "HMAC-SHA256") return { ok: false, error: "bad_algorithm" };
  const userId = typeof data.user_id === "string" ? data.user_id.trim() : typeof data.user_id === "number" && Number.isSafeInteger(data.user_id) ? String(data.user_id) : "";
  if (!/^[A-Za-z0-9_-]{1,200}$/.test(userId)) return { ok: false, error: "no_user" };
  const issued = typeof data.issued_at === "number" ? data.issued_at : Number.NaN;
  if (!Number.isFinite(issued) || issued <= 0 || issued * 1000 > now + CLOCK_SKEW_MS) return { ok: false, error: "bad_time" };
  return { ok: true, value: { userId, issuedAt: new Date(Math.floor(issued) * 1000) } };
}

/** Builds a signed_request the way Meta does. Tests and local checks only. */
export function signRequest(payload: Record<string, unknown>, secret: string) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${createHmac("sha256", secret).update(body).digest("base64url")}.${body}`;
}
