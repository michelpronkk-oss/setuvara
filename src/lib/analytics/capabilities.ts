import type { PlanCode } from "../billing/catalog";
import { hasCapability } from "../billing/capabilities";

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

/** Analytics is a projection of the global capability registry, not a second plan matrix. */
export function analyticsCapabilities(plan: PlanCode): AnalyticsCapabilities {
  const customRange = hasCapability(plan, "analytics.custom_range");
  const history90d = hasCapability(plan, "analytics.history_90d");
  const history30d = hasCapability(plan, "analytics.history_30d");
  const availableRanges: AnalyticsRange[] = ["7d"];
  if (history30d) availableRanges.push("30d");
  if (history90d) availableRanges.push("90d");
  if (customRange) availableRanges.push("custom");

  return {
    maxHistoryDays: customRange ? 730 : history90d ? 90 : history30d ? 30 : 7,
    availableRanges,
    sourceBreakdown: hasCapability(plan, "analytics.sources"),
    modeBreakdown: hasCapability(plan, "analytics.modes"),
    deviceInsights: hasCapability(plan, "analytics.device_insights"),
    conversion: hasCapability(plan, "analytics.conversion"),
    funnels: hasCapability(plan, "analytics.funnels"),
    customRange,
    exports: hasCapability(plan, "analytics.csv_export"),
  };
}
