import type { PlanCode } from "@/lib/billing/catalog";

export type AnalyticsRange = "7d" | "30d" | "90d" | "custom";

export type AnalyticsCapabilities = {
  maxHistoryDays: number;
  availableRanges: readonly AnalyticsRange[];
  sourceBreakdown: boolean;
  modeBreakdown: boolean;
  deviceInsights: boolean;
  conversion: boolean;
  funnels: boolean;
  customRange: boolean;
  exports: boolean;
};

const CAPABILITIES: Record<PlanCode, AnalyticsCapabilities> = {
  free: {
    maxHistoryDays: 7,
    availableRanges: ["7d"],
    sourceBreakdown: false,
    modeBreakdown: false,
    deviceInsights: false,
    conversion: false,
    funnels: false,
    customRange: false,
    exports: false,
  },
  plus: {
    maxHistoryDays: 90,
    availableRanges: ["7d", "30d", "90d"],
    sourceBreakdown: true,
    modeBreakdown: true,
    deviceInsights: false,
    conversion: true,
    funnels: false,
    customRange: false,
    exports: false,
  },
  pro: {
    maxHistoryDays: 730,
    availableRanges: ["7d", "30d", "90d", "custom"],
    sourceBreakdown: true,
    modeBreakdown: true,
    deviceInsights: true,
    conversion: true,
    funnels: true,
    customRange: true,
    exports: true,
  },
};

export function analyticsCapabilities(plan: PlanCode): AnalyticsCapabilities {
  return CAPABILITIES[plan];
}
