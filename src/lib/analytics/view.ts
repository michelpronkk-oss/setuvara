import type { AnalyticsCount, AnalyticsDailyPoint, AnalyticsData, AnalyticsRangeKind } from "./normalize";

/**
 * Pure view model for /app/analytics. Every number here is read from the
 * analytics payload; the only client-side derivations are copy, shares of a
 * total, the scans sum, and weekly buckets for long custom ranges.
 */

export type Format = (value: number) => string;

const DAY_MS = 86_400_000;

export const MODE_META = {
  personal: { label: "Personal", color: "#FF5A4F" },
  event: { label: "Event", color: "#C7FF4A" },
  business: { label: "Business", color: "#AFCBFF" },
} as const;

/** Human labels for the closed ANALYTICS_SOURCES enum. */
export const SOURCE_LABELS: Readonly<Record<string, string>> = {
  quick_qr: "Quick QR",
  link: "Shared link",
  tap: "Setuvara Tap",
  qr: "QR code",
  native_share: "Share sheet",
  direct: "Opened directly",
  profile: "Setuvara profile",
  share: "Shared",
  other: "Other",
};

const SOURCE_LEADS: Readonly<Record<string, string>> = {
  quick_qr: "Most people find you through Quick QR.",
  link: "Most people find you through a shared link.",
  tap: "Most people find you through Setuvara Tap.",
  qr: "Most people find you through your QR code.",
  native_share: "Most people find you through the share sheet.",
  direct: "Most people open your Setuvara directly.",
  profile: "Most people find you through Setuvara.",
  share: "Most people find you through a share.",
  other: "People find you in many ways.",
};

export const DEVICE_META: Readonly<Record<string, { label: string; color: string }>> = {
  mobile: { label: "Phone", color: "#0D0D0D" },
  desktop: { label: "Desktop", color: "#AFCBFF" },
  tablet: { label: "Tablet", color: "#F5F4EF" },
};

export function scanTotal(summary: AnalyticsData["summary"]) {
  return summary.qrScans + summary.quickQrScans + summary.tapScans;
}

/** Day One: a successful response where nothing has happened yet. Never an error. */
export function isDayOne(summary: AnalyticsData["summary"]) {
  return summary.profileViews === 0 && summary.connections === 0 && scanTotal(summary) === 0;
}

export function rangeDays(start: string, end: string) {
  const days = Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / DAY_MS) + 1;
  return Number.isFinite(days) && days > 0 ? days : 0;
}

function utcDate(value: string) {
  return new Date(`${value}T12:00:00Z`);
}

export function shortDate(value: string, withYear = false) {
  const date = utcDate(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en", { day: "numeric", month: "short", ...(withYear ? { year: "numeric" } : {}), timeZone: "UTC" }).format(date);
}

export function axisDate(value: string) {
  return shortDate(value).toUpperCase();
}

export function dateSpan(start: string, end: string) {
  const crossesYear = start.slice(0, 4) !== end.slice(0, 4);
  return `${shortDate(start, crossesYear)} – ${shortDate(end, crossesYear)}`;
}

export function periodKicker(kind: AnalyticsRangeKind) {
  return kind === "custom" ? "CUSTOM RANGE" : `LAST ${Number.parseInt(kind, 10)} DAYS`;
}

/** "previous 7 days" for presets, "previous 120 days" for custom ranges. */
export function previousLabel(kind: AnalyticsRangeKind, days: number) {
  return `previous ${kind === "custom" ? days : Number.parseInt(kind, 10)} days`;
}

export type DeltaView = { text: string; tone: "up" | "down" | "flat" | "none" };

/** Server deltas are percentages against the previous equal period; null means nothing to compare. */
export function deltaView(delta: number | null | undefined, previous: string): DeltaView {
  if (delta === null || delta === undefined || !Number.isFinite(delta)) return { text: "First period, nothing to compare yet.", tone: "none" };
  const amount = Math.abs(delta);
  const shown = amount >= 10 ? Math.round(amount).toString() : amount.toFixed(amount % 1 === 0 ? 0 : 1);
  if (delta > 0) return { text: `▲ ${shown}% vs ${previous}`, tone: "up" };
  if (delta < 0) return { text: `▼ ${shown}% vs ${previous}`, tone: "down" };
  return { text: `Level with the ${previous}`, tone: "flat" };
}

const PERIOD_WORD: Record<"7d" | "30d" | "90d", string> = { "7d": "week", "30d": "month", "90d": "season" };

export function pageTitle(data: AnalyticsData | null, now = new Date()) {
  if (!data) return "Your signals";
  if (isDayOne(data.summary)) return "Your story starts the first time you share.";
  const kind = data.range?.kind ?? "7d";
  if (kind === "custom" && data.range) {
    const start = utcDate(data.range.start);
    const sameYear = start.getUTCFullYear() === now.getUTCFullYear();
    const month = new Intl.DateTimeFormat("en", { month: "long", ...(sameYear ? {} : { year: "numeric" }), timeZone: "UTC" }).format(start);
    return `Your signals since ${month}.`;
  }
  const word = PERIOD_WORD[kind as "7d" | "30d" | "90d"] ?? "week";
  const delta = data.comparison?.profileViewsDelta ?? null;
  if (delta === null) return "People are starting to find you.";
  if (delta > 0) return kind === "7d" ? "A good week for being found." : `Your world grew this ${word}.`;
  if (delta < 0) return `A quieter ${word}, still being found.`;
  return `A steady ${word} of being found.`;
}

export function growthTitle(kind: AnalyticsRangeKind, delta: number | null | undefined) {
  if (delta === null || delta === undefined) return "Your first stretch.";
  if (delta < 0) return "A quieter stretch.";
  if (delta === 0) return "Holding steady.";
  return kind === "7d" ? "Busier than last week." : kind === "30d" ? "Busier than last month." : "Busier than the stretch before.";
}

export type ShareRow = { key: string; label: string; count: number; share: number; color?: string };

/** Share of total, guarded against an empty or zero total. */
function withShares<T extends { key: string; label: string; count: number; color?: string }>(rows: T[]): (T & { share: number })[] {
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  return rows.map((row) => ({ ...row, share: total > 0 ? row.count / total : 0 }));
}

export function percentLabel(share: number) {
  return `${Math.round(Math.max(0, Math.min(1, share)) * 100)}%`;
}

export function modeRows(modes: AnalyticsCount<"mode">[] | undefined): ShareRow[] {
  const rows = (modes ?? [])
    .filter((item) => item.count > 0 && item.mode in MODE_META)
    .map((item) => {
      const meta = MODE_META[item.mode as keyof typeof MODE_META];
      return { key: item.mode, label: meta.label, count: item.count, color: meta.color };
    })
    .sort((left, right) => right.count - left.count);
  return withShares(rows);
}

export function modeLead(rows: ShareRow[]) {
  const top = rows[0];
  if (!top) return "";
  if (rows.length === 1) return `Only ${top.label} was opened.`;
  if (rows[1] && rows[1].count === top.count) return "Your Modes are sharing the work.";
  return top.share >= 0.5 ? `${top.label} is doing most of the work.` : `${top.label} leads, just.`;
}

/** Top six sources by views, then one "Other" row with the rest. */
export function sourceRows(sources: AnalyticsCount<"source">[] | undefined, limit = 6): ShareRow[] {
  const known = (sources ?? []).filter((item) => item.count > 0).sort((left, right) => right.count - left.count);
  const named = known.filter((item) => item.source !== "other");
  const head = named.slice(0, limit).map((item) => ({ key: item.source, label: SOURCE_LABELS[item.source] ?? "Other", count: item.count }));
  const restCount = named.slice(limit).reduce((sum, item) => sum + item.count, 0)
    + known.filter((item) => item.source === "other").reduce((sum, item) => sum + item.count, 0);
  const rows = restCount > 0 ? [...head, { key: "other", label: "Other", count: restCount }] : head;
  return withShares(rows);
}

export function sourceLead(rows: ShareRow[]) {
  const top = rows[0];
  if (!top) return "";
  if (rows[1] && rows[1].count === top.count) return `${top.label} and ${rows[1].label} bring people equally.`;
  return SOURCE_LEADS[top.key] ?? "People find you in many ways.";
}

/** Bar width relative to the largest row, so the leader always reads full. */
export function barWidth(count: number, max: number) {
  return max > 0 ? `${((count / max) * 100).toFixed(1)}%` : "0%";
}

export function deviceRows(devices: AnalyticsCount<"device">[] | undefined): ShareRow[] {
  const rows = (devices ?? [])
    .filter((item) => item.count > 0 && item.device in DEVICE_META)
    .map((item) => ({ key: item.device, label: DEVICE_META[item.device].label, count: item.count, color: DEVICE_META[item.device].color }))
    .sort((left, right) => right.count - left.count);
  return withShares(rows);
}

export function deviceLead(rows: ShareRow[]) {
  const top = rows[0];
  if (!top) return "";
  if (top.share < 0.5) return "Spread across screens.";
  return top.key === "mobile" ? "Mostly in someone's hand." : top.key === "desktop" ? "Mostly on a bigger screen." : "Mostly on a tablet.";
}

export type LoopStep = { key: "shares" | "profile_views" | "connections"; step: string; count: number; text: string };

/** Loop order: your shares, then other people's views and Connections. Different events, so no rates between them. */
export function loopSteps(funnel: AnalyticsCount<"step">[] | undefined): LoopStep[] {
  const value = (key: string) => funnel?.find((item) => item.step === key)?.count;
  const steps: LoopStep[] = [];
  const shares = value("shares");
  const views = value("profile_views");
  const connections = value("connections");
  if (shares !== undefined) steps.push({ key: "shares", step: "YOU SHARED", count: shares, text: shares === 1 ? "time, by link, share sheet or QR" : "times, by link, share sheet or QR" });
  if (views !== undefined) steps.push({ key: "profile_views", step: "PEOPLE OPENED", count: views, text: views === 1 ? "profile view" : "profile views" });
  if (connections !== undefined) steps.push({ key: "connections", step: "PEOPLE CONNECTED", count: connections, text: connections === 1 ? "new Connection" : "new Connections" });
  return steps;
}

/** Display the server rate at one decimal place. */
export function rateLabel(rate: number | undefined) {
  const value = typeof rate === "number" && Number.isFinite(rate) && rate > 0 ? rate : 0;
  return `${value.toFixed(1)}%`;
}

/** "For every 100 views" is about views, not people: one person can view many times. */
export function rateLine(rate: number | undefined, views: number) {
  const value = typeof rate === "number" && Number.isFinite(rate) && rate > 0 ? rate : 0;
  if (views === 0) return "Once people open your Setuvara, this shows how often a view becomes a Connection.";
  if (value === 0) return "No views turned into Connections in this period yet.";
  if (value >= 100) return "More Connections than views in this period. Some people connected without opening your profile.";
  const people = Math.round(value);
  if (people < 1) return "For every 100 views, fewer than one person connects with you.";
  return `For every 100 views, about ${people} ${people === 1 ? "person connects" : "people connect"} with you.`;
}

/** 100 dots, filled = round(rate); any rate above 0 fills at least one. */
export function filledDots(rate: number | undefined) {
  const value = typeof rate === "number" && Number.isFinite(rate) && rate > 0 ? rate : 0;
  return Math.min(100, Math.max(value > 0 ? 1 : 0, Math.round(value)));
}

export type ChartBar = { key: string; start: string; end: string; views: number; connections: number };

/** Up to 90 bars as days; longer custom ranges are summed into weeks client-side. */
export function chartBars(daily: AnalyticsDailyPoint[] | undefined): { bars: ChartBar[]; unit: "day" | "week" } {
  const days = [...(daily ?? [])].sort((left, right) => left.date.localeCompare(right.date));
  if (days.length <= 90) {
    return { unit: "day", bars: days.map((day) => ({ key: day.date, start: day.date, end: day.date, views: day.profileViews, connections: day.connections })) };
  }
  const bars: ChartBar[] = [];
  for (let index = 0; index < days.length; index += 7) {
    const week = days.slice(index, index + 7);
    bars.push({
      key: week[0].date,
      start: week[0].date,
      end: week.at(-1)!.date,
      views: week.reduce((sum, day) => sum + day.profileViews, 0),
      connections: week.reduce((sum, day) => sum + day.connections, 0),
    });
  }
  return { unit: "week", bars };
}

export function axisLabels(bars: ChartBar[]) {
  if (!bars.length) return [];
  const indexes = [...new Set([0, Math.floor((bars.length - 1) / 2), bars.length - 1])];
  return indexes.map((index) => axisDate(bars[index].start));
}

export function chartSummary(bars: ChartBar[], unit: "day" | "week", fmt: Format) {
  if (!bars.length) return "";
  const total = bars.reduce((sum, bar) => sum + bar.views, 0);
  const busiest = bars.reduce((best, bar) => (bar.views > best.views ? bar : best), bars[0]);
  const connectedDays = bars.filter((bar) => bar.connections > 0).length;
  const span = dateSpan(bars[0].start, bars.at(-1)!.end);
  const noun = unit === "day" ? "day" : "week";
  const busiestText = busiest.views > 0 ? ` The busiest ${noun} was ${unit === "day" ? shortDate(busiest.start) : `the week of ${shortDate(busiest.start)}`} with ${fmt(busiest.views)}.` : "";
  return `Profile views per ${noun}, ${span}: ${fmt(total)} in total.${busiestText} Someone connected on ${fmt(connectedDays)} ${connectedDays === 1 ? noun : `${noun}s`}.`;
}

export function barReadout(bar: ChartBar, unit: "day" | "week", fmt: Format) {
  const when = unit === "day" ? axisDate(bar.start) : `WEEK OF ${axisDate(bar.start)}`;
  return `${when} · ${fmt(bar.views)} ${bar.views === 1 ? "view" : "views"} · ${fmt(bar.connections)} ${bar.connections === 1 ? "Connection" : "Connections"}`;
}

/** Free scan methods, read straight from the three summary fields. */
export function scanMethods(summary: AnalyticsData["summary"]) {
  return [
    { key: "quick_qr", label: "Quick QR", count: summary.quickQrScans },
    { key: "qr", label: "QR code", count: summary.qrScans },
    { key: "tap", label: "Setuvara Tap", count: summary.tapScans },
  ].sort((left, right) => right.count - left.count);
}
