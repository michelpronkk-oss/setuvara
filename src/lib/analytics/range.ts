import type { AnalyticsCapabilities, AnalyticsRange } from "./capabilities";

export type AnalyticsQuery = {
  range: AnalyticsRange;
  startDate: string;
  endDate: string;
  source: string | null;
  mode: "personal" | "event" | "business" | null;
};

const DAY_MS = 86_400_000;
const SOURCES = new Set(["direct", "profile", "share", "qr", "quick_qr", "tap", "link", "native_share"]);
const MODES = new Set(["personal", "event", "business"]);

function validDate(value: string | null): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value ? parsed : null;
}

export function resolveAnalyticsQuery(
  params: URLSearchParams,
  capabilities: AnalyticsCapabilities,
  now = new Date(),
): { ok: true; data: AnalyticsQuery } | { ok: false; reason: "upgrade" | "invalid" } {
  const requestedRange = params.get("range") ?? "7d";
  const hasCustomDates = params.has("from") || params.has("to");
  if (hasCustomDates && !capabilities.customRange) return { ok: false, reason: "upgrade" };
  const rawRange = requestedRange === "custom" || hasCustomDates ? "custom" : requestedRange;
  if (rawRange !== "7d" && rawRange !== "30d" && rawRange !== "90d" && rawRange !== "custom") {
    return { ok: false, reason: "invalid" };
  }
  const range = rawRange as AnalyticsRange;
  if (!capabilities.availableRanges.includes(range)) return { ok: false, reason: "upgrade" };

  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  let start: Date;
  let end = today;
  if (range === "custom") {
    const customStart = validDate(params.get("from"));
    const customEnd = validDate(params.get("to"));
    if (!customStart || !customEnd || customEnd > today || customStart > customEnd) {
      return { ok: false, reason: "invalid" };
    }
    const days = Math.floor((customEnd.getTime() - customStart.getTime()) / DAY_MS) + 1;
    if (days > capabilities.maxHistoryDays) return { ok: false, reason: "upgrade" };
    start = customStart;
    end = customEnd;
  } else {
    const days = Number.parseInt(range, 10);
    const daysAllowed = range === "7d" ? capabilities.maxHistoryDays >= 7
      : range === "30d" ? capabilities.maxHistoryDays >= 30
        : capabilities.maxHistoryDays >= 90;
    if (!daysAllowed) return { ok: false, reason: "upgrade" };
    start = new Date(today.getTime() - ((days - 1) * DAY_MS));
  }

  const source = params.get("source");
  const mode = params.get("mode");
  if (source && !SOURCES.has(source)) return { ok: false, reason: "invalid" };
  if (mode && !MODES.has(mode)) return { ok: false, reason: "invalid" };
  // Device class is an aggregate insight, not an owner-supplied dimension or
  // an identifier filter. Reject filters until the reporting contract supports them.
  if (params.has("device")) return { ok: false, reason: "invalid" };
  if (source && !capabilities.sourceBreakdown) return { ok: false, reason: "upgrade" };
  if (mode && !capabilities.modeBreakdown) return { ok: false, reason: "upgrade" };

  return {
    ok: true,
    data: {
      range,
      startDate: start.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10),
      source,
      mode: mode as AnalyticsQuery["mode"],
    },
  };
}
