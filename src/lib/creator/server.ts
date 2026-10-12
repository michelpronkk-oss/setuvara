import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { CreatorContentRule, CreatorMonetizationAccount, CreatorOffer, CreatorPayoutAccount, CreatorPublicSummary } from "./types";

export async function getCreatorPublicSummary(supabase: SupabaseClient, username: string): Promise<CreatorPublicSummary | null> {
  const { data, error } = await supabase.rpc("get_creator_public_summary", { p_username: username });
  return error || !data ? null : data as CreatorPublicSummary;
}

export async function followCreator(supabase: SupabaseClient, creatorUserId: string) {
  const { data, error } = await supabase.rpc("creator_follow", { p_creator_user_id: creatorUserId });
  return !error && data === true;
}

export async function unfollowCreator(supabase: SupabaseClient, creatorUserId: string) {
  const { data, error } = await supabase.rpc("creator_unfollow", { p_creator_user_id: creatorUserId });
  return !error && data === true;
}

export async function submitCreatorMonetizationApplication(supabase: SupabaseClient, countryCode: string, termsVersion: string) {
  const { data, error } = await supabase.rpc("creator_submit_monetization_application", {
    p_country_code: countryCode,
    p_terms_version: termsVersion,
  });
  return error ? null : data;
}

export async function creatorCanViewBlock(supabase: SupabaseClient, profileBlockId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("can_view_creator_block", { p_profile_block_id: profileBlockId });
  return !error && data === true;
}

export async function getCreatorMonetizationStatus(supabase: SupabaseClient): Promise<{
  account: CreatorMonetizationAccount | null;
  payoutAccount: CreatorPayoutAccount | null;
  canMonetize: boolean;
}> {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { account: null, payoutAccount: null, canMonetize: false };
  const [{ data: account }, { data: payoutAccount }, { data: enabled }] = await Promise.all([
    supabase.from("creator_monetization_accounts").select("*").maybeSingle(),
    supabase.from("creator_payout_accounts").select("*").maybeSingle(),
    supabase.rpc("creator_monetization_enabled"),
  ]);
  return { account: account as CreatorMonetizationAccount | null, payoutAccount: payoutAccount as CreatorPayoutAccount | null, canMonetize: enabled === true };
}

export async function getCreatorOwnerContract(supabase: SupabaseClient) {
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return null;
  const userId = authData.user.id;
  const [{ data: creatorMode }, followerCount, account, payoutAccount, offers, contentRules, drops, memberships, orders, balances, monetizationEnabled] = await Promise.all([
    supabase.from("profile_modes").select("id,is_enabled,appearance,image_path,image_focus_x,image_focus_y,connect_policy").eq("profile_id", userId).eq("slug", "creator").maybeSingle(),
    supabase.rpc("creator_follower_count"),
    supabase.from("creator_monetization_accounts").select("*").maybeSingle(),
    supabase.from("creator_payout_accounts").select("*").maybeSingle(),
    supabase.from("creator_offers").select("*").order("created_at", { ascending: false }),
    supabase.from("creator_content_rules").select("*").order("updated_at", { ascending: false }),
    supabase.from("creator_drops").select("*").order("created_at", { ascending: false }),
    supabase.from("creator_memberships").select("*").order("updated_at", { ascending: false }),
    supabase.from("creator_orders").select("*").order("created_at", { ascending: false }),
    supabase.rpc("creator_get_balance"),
    supabase.rpc("creator_monetization_enabled"),
  ]);
  return {
    creatorMode: creatorMode ?? null,
    followerCount: Number(followerCount.data ?? 0),
    account: account.data as CreatorMonetizationAccount | null,
    payoutAccount: payoutAccount.data as CreatorPayoutAccount | null,
    canMonetize: monetizationEnabled.data === true,
    offers: (offers.data ?? []) as CreatorOffer[],
    contentRules: (contentRules.data ?? []) as CreatorContentRule[],
    drops: drops.data ?? [],
    memberships: memberships.data ?? [],
    orders: orders.data ?? [],
    balances: balances.data ?? [],
  };
}
