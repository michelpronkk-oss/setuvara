import { json, signedInUser } from "@/lib/commerce/routes";
import { commerceProvider, createCommerceServiceClient, refreshSeller } from "@/lib/commerce/server";
import { sameOrigin } from "@/lib/marketing/inquiry-mail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Reads the seller account from Stripe now, for the studio's Check again button. */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return json({ error: "This request could not be verified." }, 403);
  const user = await signedInUser();
  if (!user) return json({ error: "Sign in first." }, 401);
  const provider = commerceProvider();
  if (!provider) return json({ error: "Payments aren't open yet." }, 503);
  try {
    const result = await refreshSeller(createCommerceServiceClient(), provider, user.id);
    return result ? json(result) : json({ error: "No payment account yet." }, 404);
  } catch {
    return json({ error: "Stripe didn't respond. Try again in a moment." }, 502);
  }
}
