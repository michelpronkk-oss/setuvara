import "server-only";

import { escapeHtml, oneLine } from "@/lib/marketing/inquiry-mail";
import { campaignParagraphs } from "./model";

const FROM_ADDRESS = "noreply@setuvara.com";
const LINK = /\bhttps:\/\/[^\s<>"']+[^\s<>"'.,;:!?)]/g;

export type CampaignEmail = { from: string; to: string[]; subject: string; html: string; text: string; reply_to?: string; headers: Record<string, string> };

/** A display name that can't break out of the From header. */
export function senderName(name: string) {
  const clean = name.replace(/[\r\n"<>\\@]/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);
  return clean ? `${clean} via Setuvara` : "Setuvara";
}

function linkify(paragraph: string) {
  let html = "";
  let last = 0;
  for (const match of paragraph.matchAll(LINK)) {
    html += escapeHtml(paragraph.slice(last, match.index));
    html += `<a href="${escapeHtml(match[0])}" style="color:#0d0d0d;text-decoration:underline">${escapeHtml(match[0])}</a>`;
    last = match.index! + match[0].length;
  }
  return (html + escapeHtml(paragraph.slice(last))).replace(/\n/g, "<br>");
}

/**
 * One campaign email. The owner's words go in as text (escaped, paragraphs and https links only),
 * framed by who sent it, why the reader gets it, and a one-press unsubscribe.
 */
export function renderCampaignEmail({ to, senderDisplay, subject, preheader, body, replyTo, lists, unsubscribeUrl, test = false }: {
  to: string; senderDisplay: string; subject: string; preheader: string; body: string; replyTo: string | null; lists: string[]; unsubscribeUrl: string; test?: boolean;
}): CampaignEmail {
  const paragraphs = campaignParagraphs(body);
  const listLine = lists.length ? lists.join(", ") : "a newsletter";
  const why = `You get this because you subscribed to ${listLine} by ${senderDisplay} on Setuvara.`;
  const text = `${test ? "[Test] " : ""}${paragraphs.join("\n\n")}\n\n--\n${why}\nUnsubscribe: ${unsubscribeUrl}`;
  const html = `<!doctype html><html><body style="margin:0;background:#f5f4ef"><div style="display:none;max-height:0;overflow:hidden">${escapeHtml(preheader)}</div><div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#0d0d0d;font-size:16px;line-height:1.6;max-width:560px;margin:0 auto;padding:32px 20px"><p style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#6b6b6b;margin:0 0 18px">${test ? "Test · " : ""}${escapeHtml(senderDisplay)}</p><div style="background:#ffffff;border-radius:20px;padding:28px 24px">${paragraphs.map((part) => `<p style="margin:0 0 16px">${linkify(part)}</p>`).join("")}</div><p style="color:#6b6b6b;font-size:13px;line-height:1.5;margin:20px 4px 0">${escapeHtml(why)}<br><a href="${escapeHtml(unsubscribeUrl)}" style="color:#6b6b6b;text-decoration:underline">Unsubscribe</a></p></div></body></html>`;
  return {
    from: `${senderName(senderDisplay)} <${FROM_ADDRESS}>`,
    to: [to],
    subject: oneLine(`${test ? "[Test] " : ""}${subject}`),
    html,
    text,
    ...(replyTo ? { reply_to: replyTo } : {}),
    headers: { "List-Unsubscribe": `<${unsubscribeUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
  };
}

export type BatchResult = { ok: true; ids: string[] } | { ok: false; retry: boolean; error: string };

/**
 * Up to 100 emails in one Resend call. The idempotency key is the batch's own, so a retried batch
 * that already went out is not sent again.
 */
export async function sendCampaignBatch(emails: CampaignEmail[], idempotencyKey: string): Promise<BatchResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, retry: true, error: "unconfigured" };
  const response = await fetch("https://api.resend.com/emails/batch", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
    body: JSON.stringify(emails),
    signal: AbortSignal.timeout(20_000),
  }).catch(() => null);
  if (!response) return { ok: false, retry: true, error: "network" };
  if (response.ok) {
    const body = await response.json().catch(() => null) as { data?: { id?: string }[] } | null;
    return { ok: true, ids: (body?.data ?? []).map((item) => item.id ?? "") };
  }
  // Rate limits and provider trouble are worth another try; a rejected payload is not.
  const retry = response.status === 429 || response.status >= 500 || response.status === 409;
  return { ok: false, retry, error: `resend_${response.status}` };
}
