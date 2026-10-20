import "server-only";

import { getPublicOrigin } from "@/lib/app/viewer";
import { isSocialProvider } from "@/lib/social/model";
import type { PrivacyKind } from "./model";
import { handlePlatformSignal, metaCallbackSecrets } from "./server";
import { verifySignedRequest } from "./signed-request";

/** Only Instagram signs in through Meta. Other providers have no such callback. */
const META_PROVIDERS = new Set(["instagram"]);
const MAX_BODY = 8 * 1024;

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

async function signedRequestFrom(request: Request) {
  const length = Number(request.headers.get("content-length") ?? "0");
  if (length > MAX_BODY) return null;
  const text = await request.text().catch(() => "");
  if (text.length > MAX_BODY) return null;
  const type = request.headers.get("content-type") ?? "";
  if (type.includes("application/json")) {
    try { return (JSON.parse(text) as { signed_request?: unknown }).signed_request ?? null; } catch { return null; }
  }
  return new URLSearchParams(text).get("signed_request");
}

/**
 * Meta's deauthorize and data deletion callbacks. The signed_request must carry a valid HMAC from
 * our app secret or nothing happens. Deletion answers with { url, confirmation_code }; a failure
 * answers 500 so Meta retries, and the status page never says "deleted" for it.
 */
export async function metaCallback(request: Request, params: Promise<{ provider: string }>, kind: Exclude<PrivacyKind, "account_deletion">) {
  const { provider } = await params;
  if (!isSocialProvider(provider) || !META_PROVIDERS.has(provider)) return json({ error: "not_found" }, 404);
  const secrets = metaCallbackSecrets();
  if (!secrets.length) {
    console.error("meta_callback_unconfigured", kind);
    return json({ error: "unavailable" }, 503);
  }

  const verified = verifySignedRequest(await signedRequestFrom(request), secrets);
  if (!verified.ok) {
    console.warn("meta_callback_rejected", kind, verified.error);
    return json({ error: "invalid_signed_request" }, 400);
  }

  try {
    const { request: row, finished } = await handlePlatformSignal(kind, provider, verified.value);
    console.info("meta_callback_handled", kind, row.status);
    if (!finished) return json({ error: "retry" }, 500);
    if (kind === "platform_deauthorize") return json({ success: true });
    const origin = await getPublicOrigin(request.headers);
    return json({ url: `${origin}/data-deletion/status?code=${row.confirmation_code}`, confirmation_code: row.confirmation_code });
  } catch (error) {
    console.error("meta_callback_failed", kind, error instanceof Error ? error.message : "unexpected");
    return json({ error: "retry" }, 500);
  }
}
