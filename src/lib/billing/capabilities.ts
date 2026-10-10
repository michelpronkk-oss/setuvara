import type { PlanCode } from "./catalog";

export type CapabilityAvailability = "live" | "future";
export type CapabilityEnforcement =
  | "auth-and-rls"
  | "server-route"
  | "server-plan"
  | "server-derived-presentation"
  | "prelaunch"
  | "not-shipped";
export type DowngradeBehavior =
  | "unaffected"
  | "preserve-config-fallback"
  | "restrict-access-keep-data"
  | "badge-follows-plan"
  | "plan-derived-reverts"
  | "future-unavailable";

export type PricingFeature = { id: string; label: string };
export type CapabilityDefinition = {
  label: string;
  requiredPlan: PlanCode;
  /** Used only for mutually exclusive membership badges (Plus is replaced by Pro). */
  maximumPlan?: PlanCode;
  availability: CapabilityAvailability;
  enforcement: CapabilityEnforcement;
  surface: string;
  pricing: PricingFeature | null;
  downgrade: DowngradeBehavior;
};

/**
 * The single capability and plan matrix. Pricing groups, client snapshots, UI checks, and
 * server checks all derive from these rows. Rows also document the actual enforcement path,
 * user-facing surface, pricing exposure, and what expiry does to saved state.
 */
export const PLAN_MATRIX = {
  "identity.create": { label: "Create an identity", requiredPlan: "free", availability: "live", enforcement: "auth-and-rls", surface: "Signup and Identity", pricing: null, downgrade: "unaffected" },
  "identity.edit": { label: "Edit your identity", requiredPlan: "free", availability: "live", enforcement: "auth-and-rls", surface: "Identity editor", pricing: { id: "profile", label: "Public profile, links, content, and core appearance" }, downgrade: "unaffected" },
  "identity.plus_badge": { label: "Setuvara Plus member badge", requiredPlan: "plus", maximumPlan: "plus", availability: "live", enforcement: "server-derived-presentation", surface: "Home and public profile", pricing: { id: "plus-badge", label: "Setuvara Plus member badge" }, downgrade: "badge-follows-plan" },
  "identity.pro_badge": { label: "Setuvara Pro member badge", requiredPlan: "pro", availability: "live", enforcement: "server-derived-presentation", surface: "Home and public profile", pricing: { id: "pro-badge", label: "Setuvara Pro member badge" }, downgrade: "badge-follows-plan" },
  "identity.remove_attribution": { label: "Remove Setuvara attribution", requiredPlan: "plus", availability: "future", enforcement: "not-shipped", surface: "Public profile", pricing: null, downgrade: "future-unavailable" },
  "mode.personal": { label: "Personal Mode", requiredPlan: "free", availability: "live", enforcement: "auth-and-rls", surface: "Identity editor and public profile", pricing: { id: "modes", label: "Personal, Event, and Business Modes" }, downgrade: "unaffected" },
  "mode.event": { label: "Event Mode", requiredPlan: "free", availability: "live", enforcement: "auth-and-rls", surface: "Identity editor and public profile", pricing: { id: "modes", label: "Personal, Event, and Business Modes" }, downgrade: "unaffected" },
  "mode.business": { label: "Business Mode", requiredPlan: "free", availability: "live", enforcement: "auth-and-rls", surface: "Identity editor and public profile", pricing: { id: "modes", label: "Personal, Event, and Business Modes" }, downgrade: "unaffected" },
  "profile.public": { label: "Public profile", requiredPlan: "free", availability: "live", enforcement: "server-route", surface: "Root username profile", pricing: { id: "profile", label: "Public profile, links, content, and core appearance" }, downgrade: "unaffected" },
  "profile.links": { label: "Profile links and actions", requiredPlan: "free", availability: "live", enforcement: "auth-and-rls", surface: "Identity editor and public profile", pricing: { id: "profile", label: "Public profile, links, content, and core appearance" }, downgrade: "unaffected" },
  "profile.content": { label: "Profile content and media", requiredPlan: "free", availability: "live", enforcement: "auth-and-rls", surface: "Identity editor and public profile", pricing: { id: "profile", label: "Public profile, links, content, and core appearance" }, downgrade: "unaffected" },
  "appearance.core": { label: "Core profile appearance", requiredPlan: "free", availability: "live", enforcement: "auth-and-rls", surface: "Identity editor and ProfileRenderer", pricing: { id: "profile", label: "Public profile, links, content, and core appearance" }, downgrade: "unaffected" },
  "appearance.premium": { label: "Editorial profile theme", requiredPlan: "plus", availability: "live", enforcement: "server-derived-presentation", surface: "Identity editor and shared ProfileRenderer", pricing: { id: "premium-presentation", label: "Editorial theme, accent-frame QR, Passport finish, and soundtrack presentation" }, downgrade: "preserve-config-fallback" },
  "share.link": { label: "Share profile links", requiredPlan: "free", availability: "live", enforcement: "auth-and-rls", surface: "Home and Identity Share", pricing: { id: "share", label: "QR, Quick QR, and Setuvara Tap" }, downgrade: "unaffected" },
  "share.qr": { label: "Standard QR codes", requiredPlan: "free", availability: "live", enforcement: "auth-and-rls", surface: "Home and Identity Share", pricing: { id: "share", label: "QR, Quick QR, and Setuvara Tap" }, downgrade: "unaffected" },
  "share.qr_premium": { label: "Premium QR accent frame", requiredPlan: "plus", availability: "live", enforcement: "server-derived-presentation", surface: "Home and Identity Share", pricing: { id: "premium-presentation", label: "Editorial theme, accent-frame QR, Passport finish, and soundtrack presentation" }, downgrade: "preserve-config-fallback" },
  "share.quick_qr": { label: "Quick QR", requiredPlan: "free", availability: "live", enforcement: "server-route", surface: "Tap and Quick QR", pricing: { id: "share", label: "QR, Quick QR, and Setuvara Tap" }, downgrade: "unaffected" },
  "share.tap": { label: "Setuvara Tap", requiredPlan: "free", availability: "live", enforcement: "server-route", surface: "Tap and Quick QR", pricing: { id: "share", label: "QR, Quick QR, and Setuvara Tap" }, downgrade: "unaffected" },
  "tap.devices": { label: "Tap device management", requiredPlan: "free", availability: "live", enforcement: "server-route", surface: "Tap settings", pricing: { id: "share", label: "QR, Quick QR, and Setuvara Tap" }, downgrade: "unaffected" },
  "tap.connect_intent": { label: "View and Connect intents", requiredPlan: "free", availability: "live", enforcement: "server-route", surface: "Tap and Connection Pass", pricing: { id: "share", label: "QR, Quick QR, and Setuvara Tap" }, downgrade: "unaffected" },
  "connections.core": { label: "Connections and relationship history", requiredPlan: "free", availability: "live", enforcement: "auth-and-rls", surface: "Connections", pricing: { id: "network", label: "Connect, Connections, private memories, and Passport" }, downgrade: "unaffected" },
  "connections.guest_connect": { label: "Guest Connect", requiredPlan: "free", availability: "live", enforcement: "server-route", surface: "Public profile and claim flow", pricing: { id: "network", label: "Connect, Connections, private memories, and Passport" }, downgrade: "unaffected" },
  "connections.private_memory": { label: "Private connection memories", requiredPlan: "free", availability: "live", enforcement: "auth-and-rls", surface: "Connection details", pricing: { id: "network", label: "Connect, Connections, private memories, and Passport" }, downgrade: "unaffected" },
  "passport.core": { label: "Setuvara Passport", requiredPlan: "free", availability: "live", enforcement: "auth-and-rls", surface: "Passport", pricing: { id: "network", label: "Connect, Connections, private memories, and Passport" }, downgrade: "unaffected" },
  "passport.standard_progression": { label: "Standard stamps and milestones", requiredPlan: "free", availability: "live", enforcement: "server-route", surface: "Passport progression", pricing: { id: "network", label: "Connect, Connections, private memories, and Passport" }, downgrade: "unaffected" },
  "passport.premium_treatment": { label: "Member Passport finish", requiredPlan: "plus", availability: "live", enforcement: "server-derived-presentation", surface: "Home Passport and Passport dashboard", pricing: { id: "premium-presentation", label: "Editorial theme, accent-frame QR, Passport finish, and soundtrack presentation" }, downgrade: "plan-derived-reverts" },
  "soundtrack.core": { label: "Profile soundtrack", requiredPlan: "free", availability: "live", enforcement: "auth-and-rls", surface: "Identity editor and public profile", pricing: { id: "soundtrack", label: "Profile soundtrack" }, downgrade: "unaffected" },
  "soundtrack.premium_treatment": { label: "Premium soundtrack presentation", requiredPlan: "plus", availability: "live", enforcement: "server-derived-presentation", surface: "Public profile soundtrack controls", pricing: { id: "premium-presentation", label: "Editorial theme, accent-frame QR, Passport finish, and soundtrack presentation" }, downgrade: "plan-derived-reverts" },
  "analytics.basic_7d": { label: "Seven-day activity", requiredPlan: "free", availability: "live", enforcement: "server-plan", surface: "Analytics dashboard and API", pricing: { id: "analytics-basic", label: "Seven-day activity overview" }, downgrade: "unaffected" },
  "analytics.history_30d": { label: "Thirty-day analytics history", requiredPlan: "plus", availability: "live", enforcement: "server-plan", surface: "Analytics dashboard and API", pricing: { id: "analytics-history", label: "30- and 90-day analytics history" }, downgrade: "restrict-access-keep-data" },
  "analytics.history_90d": { label: "Ninety-day analytics history", requiredPlan: "plus", availability: "live", enforcement: "server-plan", surface: "Analytics dashboard and API", pricing: { id: "analytics-history", label: "30- and 90-day analytics history" }, downgrade: "restrict-access-keep-data" },
  "analytics.sources": { label: "Share source breakdown", requiredPlan: "plus", availability: "live", enforcement: "server-plan", surface: "Analytics dashboard and API", pricing: { id: "analytics-breakdowns", label: "Source and Mode breakdowns" }, downgrade: "restrict-access-keep-data" },
  "analytics.modes": { label: "Mode breakdown", requiredPlan: "plus", availability: "live", enforcement: "server-plan", surface: "Analytics dashboard and API", pricing: { id: "analytics-breakdowns", label: "Source and Mode breakdowns" }, downgrade: "restrict-access-keep-data" },
  "analytics.conversion": { label: "View-to-Connection conversion", requiredPlan: "plus", availability: "live", enforcement: "server-plan", surface: "Analytics dashboard and API", pricing: { id: "analytics-conversion", label: "View-to-Connection conversion" }, downgrade: "restrict-access-keep-data" },
  "analytics.custom_range": { label: "Custom analytics ranges up to 730 days", requiredPlan: "pro", availability: "live", enforcement: "server-plan", surface: "Analytics dashboard and API", pricing: { id: "analytics-custom-range", label: "Custom analytics ranges up to 730 days" }, downgrade: "restrict-access-keep-data" },
  "analytics.funnels": { label: "Connection journey funnel", requiredPlan: "pro", availability: "live", enforcement: "server-plan", surface: "Analytics dashboard and API", pricing: { id: "analytics-funnel", label: "Connection journey funnel" }, downgrade: "restrict-access-keep-data" },
  "analytics.device_insights": { label: "Device insights", requiredPlan: "pro", availability: "live", enforcement: "server-plan", surface: "Analytics dashboard and API", pricing: { id: "analytics-devices", label: "Device and Tap sharing insights" }, downgrade: "restrict-access-keep-data" },
  "analytics.csv_export": { label: "Analytics CSV export", requiredPlan: "pro", availability: "live", enforcement: "server-plan", surface: "Analytics export API", pricing: { id: "analytics-export", label: "Download analytics as CSV" }, downgrade: "restrict-access-keep-data" },
  "analytics.advanced_filters": { label: "Advanced analytics filters", requiredPlan: "pro", availability: "future", enforcement: "not-shipped", surface: "Analytics", pricing: null, downgrade: "future-unavailable" },
  "appearance.advanced_controls": { label: "Advanced appearance controls", requiredPlan: "plus", availability: "future", enforcement: "not-shipped", surface: "Identity editor", pricing: null, downgrade: "future-unavailable" },
  "domain.custom": { label: "Use a domain you own", requiredPlan: "pro", availability: "future", enforcement: "not-shipped", surface: "Public profile", pricing: null, downgrade: "future-unavailable" },
  "actions.advanced": { label: "Advanced professional actions", requiredPlan: "pro", availability: "future", enforcement: "not-shipped", surface: "Identity editor", pricing: null, downgrade: "future-unavailable" },
  "leads.capture": { label: "Lead capture", requiredPlan: "pro", availability: "future", enforcement: "not-shipped", surface: "Business Mode", pricing: null, downgrade: "future-unavailable" },
  "integrations.access": { label: "Connected integrations", requiredPlan: "pro", availability: "future", enforcement: "not-shipped", surface: "Integrations", pricing: null, downgrade: "future-unavailable" },
  "webhooks.access": { label: "Webhooks", requiredPlan: "pro", availability: "future", enforcement: "not-shipped", surface: "Integrations", pricing: null, downgrade: "future-unavailable" },
  "wallet.core": { label: "Standard Wallet eligibility", requiredPlan: "free", availability: "live", enforcement: "prelaunch", surface: "Wallet (provider launch pending)", pricing: null, downgrade: "unaffected" },
  "wallet.premium_appearance": { label: "Premium Wallet appearance", requiredPlan: "plus", availability: "future", enforcement: "prelaunch", surface: "Wallet (provider launch pending)", pricing: null, downgrade: "future-unavailable" },
} as const satisfies Record<string, CapabilityDefinition>;

/** Compatibility name retained for call sites; PLAN_MATRIX remains the only source. */
export const CAPABILITY_REGISTRY = PLAN_MATRIX;

export type CapabilityKey = keyof typeof PLAN_MATRIX;
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
  const definition: CapabilityDefinition = PLAN_MATRIX[key];
  if (definition.availability === "future" || (definition.maximumPlan && PLAN_RANK[plan] > PLAN_RANK[definition.maximumPlan])) {
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
    (Object.keys(PLAN_MATRIX) as CapabilityKey[])
      .map((key) => [key, hasCapability(plan, key)]),
  ) as Record<CapabilityKey, boolean>;
}

export function resolveClientCapabilities(plan: PlanCode): ClientCapabilitySnapshot {
  return {
    plan,
    capabilities: Object.fromEntries(
      (Object.keys(PLAN_MATRIX) as CapabilityKey[])
        .map((key) => [key, getCapabilityAccess(plan, key)]),
    ) as Record<CapabilityKey, CapabilityAccess>,
  };
}

export function listAvailableCapabilities(plan: PlanCode): CapabilityKey[] {
  return (Object.keys(PLAN_MATRIX) as CapabilityKey[])
    .filter((key) => hasCapability(plan, key));
}

export function getPricingFeatureGroups(plan: PlanCode): PricingFeature[] {
  const order = [
    "profile", "modes", "share", "network", "soundtrack", "analytics-basic", "plus-badge",
    "premium-presentation", "analytics-history", "analytics-breakdowns", "analytics-conversion",
    "pro-badge", "analytics-custom-range", "analytics-funnel", "analytics-devices", "analytics-export",
  ];
  const groups = new Map<string, { feature: PricingFeature; keys: CapabilityKey[] }>();
  for (const key of Object.keys(PLAN_MATRIX) as CapabilityKey[]) {
    const feature = PLAN_MATRIX[key].pricing;
    if (!feature) continue;
    const current: { feature: PricingFeature; keys: CapabilityKey[] } = groups.get(feature.id) ?? { feature, keys: [] };
    current.keys.push(key);
    groups.set(feature.id, current);
  }
  return [...groups.values()]
    .filter(({ keys }) => keys.every((key) => hasCapability(plan, key)))
    .map(({ feature }) => feature)
    .sort((left, right) => order.indexOf(left.id) - order.indexOf(right.id));
}

export function nextPlanAfter(plan: PlanCode): Exclude<PlanCode, "free"> | null {
  return plan === "free" ? "plus" : plan === "plus" ? "pro" : null;
}
