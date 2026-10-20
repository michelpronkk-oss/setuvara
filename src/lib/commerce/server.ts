import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";

import type { CommerceProvider, SellerSnapshot } from "./provider";
import { StripeCommerceProvider } from "./stripe";

/**
 * Checkout, free claims and seller onboarding stay closed until this is set, so
 * merging never opens them. The studio still shows products and states.
 */
export function commerceEnabled() {
  return process.env.COMMERCE_ENABLED === "true";
}

/**
 * The configured payment provider, or null. A live Stripe key is refused unless
 * COMMERCE_LIVE_ENABLED is also set, so a pasted live key can't take real money
 * before the business review.
 */
export function commerceProvider(): CommerceProvider | null {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) return null;
  if (/^(sk|rk)_live_/.test(key) && process.env.COMMERCE_LIVE_ENABLED !== "true") return null;
  return new StripeCommerceProvider(key, process.env.STRIPE_CONNECT_WEBHOOK_SECRET?.trim() || null);
}

/** Commerce reads and writes that no browser may make. Server routes only. */
export function createCommerceServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) throw new Error("commerce_database_unavailable");
  return createSupabaseClient(url, key, { auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false } });
}

/** A download token: 256 random bits for the email; only its SHA-256 is stored. */
export function newDownloadToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashToken(token) };
}
export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
export const isDownloadToken = (value: string) => /^[A-Za-z0-9_-]{43}$/.test(value);

/** Writes the provider's view of a seller to the database. The only way seller state changes. */
export async function storeSeller(service: SupabaseClient, provider: CommerceProvider, userId: string, seller: SellerSnapshot) {
  const { data, error } = await service.rpc("commerce_sync_seller", {
    p_user: userId,
    p_provider: provider.code,
    p_account_id: seller.accountId,
    p_country: seller.country,
    p_default_currency: seller.defaultCurrency,
    p_charges_enabled: seller.chargesEnabled,
    p_payouts_enabled: seller.payoutsEnabled,
    p_details_submitted: seller.detailsSubmitted,
    p_card_payments: seller.cardPayments,
    p_transfers: seller.transfers,
    p_currently_due: seller.currentlyDue,
    p_past_due: seller.pastDue,
    p_pending: seller.pending,
    p_errors: seller.errors,
    p_disabled_reason: seller.disabledReason,
    p_deadline: seller.currentDeadline,
    p_livemode: seller.livemode,
    p_disconnected: seller.disconnected,
  });
  if (error) throw new Error(error.message.includes("account_owned_by_another_member") ? "account_owned_by_another_member" : "seller_sync_failed");
  return data as { status: string; charges_enabled: boolean; payouts_enabled: boolean; can_sell: boolean };
}

/** The seller row for a creator, with the provider account id (server only). */
export async function sellerAccountFor(service: SupabaseClient, userId: string, provider: string) {
  const { data } = await service.from("creator_payout_accounts").select("provider_account_id, disconnected_at, livemode").eq("creator_user_id", userId).eq("provider", provider).maybeSingle();
  return data as { provider_account_id: string; disconnected_at: string | null; livemode: boolean } | null;
}

/** Fetches a seller from the provider and stores it. Returns null when the creator has no account yet. */
export async function refreshSeller(service: SupabaseClient, provider: CommerceProvider, userId: string) {
  const row = await sellerAccountFor(service, userId, provider.code);
  if (!row) return null;
  const seller = await provider.retrieveSeller(row.provider_account_id);
  return storeSeller(service, provider, userId, seller);
}
