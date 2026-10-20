import { z } from "zod";

import { deliverOrder } from "@/lib/commerce/fulfillment";
import { commerceOrigin } from "@/lib/commerce/public";
import { json, signedInUser } from "@/lib/commerce/routes";
import { createCommerceServiceClient } from "@/lib/commerce/server";
import { sameOrigin } from "@/lib/marketing/inquiry-mail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Sends the buyer a fresh download link: after a failed email, or when they lost it. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(request)) return json({ error: "This request could not be verified." }, 403);
  const user = await signedInUser();
  if (!user) return json({ error: "Sign in first." }, 401);
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return json({ error: "Order not found." }, 404);
  const { data: own } = await user.supabase.from("creator_orders").select("id, status, offer_type").eq("id", id).eq("creator_user_id", user.id).maybeSingle();
  if (!own) return json({ error: "Order not found." }, 404);
  if (own.offer_type !== "digital" || !["paid", "partially_refunded"].includes(own.status)) return json({ error: "Only paid downloads can be sent." }, 409);
  const result = await deliverOrder(createCommerceServiceClient(), id, commerceOrigin(request.headers));
  if (result === "delivered") return json({ ok: true });
  return json({ error: result === "unconfigured" ? "Email isn't set up on Setuvara yet." : result === "not_deliverable" ? "This order has reached its link limit." : "The email didn't send. Try again." }, 502);
}
