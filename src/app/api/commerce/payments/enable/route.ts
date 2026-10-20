import { z } from "zod";

import { isSellerCountry } from "@/lib/commerce/model";
import { commerceOrigin } from "@/lib/commerce/public";
import { json, SELLER_TERMS_VERSION, signedInUser } from "@/lib/commerce/routes";
import { commerceEnabled, commerceProvider, createCommerceServiceClient, sellerAccountFor, storeSeller } from "@/lib/commerce/server";
import { sameOrigin } from "@/lib/marketing/inquiry-mail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const body = z.object({ country: z.string().length(2), businessType: z.enum(["individual", "company"]).nullable().default(null), acceptTerms: z.literal(true) });

/**
 * Creator Studio → Commerce → Payments → Enable payments. Records the creator's
 * acceptance of the seller terms, creates their Stripe account once, and returns
 * the Stripe-hosted onboarding link. Nothing here marks the account as ready;
 * only the provider's own account state does.
 */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return json({ error: "This request could not be verified." }, 403);
  const user = await signedInUser();
  if (!user) return json({ error: "Sign in first." }, 401);
  const provider = commerceProvider();
  if (!commerceEnabled() || !provider) return json({ error: "Payments aren't open yet." }, 503);
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !isSellerCountry(parsed.data.country)) return json({ error: "Choose a supported country and accept the seller terms." }, 400);
  const { country, businessType } = parsed.data;

  const { data: mode } = await user.supabase.from("profile_modes").select("id").eq("profile_id", user.id).eq("slug", "creator").maybeSingle();
  if (!mode) return json({ error: "Creator Mode isn't set up on this account." }, 400);
  const { data: profile } = await user.supabase.from("profiles").select("username").eq("id", user.id).maybeSingle();

  const { error: termsError } = await user.supabase.rpc("creator_submit_monetization_application", { p_country_code: country, p_terms_version: SELLER_TERMS_VERSION });
  if (termsError) return json({ error: "That didn't save. Try again." }, 500);

  const service = createCommerceServiceClient();
  const origin = commerceOrigin(request.headers);
  try {
    let existing = await sellerAccountFor(service, user.id, provider.code);
    // A disconnected or other-mode account can't be reused; the creator starts a new one.
    if (existing && (existing.disconnected_at || existing.livemode !== provider.livemode)) existing = null;
    let accountId = existing?.provider_account_id ?? null;
    if (!accountId) {
      const created = await provider.createSeller({ userId: user.id, country, email: user.email, businessType, profileUrl: `https://setuvara.com/${profile?.username ?? ""}` });
      accountId = created.accountId;
      await storeSeller(service, provider, user.id, await provider.retrieveSeller(accountId));
    }
    const url = await provider.onboardingLink({ accountId, refreshUrl: `${origin}/api/commerce/payments/onboarding`, returnUrl: `${origin}/api/commerce/payments/return` });
    return json({ url });
  } catch (error) {
    const code = error instanceof Error ? error.message : "unknown";
    console.error("Seller onboarding failed", { code: code.slice(0, 80) });
    if (code === "account_owned_by_another_member") return json({ error: "That payment account belongs to another member." }, 409);
    return json({ error: "Stripe didn't respond. Try again in a moment." }, 502);
  }
}
