import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { escapeHtml, oneLine } from "@/lib/marketing/inquiry-mail";
import { newDownloadToken } from "./server";

const SENDER = "Setuvara <noreply@setuvara.com>";

export type DeliveryResult = "delivered" | "unconfigured" | "failed" | "not_deliverable";

/**
 * Sends a buyer their download link. Each call mints a new link (the old ones keep
 * working until they expire), so a failed or lost email can always be retried.
 * Only orders the database already holds as paid can get a link.
 */
export async function deliverOrder(service: SupabaseClient, orderId: string, origin: string): Promise<DeliveryResult> {
  const { token, hash } = newDownloadToken();
  const { data, error } = await service.rpc("commerce_issue_download", { p_order_id: orderId, p_token_hash: hash });
  if (error) return "not_deliverable";
  const link = data as { expires_at: string | null; max_downloads: number; buyer_email: string | null; offer_title: string; delivery_note: string; creator_user_id: string };
  if (!link.buyer_email) return "not_deliverable";
  const { data: creator } = await service.from("profiles").select("display_name").eq("id", link.creator_user_id).maybeSingle();
  const sent = await sendDeliveryEmail({
    to: link.buyer_email,
    title: link.offer_title,
    creatorName: creator?.display_name ?? "a Setuvara creator",
    url: `${origin}/d/${token}`,
    expiresAt: link.expires_at,
    maxDownloads: link.max_downloads,
    note: link.delivery_note,
  });
  await service.rpc("commerce_mark_delivery", { p_order_id: orderId, p_delivered: sent === "sent" });
  return sent === "sent" ? "delivered" : sent;
}

/** A fresh link for the buyer's own success page, without email. */
export async function issueLink(service: SupabaseClient, orderId: string) {
  const { token, hash } = newDownloadToken();
  const { error } = await service.rpc("commerce_issue_download", { p_order_id: orderId, p_token_hash: hash });
  return error ? null : token;
}

async function sendDeliveryEmail({ to, title, creatorName, url, expiresAt, maxDownloads, note }: { to: string; title: string; creatorName: string; url: string; expiresAt: string | null; maxDownloads: number; note: string }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return "unconfigured" as const;
  const until = expiresAt ? new Date(expiresAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : null;
  const terms = `${until ? `The link works until ${until}` : "The link keeps working"} and allows ${maxDownloads} downloads.`;
  const subject = oneLine(`Your download: ${title}`);
  const text = `Thanks for getting "${title}" from ${creatorName}.\n\nDownload it here:\n${url}\n\n${terms}${note ? `\n\nFrom ${creatorName}:\n${note}` : ""}\n\nKeep this email; the link is how you get your files again. Questions about the product go to ${creatorName}, the seller.`;
  const html = `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#0d0d0d;font-size:15px;line-height:1.5;max-width:480px"><p style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#a43d36;margin:0 0 12px">Your download</p><p style="font-size:22px;font-weight:700;margin:0 0 8px">${escapeHtml(title)}</p><p style="margin:0 0 20px;color:#4a4a4a">from ${escapeHtml(creatorName)}</p><p><a href="${escapeHtml(url)}" style="display:inline-block;background:#0d0d0d;color:#f5f4ef;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:600">Open your files</a></p><p style="color:#6b6b6b;margin-top:20px">${escapeHtml(terms)}</p>${note ? `<p style="margin-top:20px;padding:14px 16px;background:#f5f4ef;border-radius:14px;white-space:pre-line">${escapeHtml(note)}</p>` : ""}<p style="color:#6b6b6b;margin-top:20px;font-size:13px">Keep this email; the link is how you get your files again. ${escapeHtml(creatorName)} is the seller.</p></div>`;
  const result = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: SENDER, to: [to], subject, text, html }),
  }).catch(() => null);
  if (result?.ok) return "sent" as const;
  console.error("Commerce delivery email failed", { status: result?.status ?? "network" });
  return "failed" as const;
}
