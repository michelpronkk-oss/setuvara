/// <reference types="jsr:@supabase/functions-js/edge-runtime.d.ts" />

import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";
import { contentForAuth, renderEmail, type EmailTemplateKey } from "../_shared/email.tsx";

type HookPayload = {
  user?: { email?: string; new_email?: string; user_metadata?: { username?: unknown } };
  email_data?: {
    email_action_type?: string;
    token?: string;
    token_hash?: string;
    token_new?: string;
    token_hash_new?: string;
    redirect_to?: string;
    site_url?: string;
  };
};

const ALLOWED_ORIGINS = new Set([
  "https://setuvara.com",
  "https://www.setuvara.com",
  "http://127.0.0.1:3014",
  "http://localhost:3014",
]);

const AUTH_TYPES: Record<string, { template: EmailTemplateKey; otpType: string }> = {
  signup: { template: "signup", otpType: "email" },
  invite: { template: "invite", otpType: "invite" },
  magiclink: { template: "magiclink", otpType: "magiclink" },
  recovery: { template: "recovery", otpType: "recovery" },
  email: { template: "email_change", otpType: "email" },
  email_change: { template: "email_change", otpType: "email_change" },
};

function response(status: number, error?: string) {
  return new Response(error ? JSON.stringify({ error }) : "{}", {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

function isEmail(value: unknown): value is string {
  return typeof value === "string" && value.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function safeNext(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/app/identity";
  try {
    const url = new URL(value, "https://setuvara.com");
    return url.origin === "https://setuvara.com" ? `${url.pathname}${url.search}` : "/app/identity";
  } catch {
    return "/app/identity";
  }
}

function originFor(value?: string): string | null {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    return ALLOWED_ORIGINS.has(parsed.origin) ? parsed.origin : null;
  } catch {
    return null;
  }
}

function confirmationUrl(data: NonNullable<HookPayload["email_data"]>, hash: string, type: string): string | null {
  if (!/^[A-Za-z0-9_-]{16,512}$/.test(hash)) return null;
  const origin = originFor(data.redirect_to) ?? originFor(data.site_url) ?? "https://setuvara.com";
  let source: URL | null = null;
  try { source = data.redirect_to ? new URL(data.redirect_to) : null; } catch { /* use safe default */ }
  const url = new URL("/auth/confirm", origin);
  url.searchParams.set("next", safeNext(source?.searchParams.get("next") ?? null));
  url.searchParams.set("token_hash", hash);
  url.searchParams.set("type", type);
  return url.toString();
}

async function send(to: string, content: Parameters<typeof renderEmail>[0]): Promise<boolean> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) return false;
  const rendered = await renderEmail(content);
  const idempotencyKey = content.category === "security" ? undefined : crypto.randomUUID();
  const result = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    },
    body: JSON.stringify({
      from: "Setuvara <noreply@setuvara.com>",
      to: [to],
      subject: content.subject,
      html: rendered.html,
      text: rendered.text,
      click_tracking: false,
      open_tracking: false,
    }),
  });
  if (!result.ok) return false;
  console.info("Setuvara email accepted by Resend", { category: content.category });
  return true;
}

async function sendAction(to: string, action: string, data: NonNullable<HookPayload["email_data"]>, hash: string, type: string, handle?: string) {
  const url = confirmationUrl(data, hash, type);
  if (!url) return false;
  // Rendering only: the handle shows in the confirm email; contentForAuth re-validates it.
  const content = contentForAuth({ template: AUTH_TYPES[action].template, url, handle, email: to });
  return send(to, content);
}

function handleFrom(payload: HookPayload): string | undefined {
  const value = payload.user?.user_metadata?.username;
  return typeof value === "string" && /^[a-z0-9_]{3,24}$/.test(value) ? value : undefined;
}

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") return new Response(null, { status: 405, headers: { Allow: "POST" } });
  const rawBody = await request.text();
  const configuredSecret = Deno.env.get("SEND_EMAIL_HOOK_SECRET");
  if (!configuredSecret) return response(500, "Email delivery is not configured.");

  let payload: HookPayload;
  try {
    const signingSecret = configuredSecret.replace(/^v1,whsec_/, "");
    payload = new Webhook(signingSecret).verify(rawBody, Object.fromEntries(request.headers)) as HookPayload;
  } catch {
    return response(401, "Invalid webhook signature.");
  }

  const data = payload.email_data;
  const action = data?.email_action_type;
  if (!data || !action) return response(400, "Invalid email event.");
  console.info("Setuvara Send Email Hook signature verified", { action });

  try {
    if (action === "email_change") {
      const current = payload.user?.email;
      const next = payload.user?.new_email;
      if (!isEmail(next)) return response(400, "Invalid email change event.");
      if (data.token_hash_new && data.token_hash) {
        if (!isEmail(current)) return response(400, "Invalid email change event.");
        const [currentSent, nextSent] = await Promise.all([
          sendAction(current, action, data, data.token_hash_new, "email_change"),
          sendAction(next, action, data, data.token_hash, "email_change"),
        ]);
        return currentSent && nextSent ? response(200) : response(502, "Email delivery failed.");
      }
      const hash = data.token_hash ?? data.token_hash_new;
      return hash && await sendAction(next, action, data, hash, "email_change")
        ? response(200)
        : response(502, "Email delivery failed.");
    }

    if (action === "reauthentication") {
      const email = payload.user?.email;
      const code = data.token;
      if (!isEmail(email) || !code || !/^\d{6}$/.test(code)) return response(400, "Invalid security event.");
      return await send(email, contentForAuth({ template: "reauthentication", code })) ? response(200) : response(502, "Email delivery failed.");
    }

    if (action.endsWith("_notification")) {
      const email = payload.user?.email;
      if (!isEmail(email)) return response(400, "Invalid account event.");
      return await send(email, contentForAuth({ template: "account_notice" })) ? response(200) : response(502, "Email delivery failed.");
    }

    const authType = AUTH_TYPES[action];
    const email = payload.user?.email;
    if (!authType || !isEmail(email) || !data.token_hash) return response(400, "Unsupported or invalid email event.");
    return await sendAction(email, action, data, data.token_hash, authType.otpType, handleFrom(payload)) ? response(200) : response(502, "Email delivery failed.");
  } catch {
    return response(502, "Email delivery failed.");
  }
});
