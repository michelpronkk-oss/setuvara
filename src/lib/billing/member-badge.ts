import type { PlanCode } from "./catalog";
import { hasCapability } from "./capabilities";

/** Paid membership status. Never identity verification; Free has no tier. */
export type MemberTier = "plus" | "pro";

export const MEMBER_BADGE_COPY: Readonly<Record<MemberTier, { label: string; title: string }>> = {
  plus: { label: "Setuvara Plus member", title: "Setuvara Plus" },
  pro: { label: "Setuvara Pro member", title: "Setuvara Pro" },
};

/**
 * The single plan → badge projection. It reads the capability registry, so a
 * downgrade or upgrade changes the badge as soon as the resolved plan changes.
 * Pro outranks Plus: one badge, never both.
 */
export function memberTierForPlan(plan: PlanCode): MemberTier | null {
  if (hasCapability(plan, "identity.pro_badge")) return "pro";
  if (hasCapability(plan, "identity.plus_badge")) return "plus";
  return null;
}
