import type { ModeSlug, ProfileBlock, ProfileMode } from "@/components/profile/types";

export type CreatorModeSlug = Extract<ModeSlug, "creator">;
export type CreatorAccessLevel = "public" | "followers" | "members" | "purchase";
export type CreatorOfferKind = "membership" | "one_time";
export type CreatorOfferStatus = "draft" | "active" | "paused" | "archived";
export type CreatorApplicationStatus = "not_applied" | "applied" | "under_review" | "approved" | "rejected" | "suspended";
export type CreatorKycStatus = "not_started" | "pending" | "verified" | "failed" | "restricted";
export type CreatorPayoutStatus = "not_connected" | "pending" | "enabled" | "restricted" | "disabled";
export type CreatorMonetizationStatus = "inactive" | "pending" | "active" | "suspended";
export type CreatorMembershipStatus = "pending" | "active" | "past_due" | "cancelled" | "expired" | "refunded" | "suspended";
export type CreatorDropStatus = "draft" | "scheduled" | "live" | "ended" | "cancelled";
export type CreatorOrderStatus = "pending" | "processing" | "paid" | "failed" | "cancelled" | "refunded" | "partially_refunded" | "charged_back";
export type CreatorLedgerEntryType = "sale" | "platform_fee" | "payment_fee" | "refund" | "chargeback" | "payout" | "adjustment";

export type CreatorMonetizationAccount = {
  user_id: string;
  application_status: CreatorApplicationStatus;
  kyc_status: CreatorKycStatus;
  payout_status: CreatorPayoutStatus;
  monetization_status: CreatorMonetizationStatus;
  provider: string | null;
  provider_account_id: string | null;
  country_code: string | null;
  terms_version: string | null;
  terms_accepted_at: string | null;
  applied_at: string | null;
  reviewed_at: string | null;
  approved_at: string | null;
  suspended_at: string | null;
};

export type CreatorPayoutAccount = {
  id: string;
  creator_user_id: string;
  provider: string;
  provider_account_id: string;
  status: CreatorPayoutStatus;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  details_submitted: boolean;
};

export type CreatorOffer = {
  id: string;
  creator_user_id: string;
  kind: CreatorOfferKind;
  title: string;
  description: string;
  currency: string;
  unit_amount_minor: number;
  status: CreatorOfferStatus;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

export type CreatorContentRule = {
  profile_block_id: string;
  creator_user_id: string;
  access_level: CreatorAccessLevel;
  offer_id: string | null;
  teaser_title: string | null;
  teaser_text: string | null;
  teaser_image_url: string | null;
};

export type CreatorPublicSummary = {
  creator_user_id: string;
  follower_count: number;
  is_following: boolean;
  offers: Pick<CreatorOffer, "id" | "kind" | "title" | "description" | "currency" | "unit_amount_minor">[];
  drops: { id: string; profile_block_id: string; title: string; status: "live"; starts_at: string | null; ends_at: string | null; offer_id: string | null }[];
  locked_content: (Pick<CreatorContentRule, "profile_block_id" | "access_level" | "offer_id" | "teaser_title" | "teaser_text" | "teaser_image_url"> & { is_accessible: boolean })[];
};

/** Safe Creator profile data joins the canonical profile/mode/blocks system. */
export type CreatorPublicProfile = {
  mode: ProfileMode & { slug: CreatorModeSlug };
  blocks: ProfileBlock[];
  summary: CreatorPublicSummary;
};
