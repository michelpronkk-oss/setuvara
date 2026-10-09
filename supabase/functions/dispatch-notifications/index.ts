/// <reference types="jsr:@supabase/functions-js/edge-runtime.d.ts" />

import { contentForNotification, renderEmail, type EmailTemplateKey } from "../_shared/email.tsx";

type Delivery = { id: string; delivery_key: string; recipient_user_id: string; category: string; template_key: EmailTemplateKey; attempt_count: number };
type Context = {
  delivery: { id: string; key: string; recipientUserId: string; category: string; template: EmailTemplateKey };
  recipient: { email: string | null; confirmed: boolean };
  profile: { username: string; displayName: string } | null;
  preferences: { connectionEmails: boolean; connectionRecaps: boolean; passportMilestones: boolean; passportStamps: boolean; lifecycleEmails: boolean };
  events: { sourceId: string | null; eventKey: string; createdAt: string }[];
  encounters: { otherName: string; otherRole: string | null; otherCompany: string | null; eventName: string | null; city: string | null; dateLabel: string | null; createdAt: string }[];
  claimedProfile: { displayName: string; username: string } | null;
  milestone: { threshold: number; unlockedAt: string } | null;
  stamps: { title: string; subtitle: string | null; type: string; earnedAt: string }[];
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")?.replace(/\/$/, "");
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const resendKey = Deno.env.get("RESEND_API_KEY");
const allowedSiteOrigins = new Set([
  "https://setuvara.com",
  "https://www.setuvara.com",
  "http://127.0.0.1:3014",
  "http://localhost:3014",
]);
function getSiteUrl(): string {
  const configured = Deno.env.get("SETUVARA_SITE_URL") ?? "https://setuvara.com";
  try {
    const url = new URL(configured);
    return allowedSiteOrigins.has(url.origin) ? url.origin : "https://setuvara.com";
  } catch {
    return "https://setuvara.com";
  }
}

function json(status: number, body: Record<string, unknown>) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  if (!supabaseUrl || !serviceKey) throw new Error("runtime_not_configured");
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  if (!response.ok) throw new Error("database_request_failed");
  return await response.json() as T;
}

async function createUnsubscribeUrl(userId: string, category: string, siteUrl: string): Promise<string> {
  const tokenBytes = crypto.getRandomValues(new Uint8Array(32));
  const token = btoa(String.fromCharCode(...tokenBytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)));
  const hash = [...digest].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  const stored = await rpc<boolean>("record_email_unsubscribe_token", { p_user_id: userId, p_category: category, p_hash_hex: hash });
  if (!stored) throw new Error("unsubscribe_token_not_stored");
  return `${siteUrl}/api/email/unsubscribe?token=${token}`;
}

function preferencesAllow(context: Context): boolean {
  switch (context.delivery.template) {
    case "new_connection": return context.preferences.connectionEmails;
    case "connection_recap": return context.preferences.connectionEmails && context.preferences.connectionRecaps;
    case "guest_claimed": return context.preferences.connectionEmails;
    case "passport_milestone": return context.preferences.passportMilestones;
    case "passport_stamp": return context.preferences.passportStamps;
    case "welcome": return context.preferences.lifecycleEmails;
    default: return false;
  }
}

function notificationDetails(context: Context) {
  switch (context.delivery.template) {
    case "welcome": return context.profile?.username ? [{ label: "username", value: `setuvara.com/${context.profile.username}` }] : undefined;
    case "new_connection": {
      const event = context.encounters[0];
      return event ? [
        { label: "name", value: event.otherName },
        ...(event.eventName ? [{ label: "event", value: event.eventName }] : []),
        ...(event.city ? [{ label: "city", value: event.city }] : []),
        ...(event.dateLabel ? [{ label: "date", value: event.dateLabel }] : []),
        ...(event.otherRole ? [{ label: "role", value: event.otherRole }] : []),
        ...(event.otherCompany ? [{ label: "company", value: event.otherCompany }] : []),
      ] : undefined;
    }
    case "connection_recap": {
      const events = context.encounters;
      const eventName = events.find((event) => event.eventName)?.eventName;
      const city = events.find((event) => event.city)?.city;
      return [
        { label: "count", value: String(events.length) },
        ...(eventName ? [{ label: "event", value: eventName }] : []),
        ...(city ? [{ label: "city", value: city }] : []),
        ...(events.length ? [{ label: "dates", value: dateRange(events.map((event) => event.createdAt)) }] : []),
        ...events.slice(0, 5).map((event, index) => ({ label: `person ${index + 1}`, value: event.otherName })),
        ...(events.length > 5 ? [{ label: "more", value: `+${events.length - 5}` }] : []),
      ];
    }
    case "guest_claimed": return context.claimedProfile ? [{ label: "name", value: context.claimedProfile.displayName }, { label: "username", value: `setuvara.com/${context.claimedProfile.username}` }] : undefined;
    case "passport_milestone": return context.milestone ? [{ label: "milestone", value: `${context.milestone.threshold} Connections` }, { label: "unlocked", value: new Date(context.milestone.unlockedAt).toISOString().slice(0, 10) }] : undefined;
    case "passport_stamp": {
      const [first] = context.stamps;
      return [
        ...context.stamps.map((stamp) => ({ label: "stamp", value: stamp.title })),
        ...(first?.subtitle ? [{ label: "stamp_subtitle", value: first.subtitle }] : []),
        ...(first ? [{ label: "stamp_type", value: first.type }, { label: "stamp_date", value: first.earnedAt.slice(0, 10) }] : []),
      ];
    }
    default: return undefined;
  }
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
// "08–09 Oct 2026" style range (en dash) for recap emails; display only.
function dateRange(values: string[]): string {
  const dates = values.map((value) => new Date(value)).filter((date) => !Number.isNaN(date.getTime())).sort((a, b) => a.getTime() - b.getTime());
  if (!dates.length) return "";
  const fmt = (date: Date, withMonth = true, withYear = true) => `${String(date.getUTCDate()).padStart(2, "0")}${withMonth ? ` ${MONTHS[date.getUTCMonth()]}` : ""}${withYear ? ` ${date.getUTCFullYear()}` : ""}`;
  const [start, end] = [dates[0], dates[dates.length - 1]];
  if (start.toISOString().slice(0, 10) === end.toISOString().slice(0, 10)) return fmt(start);
  if (start.getUTCFullYear() !== end.getUTCFullYear()) return `${fmt(start)}–${fmt(end)}`;
  if (start.getUTCMonth() !== end.getUTCMonth()) return `${fmt(start, true, false)}–${fmt(end)}`;
  return `${fmt(start, false, false)}–${fmt(end)}`;
}

function unsubscribeCategory(template: EmailTemplateKey): string {
  if (template === "welcome") return "lifecycle_emails";
  if (template === "new_connection" || template === "guest_claimed") return "connection_emails";
  if (template === "connection_recap") return "connection_recaps";
  if (template === "passport_milestone") return "passport_milestones";
  if (template === "passport_stamp") return "passport_stamps";
  return "product_updates";
}

async function deliver(delivery: Delivery): Promise<boolean> {
  const context = await rpc<Context>("get_email_delivery_context", { p_delivery_id: delivery.id });
  if (!context?.recipient?.confirmed || !context.recipient.email || !context.profile) {
    await rpc("suppress_email_delivery", { p_delivery_id: delivery.id });
    return true;
  }
  if (!preferencesAllow(context)) {
    await rpc("suppress_email_delivery", { p_delivery_id: delivery.id });
    return true;
  }

  const siteUrl = getSiteUrl();
  const preferencesUrl = `${siteUrl}/app/settings/notifications`;
  const unsubscribeUrl = await createUnsubscribeUrl(context.delivery.recipientUserId, unsubscribeCategory(context.delivery.template), siteUrl);
  const content = contentForNotification({
    template: context.delivery.template,
    userName: context.profile.displayName,
    profileUrl: siteUrl,
    details: notificationDetails(context),
    unsubscribeUrl,
    preferencesUrl,
  });
  const rendered = await renderEmail(content);
  if (!resendKey) throw new Error("provider_not_configured");
  const sent = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `setuvara:${delivery.id}`,
    },
    body: JSON.stringify({
      from: "Setuvara <noreply@setuvara.com>",
      to: [context.recipient.email],
      subject: content.subject,
      html: rendered.html,
      text: rendered.text,
      headers: {
        "List-Unsubscribe": `<${unsubscribeUrl}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
      click_tracking: false,
      open_tracking: false,
    }),
  });
  if (!sent.ok) throw new Error("provider_rejected_email");
  const result = await sent.json().catch(() => ({})) as { id?: string };
  await rpc("complete_email_delivery", { p_delivery_id: delivery.id, p_provider_message_id: result.id ?? "accepted" });
  return true;
}

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") return new Response(null, { status: 405, headers: { Allow: "POST" } });
  if (!supabaseUrl || !serviceKey || !resendKey) return json(503, { error: "Notification delivery is not configured." });
  const cronSecret = request.headers.get("x-setuvara-cron-secret");
  if (!cronSecret || !/^[a-f0-9]{64}$/.test(cronSecret)) return json(401, { error: "Unauthorized." });
  const authorized = await rpc<boolean>("verify_notification_dispatch_secret", { p_secret: cronSecret }).catch(() => false);
  if (!authorized) return json(401, { error: "Unauthorized." });

  let deliveries: Delivery[];
  try {
    deliveries = await rpc<Delivery[]>("claim_email_deliveries", { p_limit: 25 });
  } catch {
    return json(503, { error: "Notification queue is unavailable." });
  }
  let delivered = 0;
  let failed = 0;
  for (const delivery of deliveries) {
    try {
      await deliver(delivery);
      delivered += 1;
    } catch {
      await rpc("fail_email_delivery", { p_delivery_id: delivery.id, p_failure_code: "provider_error" }).catch(() => null);
      failed += 1;
    }
  }
  console.info("Setuvara notification batch processed", { claimed: deliveries.length, delivered, failed });
  return json(200, { claimed: deliveries.length, delivered, failed });
});
