import "server-only";

import { randomUUID } from "node:crypto";

import { createBillingAdminClient } from "@/lib/billing/admin";

export const ANALYTICS_SOURCES = ["direct", "profile", "share", "qr", "quick_qr", "tap", "link", "native_share", "other"] as const;
export type AnalyticsSource = (typeof ANALYTICS_SOURCES)[number];
export type AnalyticsMode = "personal" | "event" | "business";
export type DeviceClass = "mobile" | "tablet" | "desktop" | "unknown";

const MODE_SET = new Set<AnalyticsMode>(["personal", "event", "business"]);
const SOURCE_SET = new Set<string>(ANALYTICS_SOURCES);

export function isAnalyticsMode(value: string): value is AnalyticsMode {
  return MODE_SET.has(value as AnalyticsMode);
}

export function isAnalyticsSource(value: string): value is AnalyticsSource {
  return SOURCE_SET.has(value);
}

/** Keep only a coarse class; never persist or log the raw User-Agent. */
export function classifyAnalyticsDevice(userAgent: string | null | undefined): DeviceClass {
  const ua = userAgent?.slice(0, 512).toLowerCase() ?? "";
  if (!ua) return "unknown";
  if (/ipad|tablet|kindle|silk|playbook/.test(ua) || (/android/.test(ua) && !/mobile/.test(ua))) return "tablet";
  if (/mobile|iphone|ipod|android|windows phone|blackberry/.test(ua)) return "mobile";
  return "desktop";
}

export async function recordProductAnalyticsEvent(input: {
  eventName: string;
  ownerProfileId: string;
  mode: AnalyticsMode | null;
  source: AnalyticsSource;
  deviceClass?: DeviceClass;
  idempotencyKey?: string;
}) {
  try {
    const admin = createBillingAdminClient();
    const { error } = await admin.rpc("record_product_analytics_event", {
      p_event_name: input.eventName,
      p_idempotency_key: input.idempotencyKey ?? randomUUID(),
      p_owner_profile_id: input.ownerProfileId,
      p_mode_slug: input.mode,
      p_source: input.source,
      p_device_class: input.deviceClass ?? "unknown",
    });
    return !error;
  } catch {
    return false;
  }
}

export async function getAnalyticsProfileId(username: string): Promise<string | null> {
  if (!/^[a-z0-9_]{3,24}$/.test(username)) return null;
  try {
    const admin = createBillingAdminClient();
    const { data, error } = await admin.from("profiles").select("id").eq("username", username).maybeSingle();
    return !error && typeof data?.id === "string" ? data.id : null;
  } catch {
    return null;
  }
}
