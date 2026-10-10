import "server-only";

import type { PlanCode } from "@/lib/billing/catalog";
import { createBillingAdminClient } from "@/lib/billing/admin";
import type { AnalyticsQuery } from "./range";

type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function numberAt(source: JsonRecord, ...keys: string[]): number {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "number" && Number.isFinite(value) && value >= 0) return value;
  }
  return 0;
}

function listAt(source: JsonRecord, ...keys: string[]): unknown[] {
  for (const key of keys) if (Array.isArray(source[key])) return source[key] as unknown[];
  return [];
}

function breakdown(value: unknown, key: "source" | "mode" | "device") {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const row = record(item);
    const label = row[key] ?? row[`${key}_slug`] ?? (key === "device" ? row.device_class : undefined) ?? row.name;
    const count = row.count ?? row.total ?? row.views ?? row.scans ?? row.connections;
    return typeof label === "string" && label.length <= 40 && typeof count === "number" && Number.isSafeInteger(count) && count >= 0
      ? [{ [key]: label, count }]
      : [];
  }).slice(0, 30);
}

function dailyRows(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const row = record(item);
    const date = row.date ?? row.day;
    if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return [];
    return [{
      date,
      profileViews: numberAt(row, "profileViews", "profile_views", "views"),
      qrScans: numberAt(row, "qrScans", "qr_scans"),
      quickQrScans: numberAt(row, "quickQrScans", "quick_qr_scans"),
      tapScans: numberAt(row, "tapScans", "tap_scans"),
      connections: numberAt(row, "connections", "completed_connections"),
    }];
  }).slice(0, 731);
}

function boundedFunnel(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const row = record(item);
    const step = row.step ?? row.name;
    const count = row.count ?? row.total;
    return typeof step === "string" && step.length <= 60 && typeof count === "number" && Number.isSafeInteger(count) && count >= 0
      ? [{ step, count }]
      : [];
  }).slice(0, 20);
}

function nullableDelta(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function safeComparison(value: unknown) {
  const row = record(value);
  return {
    profileViewsDelta: nullableDelta(row.profile_views_delta ?? row.profileViewsDelta),
    connectionsDelta: nullableDelta(row.connections_delta ?? row.connectionsDelta),
  };
}

export type ProfileAnalyticsReport = {
  plan: PlanCode;
  range: { kind: AnalyticsQuery["range"]; start: string; end: string };
  summary: {
    profileViews: number;
    qrScans: number;
    quickQrScans: number;
    tapScans: number;
    connections: number;
    conversionRate: number;
  };
  daily: ReturnType<typeof dailyRows>;
  sources: ReturnType<typeof breakdown>;
  modes: ReturnType<typeof breakdown>;
  deviceClasses: ReturnType<typeof breakdown>;
  funnel: ReturnType<typeof boundedFunnel>;
  comparison: ReturnType<typeof safeComparison>;
  generatedAt: string;
};

export async function getProfileAnalyticsReport(input: {
  profileId: string;
  plan: PlanCode;
  query: AnalyticsQuery;
}): Promise<ProfileAnalyticsReport> {
  const admin = createBillingAdminClient();
  const { data, error } = await admin.rpc("get_profile_analytics", {
    p_profile_id: input.profileId,
    p_plan_code: input.plan,
    p_range_kind: input.query.range,
    p_from: input.query.startDate,
    p_to: input.query.endDate,
    p_mode: input.query.mode,
    p_source: input.query.source,
    p_device_id: null,
  });
  if (error) throw new Error("analytics_unavailable");

  const payload = record(data);
  const summary = record(payload.summary);
  const views = numberAt(summary, "profileViews", "profile_views", "views");
  const connections = numberAt(summary, "connections", "completed_connections");
  const rate = views > 0 ? Math.round((connections / views) * 10_000) / 100 : 0;

  return {
    plan: input.plan,
    range: { kind: input.query.range, start: input.query.startDate, end: input.query.endDate },
    summary: {
      profileViews: views,
      qrScans: numberAt(summary, "qrScans", "qr_scans"),
      quickQrScans: numberAt(summary, "quickQrScans", "quick_qr_scans"),
      tapScans: numberAt(summary, "tapScans", "tap_scans"),
      connections,
      conversionRate: rate,
    },
    daily: dailyRows(payload.daily),
    sources: breakdown(listAt(payload, "sources", "sourceBreakdown", "source_breakdown"), "source"),
    modes: breakdown(listAt(payload, "modes", "modeBreakdown", "mode_breakdown"), "mode"),
    deviceClasses: breakdown(listAt(payload, "devices", "deviceClasses", "device_classes"), "device"),
    funnel: boundedFunnel(payload.funnel),
    comparison: safeComparison(payload.comparison),
    generatedAt: new Date().toISOString(),
  };
}

export async function getProfileIdForUser(userId: string): Promise<string | null> {
  const admin = createBillingAdminClient();
  const { data, error } = await admin.from("profiles").select("id").eq("id", userId).maybeSingle();
  if (error) throw new Error("analytics_unavailable");
  return typeof data?.id === "string" ? data.id : null;
}

export async function getInternalAnalyticsAggregate(start: string, end: string) {
  const admin = createBillingAdminClient();
  const { data, error } = await admin.rpc("get_internal_product_analytics", {
    p_from: start,
    p_to: end,
  });
  if (error) throw new Error("analytics_unavailable");
  return record(data);
}
