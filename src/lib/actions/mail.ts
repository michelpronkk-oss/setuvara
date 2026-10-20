import "server-only";

import { escapeHtml, oneLine } from "@/lib/marketing/inquiry-mail";

const SENDER = "Setuvara <noreply@setuvara.com>";

/** The giveaway confirmation email. The link opens a page with a button, so mail scanners can't confirm for people. */
export async function sendEntryConfirmation({ to, title, creatorName, confirmUrl }: { to: string; title: string; creatorName: string; confirmUrl: string }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return "unconfigured" as const;
  const subject = oneLine(`Confirm your entry: ${title}`);
  const text = `You entered "${title}" by ${creatorName} on Setuvara.\n\nConfirm your entry within 48 hours:\n${confirmUrl}\n\nIf this wasn't you, ignore this email and nothing happens.`;
  const html = `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#0d0d0d;font-size:15px;line-height:1.5;max-width:480px"><p style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#a43d36;margin:0 0 12px">Setuvara giveaway</p><p style="font-size:22px;font-weight:700;margin:0 0 8px">${escapeHtml(title)}</p><p style="margin:0 0 20px;color:#4a4a4a">by ${escapeHtml(creatorName)}</p><p><a href="${escapeHtml(confirmUrl)}" style="display:inline-block;background:#0d0d0d;color:#f5f4ef;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:600">Confirm my entry</a></p><p style="color:#6b6b6b;margin-top:20px">The link works for 48 hours. If this wasn't you, ignore this email and nothing happens.</p></div>`;
  const result = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: SENDER, to: [to], subject, text, html }),
  }).catch(() => null);
  if (result?.ok) return "sent" as const;
  console.error("Giveaway confirmation email failed", { status: result?.status ?? "network" });
  return "failed" as const;
}
