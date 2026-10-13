import "server-only";

import { CONTACT_EMAIL } from "./contact";

const SENDER = "Setuvara <noreply@setuvara.com>";

/** Where marketing forms deliver. CONTACT_INBOX overrides the public address; never exposed to the browser. */
export function contactInbox() {
  return process.env.CONTACT_INBOX?.trim() || CONTACT_EMAIL;
}

/**
 * Best-effort limits per server instance: a few sends per IP and a ceiling across everyone.
 * The honeypot and fill-time check catch most bots before this.
 */
export function createRateLimit({ windowMs, perIp, perWindow }: { windowMs: number; perIp: number; perWindow: number }) {
  const recent = new Map<string, number[]>();
  let all: number[] = [];
  return {
    allowed(ip: string) {
      const now = Date.now();
      const mine = (recent.get(ip) ?? []).filter((at) => now - at < windowMs);
      all = all.filter((at) => now - at < windowMs);
      if (mine.length) recent.set(ip, mine); else recent.delete(ip);
      return mine.length < perIp && all.length < perWindow;
    },
    record(ip: string) {
      const now = Date.now();
      recent.set(ip, [...(recent.get(ip) ?? []), now]);
      all.push(now);
    },
  };
}

export function clientIp(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
}

export type SendResult = "sent" | "unconfigured" | "failed";

/** One plain email through Resend with the visitor as Reply-To. Nothing is stored. */
export async function sendInquiryEmail({ to, replyTo, subject, text, html, tag }: { to: string; replyTo: string; subject: string; text: string; html: string; tag: string }): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return "unconfigured";
  const result = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: SENDER, to: [to], reply_to: replyTo, subject: oneLine(subject), text, html }),
  }).catch(() => null);
  if (result?.ok) return "sent";
  console.error(`${tag} email failed`, { status: result?.status ?? "network" });
  return "failed";
}

export const oneLine = (value: string) => value.replace(/[\r\n]+/g, " ").slice(0, 180);

export function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
}

/** The plain text and HTML body every inquiry email uses: a kicker, a label/value table, a reply hint. */
export function inquiryBodies({ kicker, rows, name }: { kicker: string; rows: [string, string][]; name: string }) {
  const text = `${kicker}\n\n${rows.map(([label, value]) => `${label}: ${value}`).join("\n")}\n\nReply to this email to answer ${name}.`;
  const body = rows.map(([label, value]) => `<tr><td style="padding:8px 16px 8px 0;color:#6b6b6b;vertical-align:top;white-space:nowrap">${label}</td><td style="padding:8px 0;white-space:pre-wrap">${escapeHtml(value)}</td></tr>`).join("");
  const html = `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#0d0d0d;font-size:15px;line-height:1.5"><p style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#a43d36;margin:0 0 12px">${escapeHtml(kicker)}</p><table style="border-collapse:collapse">${body}</table><p style="color:#6b6b6b;margin-top:20px">Reply to this email to answer ${escapeHtml(name)}.</p></div>`;
  return { text, html };
}

/** Marketing forms only accept same-site fetches carrying our header. */
export function sameOrigin(request: Request) {
  if (request.headers.get("x-setuvara-request") !== "same-origin") return false;
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin") return false;
  const origin = request.headers.get("origin");
  if (!origin) return true;
  const host = request.headers.get("x-forwarded-host")?.split(",")[0].trim() ?? request.headers.get("host");
  const protocol = request.headers.get("x-forwarded-proto")?.split(",")[0].trim() ?? new URL(request.url).protocol.replace(":", "");
  try { return new URL(origin).origin === (host ? `${protocol}://${host}` : new URL(request.url).origin); } catch { return false; }
}
