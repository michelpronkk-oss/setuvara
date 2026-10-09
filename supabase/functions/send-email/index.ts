/// <reference types="jsr:@supabase/functions-js/edge-runtime.d.ts" />

import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";

type EmailActionType =
  | "signup"
  | "invite"
  | "magiclink"
  | "recovery"
  | "email_change"
  | "email"
  | "reauthentication"
  | "password_changed_notification"
  | "email_changed_notification"
  | "phone_changed_notification"
  | "identity_linked_notification"
  | "identity_unlinked_notification"
  | "mfa_factor_enrolled_notification"
  | "mfa_factor_unenrolled_notification";

type HookPayload = {
  user?: { email?: string; new_email?: string };
  email_data?: {
    email_action_type?: EmailActionType;
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
  "http://127.0.0.1:3014",
  "http://localhost:3014",
]);

const ACTION_TYPES: Record<string, string> = {
  signup: "email",
  invite: "invite",
  magiclink: "magiclink",
  recovery: "recovery",
  email: "email",
  email_change: "email_change",
};

const EMAIL_CONTENT: Record<string, { subject: string; label: string; headline: string; copy: string; cta: string }> = {
  signup: {
    subject: "Confirm your Setuvara",
    label: "CONFIRM YOUR IDENTITY",
    headline: "One identity. Every version of you.",
    copy: "Confirm your email address to finish creating your Setuvara.",
    cta: "Confirm my Setuvara",
  },
  invite: {
    subject: "You’re invited to Setuvara",
    label: "YOUR SETUVARA INVITATION",
    headline: "Your identity starts here.",
    copy: "Confirm your email address to accept your Setuvara invitation.",
    cta: "Accept invitation",
  },
  magiclink: {
    subject: "Your Setuvara sign-in link",
    label: "SIGN IN TO SETUVARA",
    headline: "Continue to your identity.",
    copy: "Use this secure link to sign in to your Setuvara account.",
    cta: "Sign in to Setuvara",
  },
  recovery: {
    subject: "Reset your Setuvara password",
    label: "PASSWORD RESET",
    headline: "Choose a new password.",
    copy: "We received a request to reset your Setuvara password.",
    cta: "Reset password",
  },
  email: {
    subject: "Confirm your Setuvara email",
    label: "CONFIRM YOUR EMAIL",
    headline: "Keep your identity connected.",
    copy: "Confirm this email address for your Setuvara account.",
    cta: "Confirm email",
  },
  email_change: {
    subject: "Confirm your Setuvara email change",
    label: "EMAIL ADDRESS CHANGE",
    headline: "Confirm your email address.",
    copy: "Use this secure link to confirm the requested email address change.",
    cta: "Confirm email change",
  },
};

function jsonResponse(status: number, body: Record<string, never> | { error: string }) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function isEmail(value: unknown): value is string {
  return typeof value === "string" && value.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function safeNext(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return "/app/identity";
  }

  try {
    const url = new URL(value, "https://setuvara.com");
    if (url.origin !== "https://setuvara.com") return "/app/identity";
    return `${url.pathname}${url.search}`;
  } catch {
    return "/app/identity";
  }
}

function allowedOrigin(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return ALLOWED_ORIGINS.has(url.origin) ? url.origin : null;
  } catch {
    return null;
  }
}

function confirmationUrl(
  emailData: NonNullable<HookPayload["email_data"]>,
  tokenHash: string,
  type: string,
): string | null {
  if (!tokenHash || tokenHash.length > 512 || !/^[a-zA-Z0-9_-]+$/.test(tokenHash)) return null;

  const origin = allowedOrigin(emailData.redirect_to) ?? allowedOrigin(emailData.site_url) ?? "https://setuvara.com";
  const source = (() => {
    try {
      return new URL(emailData.redirect_to ?? "");
    } catch {
      return null;
    }
  })();
  const next = safeNext(source?.searchParams.get("next") ?? null);
  const result = new URL("/auth/confirm", origin);
  result.searchParams.set("next", next);
  result.searchParams.set("token_hash", tokenHash);
  result.searchParams.set("type", type);
  return result.toString();
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]!);
}

function emailHtml(content: (typeof EMAIL_CONTENT)[string], url: string): string {
  const safeUrl = escapeHtml(url);
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(content.subject)}</title></head>
<body style="margin:0;background:#F5F4EF;color:#0D0D0D;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#F5F4EF;padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;background:#ffffff;border-radius:16px;">
        <tr><td style="padding:40px 36px 12px;font-size:14px;font-weight:700;letter-spacing:3px;color:#0D0D0D;">SETUVARA</td></tr>
        <tr><td style="padding:20px 36px 8px;font-size:11px;font-weight:700;letter-spacing:1.8px;color:#FF5A4F;">${escapeHtml(content.label)}</td></tr>
        <tr><td style="padding:0 36px 12px;font-size:30px;line-height:1.2;font-weight:700;color:#0D0D0D;">${escapeHtml(content.headline)}</td></tr>
        <tr><td style="padding:0 36px 28px;font-size:16px;line-height:1.6;color:#454545;">${escapeHtml(content.copy)}</td></tr>
        <tr><td align="left" style="padding:0 36px 36px;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td bgcolor="#FF5A4F" style="border-radius:8px;">
            <a href="${safeUrl}" style="display:inline-block;padding:15px 22px;color:#0D0D0D;text-decoration:none;font-size:15px;font-weight:700;">${escapeHtml(content.cta)}</a>
          </td></tr></table>
        </td></tr>
        <tr><td style="padding:22px 36px 32px;border-top:1px solid #eeeeea;font-size:13px;line-height:1.6;color:#666666;">Setuvara<br>Your identity. Your connections.</td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

async function sendEmail(to: string, subject: string, html: string, text: string): Promise<boolean> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) return false;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Setuvara <noreply@setuvara.com>",
      to: [to],
      subject,
      html,
      text,
    }),
  });

  if (!response.ok) return false;

  const result = await response.json().catch(() => null) as { id?: unknown } | null;
  if (typeof result?.id === "string") {
    console.info("Setuvara auth email accepted by Resend", { messageId: result.id });
  } else {
    console.info("Setuvara auth email accepted by Resend");
  }
  return true;
}

async function sendActionEmail(
  to: string,
  action: string,
  emailData: NonNullable<HookPayload["email_data"]>,
  tokenHash: string,
  type: string,
): Promise<boolean> {
  const content = EMAIL_CONTENT[action];
  const url = confirmationUrl(emailData, tokenHash, type);
  if (!content || !url) return false;

  return sendEmail(
    to,
    content.subject,
    emailHtml(content, url),
    `${content.headline}\n\n${content.copy}\n\n${content.cta}: ${url}\n\nSetuvara — Your identity. Your connections.`,
  );
}

async function sendNotice(to: string, action: string, code?: string): Promise<boolean> {
  const isReauthentication = action === "reauthentication";
  const subject = isReauthentication ? "Your Setuvara verification code" : "A Setuvara account update";
  const message = isReauthentication
    ? "Use this code to verify your Setuvara account."
    : "There has been an update to your Setuvara account. If you did not expect this message, contact Setuvara support.";
  const safeCode = code && /^[0-9]{6}$/.test(code) ? escapeHtml(code) : null;
  if (isReauthentication && !safeCode) return false;
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#F5F4EF;color:#0D0D0D;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#F5F4EF;padding:32px 12px;"><tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;background:#fff;border-radius:16px;">
<tr><td style="padding:40px 36px 20px;font-size:14px;font-weight:700;letter-spacing:3px;">SETUVARA</td></tr>
<tr><td style="padding:0 36px 20px;font-size:16px;line-height:1.6;color:#454545;">${escapeHtml(message)}</td></tr>
${safeCode ? `<tr><td style="padding:0 36px 32px;font-size:28px;font-weight:700;letter-spacing:6px;color:#0D0D0D;">${safeCode}</td></tr>` : ""}
<tr><td style="padding:22px 36px 32px;border-top:1px solid #eeeeea;font-size:13px;line-height:1.6;color:#666;">Setuvara<br>Your identity. Your connections.</td></tr>
</table></td></tr></table></body></html>`;
  return sendEmail(
    to,
    subject,
    html,
    `${message}${safeCode ? `\n\n${safeCode}` : ""}\n\nSetuvara — Your identity. Your connections.`,
  );
}

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") {
    return new Response(null, { status: 405, headers: { Allow: "POST" } });
  }

  const rawBody = await request.text();
  const configuredSecret = Deno.env.get("SEND_EMAIL_HOOK_SECRET");
  if (!configuredSecret) return jsonResponse(500, { error: "Email delivery is not configured." });

  let payload: HookPayload;
  try {
    const secret = configuredSecret.replace(/^v1,whsec_/, "");
    const webhook = new Webhook(secret);
    payload = webhook.verify(rawBody, Object.fromEntries(request.headers)) as HookPayload;
  } catch {
    return jsonResponse(401, { error: "Invalid webhook signature." });
  }

  const emailData = payload.email_data;
  const action = emailData?.email_action_type;
  if (!emailData || !action) return jsonResponse(400, { error: "Invalid email event." });
  console.info("Setuvara Send Email Hook signature verified", { action });

  try {
    if (action === "email_change") {
      const currentEmail = payload.user?.email;
      const newEmail = payload.user?.new_email;
      if (!isEmail(newEmail)) return jsonResponse(400, { error: "Invalid email change event." });

      const hasBothPairs = Boolean(emailData.token_hash && emailData.token_hash_new);
      if (hasBothPairs) {
        if (!isEmail(currentEmail)) return jsonResponse(400, { error: "Invalid email change event." });
        // Supabase's documented secure-email-change mapping is intentionally counterintuitive:
        // token_hash_new belongs to the current email; token_hash belongs to the new email.
        const currentSent = await sendActionEmail(currentEmail, action, emailData, emailData.token_hash_new!, "email_change");
        const newSent = await sendActionEmail(newEmail, action, emailData, emailData.token_hash!, "email_change");
        return currentSent && newSent
          ? jsonResponse(200, {})
          : jsonResponse(502, { error: "Email delivery failed." });
      }

      const singleHash = emailData.token_hash;
      if (!singleHash) return jsonResponse(400, { error: "Invalid email change event." });
      const sent = await sendActionEmail(newEmail, action, emailData, singleHash, "email_change");
      return sent ? jsonResponse(200, {}) : jsonResponse(502, { error: "Email delivery failed." });
    }

    const email = payload.user?.email;
    if (!isEmail(email)) return jsonResponse(400, { error: "Invalid email event." });

    const confirmationType = ACTION_TYPES[action];
    if (confirmationType) {
      const tokenHash = emailData.token_hash;
      if (!tokenHash) return jsonResponse(400, { error: "Invalid email event." });
      const sent = await sendActionEmail(email, action, emailData, tokenHash, confirmationType);
      return sent ? jsonResponse(200, {}) : jsonResponse(502, { error: "Email delivery failed." });
    }

    if (action.endsWith("_notification") || action === "reauthentication") {
      const sent = await sendNotice(email, action, emailData.token);
      return sent ? jsonResponse(200, {}) : jsonResponse(502, { error: "Email delivery failed." });
    }

    return jsonResponse(400, { error: "Unsupported email event." });
  } catch {
    return jsonResponse(502, { error: "Email delivery failed." });
  }
});
