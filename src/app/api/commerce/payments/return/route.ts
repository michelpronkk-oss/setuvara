import { NextResponse } from "next/server";

import { commerceOrigin } from "@/lib/commerce/public";
import { signedInUser, STUDIO_PAYMENTS } from "@/lib/commerce/routes";
import { commerceProvider, createCommerceServiceClient, refreshSeller } from "@/lib/commerce/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Back from Stripe onboarding. Returning proves nothing about the account, so the
 * account is read again from Stripe and the studio shows whatever state that gives.
 */
export async function GET(request: Request) {
  const origin = commerceOrigin(request.headers);
  const user = await signedInUser();
  if (!user) return NextResponse.redirect(`${origin}/login?next=${encodeURIComponent(STUDIO_PAYMENTS)}`, 303);
  const provider = commerceProvider();
  if (provider) {
    try { await refreshSeller(createCommerceServiceClient(), provider, user.id); } catch { return NextResponse.redirect(`${origin}${STUDIO_PAYMENTS}?notice=sync-pending`, 303); }
  }
  return NextResponse.redirect(`${origin}${STUDIO_PAYMENTS}?notice=returned`, 303);
}
