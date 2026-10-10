import type { PlanCode } from "../billing/catalog";

export type AnalyticsRangeKind = "7d" | "30d" | "90d" | "custom";

export type AnalyticsDailyPoint = {
  date: string;
  profileViews: number;
  connections: number;
};

export type AnalyticsCount<K extends string> = { [P in K]: string } & { count: number };

export type AnalyticsData = {
  plan: PlanCode;
  range?: { kind: AnalyticsRangeKind; start: string; end: string };
  capabilities?: {
    historyDays?: number;
    availableRanges?: string[];
    sourceBreakdown?: boolean;
    modeBreakdown?: boolean;
    deviceInsights?: boolean;
    conversion?: boolean;
    funnels?: boolean;
    customRange?: boolean;
    exports?: boolean;
  };
  summary: {
    profileViews: number;
    qrScans: number;
    quickQrScans: number;
    tapScans: number;
    connections: number;
    conversionRate?: number;
  };
  daily?: AnalyticsDailyPoint[];
  sources?: AnalyticsCount<"source">[];
  modes?: AnalyticsCount<"mode">[];
  funnel?: AnalyticsCount<"step">[];
  deviceClasses?: AnalyticsCount<"device">[];
  comparison?: { profileViewsDelta: number | null; connectionsDelta: number | null };
};

type JsonRecord = Record<string, unknown>;

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const RANGE_KINDS = new Set(["7d", "30d", "90d", "custom"]);

function asRecord(value: unknown): JsonRecord | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : undefined;
}

/** Counts must be finite and non-negative; anything else is a broken payload, never a zero. */
function count(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

function counted<K extends string>(value: unknown, key: K, ...aliases: string[]): AnalyticsCount<K>[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.flatMap((item) => {
    const row = asRecord(item);
    if (!row) return [];
    const label = [key, ...aliases].map((name) => row[name]).find((candidate) => typeof candidate === "string");
    const total = count(row.count);
    return typeof label === "string" && label.length > 0 && label.length <= 60 && total !== null
      ? [{ [key]: label, count: total } as AnalyticsCount<K>]
      : [];
  });
}

/**
 * Validates the `/api/analytics` response. Returns null only when the core summary is
 * missing or malformed: that is a real error. A 200 with zeros and empty arrays is valid.
 */
export function normalizeAnalytics(value: unknown): AnalyticsData | null {
  const raw = asRecord(value);
  const summary = asRecord(raw?.summary);
  if (!raw || !summary || !["free", "plus", "pro"].includes(String(raw.plan))) return null;
  const number = (camel: string, snake: string) => count(summary[snake] ?? summary[camel]);
  const profileViews = number("profileViews", "profile_views");
  const qrScans = number("qrScans", "qr_scans");
  const quickQrScans = number("quickQrScans", "quick_qr_scans");
  const tapScans = number("tapScans", "tap_scans");
  const connections = number("connections", "connections");
  if (profileViews === null || qrScans === null || quickQrScans === null || tapScans === null || connections === null) return null;
  const conversionRate = number("conversionRate", "conversion_rate");

  const capabilitiesRaw = asRecord(raw.capabilities);
  const rangeRaw = asRecord(raw.range);
  const comparisonRaw = asRecord(raw.comparison);
  const list = (...keys: string[]) => keys.map((key) => raw[key]).find(Array.isArray);
  const daily = Array.isArray(raw.daily) ? raw.daily.flatMap((item) => {
    const row = asRecord(item);
    const date = row?.date;
    const views = count(row?.profileViews ?? row?.profile_views);
    const connects = count(row?.connections);
    return typeof date === "string" && DATE.test(date) && views !== null && connects !== null
      ? [{ date, profileViews: views, connections: connects }]
      : [];
  }) : undefined;
  const delta = (camel: string, snake: string) => {
    const item = comparisonRaw?.[snake] ?? comparisonRaw?.[camel];
    return typeof item === "number" && Number.isFinite(item) ? item : null;
  };
  const flag = (key: string) => typeof capabilitiesRaw?.[key] === "boolean" ? { [key]: capabilitiesRaw[key] as boolean } : {};
  const rangeKind = String(rangeRaw?.kind ?? "");

  return {
    plan: raw.plan as PlanCode,
    summary: {
      profileViews,
      qrScans,
      quickQrScans,
      tapScans,
      connections,
      ...(conversionRate !== null ? { conversionRate } : {}),
    },
    ...(RANGE_KINDS.has(rangeKind) && typeof rangeRaw?.start === "string" && DATE.test(rangeRaw.start) && typeof rangeRaw.end === "string" && DATE.test(rangeRaw.end)
      ? { range: { kind: rangeKind as AnalyticsRangeKind, start: rangeRaw.start, end: rangeRaw.end } }
      : {}),
    ...(capabilitiesRaw ? { capabilities: {
      ...(typeof capabilitiesRaw.historyDays === "number" ? { historyDays: capabilitiesRaw.historyDays } : {}),
      ...(Array.isArray(capabilitiesRaw.availableRanges) ? { availableRanges: capabilitiesRaw.availableRanges.filter((item): item is string => typeof item === "string") } : {}),
      ...flag("sourceBreakdown"),
      ...flag("modeBreakdown"),
      ...flag("deviceInsights"),
      ...flag("conversion"),
      ...flag("funnels"),
      ...flag("customRange"),
      ...flag("exports"),
    } } : {}),
    ...(daily ? { daily } : {}),
    ...(list("sources", "sourceBreakdown") ? { sources: counted(list("sources", "sourceBreakdown"), "source") } : {}),
    ...(list("modes", "modeBreakdown") ? { modes: counted(list("modes", "modeBreakdown"), "mode") } : {}),
    ...(list("funnel") ? { funnel: counted(list("funnel"), "step") } : {}),
    ...(list("deviceClasses", "device_classes", "devices", "deviceBreakdown")
      ? { deviceClasses: counted(list("deviceClasses", "device_classes", "devices", "deviceBreakdown"), "device", "device_class") }
      : {}),
    ...(comparisonRaw ? { comparison: { profileViewsDelta: delta("profileViewsDelta", "profile_views_delta"), connectionsDelta: delta("connectionsDelta", "connections_delta") } } : {}),
  };
}
