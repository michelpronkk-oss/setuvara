import "server-only";

import { createActionsServiceClient } from "@/lib/actions/server";
import { escapeHtml, oneLine } from "@/lib/marketing/inquiry-mail";
import { workspaceHref } from "./team";

const SENDER = "Setuvara <noreply@setuvara.com>";

type Alert = { email: string; lead_id: string; lead_name: string; business_id: string; business_name: string };

/**
 * Emails a teammate that a lead is now theirs. The database hands over the address only for a fresh
 * assignment to someone who can still see the lead, and marks it sent, so this runs at most once per
 * assignment. Failures are logged and never block the step that caused them.
 */
export async function alertAssignee(origin: string, target: { leadId: string } | { submissionId: string }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return "unconfigured" as const;
  let service;
  try { service = createActionsServiceClient(); } catch { return "unconfigured" as const; }
  const { data, error } = await service.rpc("business_assignment_alert", "leadId" in target ? { p_lead_id: target.leadId } : { p_submission_id: target.submissionId });
  const alert = data as Alert | null;
  if (error || !alert) return "none" as const;
  const url = `${origin}${workspaceHref(alert.business_id)}`;
  const subject = oneLine(`New lead for you: ${alert.lead_name} · ${alert.business_name}`);
  const text = `${alert.business_name} assigned you a lead on Setuvara: ${alert.lead_name}.\n\nOpen the leads:\n${url}\n\nYou get this because you're on ${alert.business_name}'s team.`;
  const html = `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#0d0d0d;font-size:15px;line-height:1.5;max-width:480px"><p style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#3d5f99;margin:0 0 12px">${escapeHtml(alert.business_name)} · Lead</p><p style="font-size:22px;font-weight:700;margin:0 0 8px">${escapeHtml(alert.lead_name)} is yours.</p><p style="margin:0 0 20px;color:#4a4a4a">${escapeHtml(alert.business_name)} assigned you a new lead.</p><p><a href="${escapeHtml(url)}" style="display:inline-block;background:#0d0d0d;color:#f5f4ef;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:600">Open the leads</a></p><p style="color:#6b6b6b;margin-top:20px">You get this because you're on ${escapeHtml(alert.business_name)}'s team on Setuvara.</p></div>`;
  const result = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: SENDER, to: [alert.email], subject, text, html }),
  }).catch(() => null);
  if (result?.ok) return "sent" as const;
  console.error("Lead assignment email failed", { status: result?.status ?? "network" });
  return "failed" as const;
}
