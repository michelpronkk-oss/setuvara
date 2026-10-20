import { NextResponse } from "next/server";

import { commerceOrigin } from "@/lib/commerce/public";
import { signedInUser, STUDIO_PAYMENTS } from "@/lib/commerce/routes";
import { commerceEnabled, commerceProvider, createCommerceServiceClient, sellerAccountFor } from "@/lib/commerce/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Re-entry into onboarding: Stripe sends expired links here, and the studio's Continue button opens it. */
export async function GET(request: Request) {
  const origin = commerceOrigin(request.headers);
  const user = await signedInUser();
  if (!user) return NextResponse.redirect(`${origin}/login?next=${encodeURIComponent(STUDIO_PAYMENTS)}`, 303);
  const provider = commerceProvider();
  if (!commerceEnabled() || !provider) return NextResponse.redirect(`${origin}${STUDIO_PAYMENTS}?notice=unavailable`, 303);
  const service = createCommerceServiceClient();
  const row = await sellerAccountFor(service, user.id, provider.code);
  if (!row || row.disconnected_at) return NextResponse.redirect(`${origin}${STUDIO_PAYMENTS}`, 303);
  try {
    const url = await provider.onboardingLink({ accountId: row.provider_account_id, refreshUrl: `${origin}/api/commerce/payments/onboarding`, returnUrl: `${origin}/api/commerce/payments/return` });
    return NextResponse.redirect(url, 303);
  } catch {
    return NextResponse.redirect(`${origin}${STUDIO_PAYMENTS}?notice=stripe-error`, 303);
  }
}
