import { handleCommerceEvent } from "@/lib/commerce/events";
import { commerceOrigin } from "@/lib/commerce/public";
import type { VerifiedEvent } from "@/lib/commerce/provider";
import { commerceProvider, createCommerceServiceClient } from "@/lib/commerce/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Stripe Connect events for every seller account. The signature is checked on the
 * raw body before anything is read; each event id is handled once (a failed one
 * may run again when Stripe retries). Redirects never settle an order; this does.
 */
export async function POST(request: Request) {
  const provider = commerceProvider();
  if (!provider) return Response.json({ error: "Not configured." }, { status: 503 });
  const raw = await request.text();
  let verified: VerifiedEvent;
  try {
    verified = provider.verifyWebhook(raw, request.headers.get("stripe-signature"));
  } catch {
    return Response.json({ error: "Invalid signature." }, { status: 400 });
  }

  const service = createCommerceServiceClient();
  const { data: fresh, error } = await service.rpc("commerce_receive_event", {
    p_provider: provider.code, p_event_id: verified.id, p_type: verified.type, p_account: verified.accountId,
    p_object: verified.objectId, p_livemode: verified.livemode, p_created: verified.created,
  });
  if (error) return Response.json({ error: "Try again." }, { status: 500 });
  if (fresh !== true) return Response.json({ received: true, duplicate: true });

  try {
    const outcome = await handleCommerceEvent(service, provider, verified, commerceOrigin(request.headers));
    await service.rpc("commerce_finish_event", { p_provider: provider.code, p_event_id: verified.id, p_status: outcome, p_error: null });
    return Response.json({ received: true, outcome });
  } catch (failure) {
    const code = failure instanceof Error && /^[a-z0-9_]{1,80}$/.test(failure.message) ? failure.message : "handler_error";
    await service.rpc("commerce_finish_event", { p_provider: provider.code, p_event_id: verified.id, p_status: "failed", p_error: code });
    console.error("Commerce webhook failed", { type: verified.type, code });
    // A mismatch will never succeed on retry; anything else asks Stripe to try again.
    return Response.json({ error: code }, { status: code === "payment_mismatch" ? 200 : 500 });
  }
}
