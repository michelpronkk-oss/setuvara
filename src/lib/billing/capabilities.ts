import type { PlanCode } from "./catalog";

export type CapabilityAvailability = "live" | "future";
export type CapabilityDefinition = {
  label: string;
  requiredPlan: PlanCode;
  availability: CapabilityAvailability;
};

/**
 * The product-wide plan contract. Product code should gate against these keys,
 * never against Dodo product IDs or an independent feature-specific plan map.
 * Future entries are intentionally unavailable at every plan until shipped.
 */
export const CAPABILITY_REGISTRY = {
  "identity.create": { label: "Create an identity", requiredPlan: "free", availability: "live" },
  "identity.edit": { label: "Edit your identity", requiredPlan: "free", availability: "live" },
  "identity.plus_badge": { label: "Setuvara Plus member badge", requiredPlan: "plus", availability: "live" },
  "identity.pro_badge": { label: "Setuvara Pro member badge", requiredPlan: "pro", availability: "live" },
  "identity.remove_attribution": { label: "Remove Setuvara attribution", requiredPlan: "plus", availability: "future" },
  "mode.personal": { label: "Personal Mode", requiredPlan: "free", availability: "live" },
  "mode.event": { label: "Event Mode", requiredPlan: "free", availability: "live" },
  "mode.business": { label: "Business Mode", requiredPlan: "free", availability: "live" },
  "profile.public": { label: "Public profile", requiredPlan: "free", availability: "live" },
  "profile.links": { label: "Profile links and actions", requiredPlan: "free", availability: "live" },
  "profile.content": { label: "Profile content and media", requiredPlan: "free", availability: "live" },
  "appearance.core": { label: "Core profile appearance", requiredPlan: "free", availability: "live" },
  "appearance.premium": { label: "Premium themes and treatments", requiredPlan: "plus", availability: "future" },
  "share.link": { label: "Share profile links", requiredPlan: "free", availability: "live" },
  "share.qr": { label: "Standard QR codes", requiredPlan: "free", availability: "live" },
  "share.qr_premium": { label: "Premium QR appearance", requiredPlan: "plus", availability: "future" },
  "share.quick_qr": { label: "Quick QR", requiredPlan: "free", availability: "live" },
  "share.tap": { label: "Setuvara Tap", requiredPlan: "free", availability: "live" },
  "tap.devices": { label: "Tap device management", requiredPlan: "free", availability: "live" },
  "tap.connect_intent": { label: "View and Connect intents", requiredPlan: "free", availability: "live" },
  "connections.core": { label: "Connections and relationship history", requiredPlan: "free", availability: "live" },
  "connections.guest_connect": { label: "Guest Connect", requiredPlan: "free", availability: "live" },
  "connections.private_memory": { label: "Private connection memories", requiredPlan: "free", availability: "live" },
  "passport.core": { label: "Setuvara Passport", requiredPlan: "free", availability: "live" },
  "passport.standard_progression": { label: "Standard stamps and milestones", requiredPlan: "free", availability: "live" },
  "passport.premium_treatment": { label: "Premium Passport treatment", requiredPlan: "plus", availability: "future" },
  "soundtrack.core": { label: "Profile soundtrack", requiredPlan: "free", availability: "live" },
  "soundtrack.premium_treatment": { label: "Premium soundtrack treatment", requiredPlan: "plus", availability: "future" },
  "analytics.basic_7d": { label: "Seven-day activity", requiredPlan: "free", availability: "live" },
  "analytics.history_30d": { label: "Thirty-day analytics history", requiredPlan: "plus", availability: "live" },
  "analytics.history_90d": { label: "Ninety-day analytics history", requiredPlan: "plus", availability: "live" },
  "analytics.sources": { label: "Share source breakdown", requiredPlan: "plus", availability: "live" },
  "analytics.modes": { label: "Mode breakdown", requiredPlan: "plus", availability: "live" },
  "analytics.conversion": { label: "View-to-Connection conversion", requiredPlan: "plus", availability: "live" },
  "analytics.custom_range": { label: "Custom analytics ranges up to 730 days", requiredPlan: "pro", availability: "live" },
  "analytics.funnels": { label: "Connection journey funnel", requiredPlan: "pro", availability: "live" },
  "analytics.device_insights": { label: "Device insights", requiredPlan: "pro", availability: "live" },
  "analytics.csv_export": { label: "Analytics CSV export", requiredPlan: "pro", availability: "live" },
  "analytics.advanced_filters": { label: "Advanced analytics filters", requiredPlan: "pro", availability: "future" },
  "appearance.advanced_controls": { label: "Advanced appearance controls", requiredPlan: "plus", availability: "future" },
  "domain.custom": { label: "Use a domain you own", requiredPlan: "pro", availability: "future" },
  "actions.advanced": { label: "Advanced professional actions", requiredPlan: "pro", availability: "future" },
  "leads.capture": { label: "Lead capture", requiredPlan: "pro", availability: "future" },
  "integrations.access": { label: "Connected integrations", requiredPlan: "pro", availability: "future" },
  "webhooks.access": { label: "Webhooks", requiredPlan: "pro", availability: "future" },
  "wallet.core": { label: "Standard Wallet eligibility", requiredPlan: "free", availability: "live" },
  "wallet.premium_appearance": { label: "Premium Wallet appearance", requiredPlan: "plus", availability: "live" },
} as const satisfies Record<string, CapabilityDefinition>;

export type CapabilityKey = keyof typeof CAPABILITY_REGISTRY;
export type CapabilityState = "available" | "locked" | "unavailable";

export type CapabilityAccess = {
  state: CapabilityState;
  available: boolean;
  requiredPlan: PlanCode;
  upgradePlan: Exclude<PlanCode, "free"> | null;
  availability: CapabilityAvailability;
  label: string;
};

export type ClientCapabilitySnapshot = {
  plan: PlanCode;
  capabilities: Record<CapabilityKey, CapabilityAccess>;
};

const PLAN_RANK: Readonly<Record<PlanCode, number>> = { free: 0, plus: 1, pro: 2 };

export function getCapabilityAccess(plan: PlanCode, key: CapabilityKey): CapabilityAccess {
  const definition = CAPABILITY_REGISTRY[key];
  if (definition.availability === "future") {
    return {
      state: "unavailable",
      available: false,
      requiredPlan: definition.requiredPlan,
      upgradePlan: null,
      availability: definition.availability,
      label: definition.label,
    };
  }

  const available = PLAN_RANK[plan] >= PLAN_RANK[definition.requiredPlan];
  return {
    state: available ? "available" : "locked",
    available,
    requiredPlan: definition.requiredPlan,
    upgradePlan: available || definition.requiredPlan === "free" ? null : definition.requiredPlan,
    availability: definition.availability,
    label: definition.label,
  };
}

export function hasCapability(plan: PlanCode, key: CapabilityKey): boolean {
  return getCapabilityAccess(plan, key).available;
}

export function capabilityFlags(plan: PlanCode): Record<CapabilityKey, boolean> {
  return Object.fromEntries(
    (Object.keys(CAPABILITY_REGISTRY) as CapabilityKey[])
      .map((key) => [key, hasCapability(plan, key)]),
  ) as Record<CapabilityKey, boolean>;
}

export function resolveClientCapabilities(plan: PlanCode): ClientCapabilitySnapshot {
  return {
    plan,
    capabilities: Object.fromEntries(
      (Object.keys(CAPABILITY_REGISTRY) as CapabilityKey[])
        .map((key) => [key, getCapabilityAccess(plan, key)]),
    ) as Record<CapabilityKey, CapabilityAccess>,
  };
}

export function listAvailableCapabilities(plan: PlanCode): CapabilityKey[] {
  return (Object.keys(CAPABILITY_REGISTRY) as CapabilityKey[])
    .filter((key) => hasCapability(plan, key));
}

export function nextPlanAfter(plan: PlanCode): Exclude<PlanCode, "free"> | null {
  return plan === "free" ? "plus" : plan === "plus" ? "pro" : null;
}
