import type {
  CreatorApplicationStatus,
  CreatorKycStatus,
  CreatorMonetizationAccount,
  CreatorPayoutAccount,
  CreatorPayoutStatus,
} from "./types";

export function canMonetize(account: Pick<CreatorMonetizationAccount,
  "application_status" | "kyc_status" | "payout_status" | "terms_version" | "terms_accepted_at" | "suspended_at"> | null | undefined,
  payoutAccount: Pick<CreatorPayoutAccount, "status" | "payouts_enabled" | "details_submitted"> | null | undefined): boolean {
  return Boolean(account
    && account.application_status === "approved"
    && account.kyc_status === "verified"
    && account.payout_status === "enabled"
    && account.terms_version
    && account.terms_accepted_at
    && !account.suspended_at
    && payoutAccount?.status === "enabled"
    && payoutAccount.payouts_enabled
    && payoutAccount.details_submitted);
}

const applicationTransitions: Record<CreatorApplicationStatus, readonly CreatorApplicationStatus[]> = {
  not_applied: ["applied"],
  applied: ["under_review", "rejected", "suspended"],
  under_review: ["approved", "rejected", "suspended"],
  approved: ["suspended"],
  rejected: ["applied"],
  suspended: ["under_review"],
};

const kycTransitions: Record<CreatorKycStatus, readonly CreatorKycStatus[]> = {
  not_started: ["pending"],
  pending: ["verified", "failed", "restricted"],
  verified: ["pending", "restricted"],
  failed: ["pending", "restricted"],
  restricted: ["pending"],
};

const payoutTransitions: Record<CreatorPayoutStatus, readonly CreatorPayoutStatus[]> = {
  not_connected: ["pending"],
  pending: ["enabled", "restricted", "disabled"],
  enabled: ["restricted", "disabled"],
  restricted: ["pending", "disabled"],
  disabled: ["pending"],
};

export function canTransitionApplication(from: CreatorApplicationStatus, to: CreatorApplicationStatus) {
  return applicationTransitions[from].includes(to);
}

export function canTransitionKyc(from: CreatorKycStatus, to: CreatorKycStatus) {
  return kycTransitions[from].includes(to);
}

export function canTransitionPayout(from: CreatorPayoutStatus, to: CreatorPayoutStatus) {
  return payoutTransitions[from].includes(to);
}

export type CreatorAccessDecision = "public" | "follower" | "member" | "purchase" | "denied";

/** Mirrors the database access order; scheduled Drops are unavailable until live. */
export function creatorBlockAccessDecision(input: {
  accessLevel?: "public" | "followers" | "members" | "purchase";
  isFollower: boolean;
  hasActiveMembership: boolean;
  hasPurchaseGrant: boolean;
  isDropAvailable?: boolean;
}): CreatorAccessDecision {
  if (input.isDropAvailable === false) return "denied";
  switch (input.accessLevel ?? "public") {
    case "public": return "public";
    case "followers": return input.isFollower ? "follower" : "denied";
    case "members": return input.hasActiveMembership ? "member" : "denied";
    case "purchase": return input.hasPurchaseGrant ? "purchase" : "denied";
  }
}
