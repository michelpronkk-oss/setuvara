import "server-only";

import { escapeHtml, oneLine } from "@/lib/marketing/inquiry-mail";
import { eventPlace, eventWhen, type EventRecord } from "./model";

const SENDER = "Setuvara <noreply@setuvara.com>";

export type GuestEmailKind = "confirmed" | "waitlisted" | "promoted" | "reminder_link";
type EmailEvent = Pick<EventRecord, "title" | "starts_at" | "ends_at" | "timezone" | "venue_name" | "address" | "city" | "online_url">;

const COPY: Record<GuestEmailKind, { kicker: string; subject: (title: string) => string; lead: string }> = {
  confirmed: { kicker: "You're going", subject: (title) => `You're going: ${title}`, lead: "Your spot is saved." },
  waitlisted: { kicker: "On the waitlist", subject: (title) => `Waitlist: ${title}`, lead: "The event is full right now. If a spot opens, it's yours in the order people joined, and we'll email you." },
  promoted: { kicker: "A spot opened", subject: (title) => `You're in: ${title}`, lead: "A spot opened up and it's yours now." },
  reminder_link: { kicker: "Your registration", subject: (title) => `Your registration: ${title}`, lead: "You're already on the list for this event. Here is your link again." },
};

/**
 * A guest's transactional email: what happened, when and where (in the event's own time zone), and
 * the private link to manage it. It carries no marketing and needs no consent; follow-ups do.
 */
export function renderGuestEmail({ kind, event, organizer, manageUrl, eventUrl }: { kind: GuestEmailKind; event: EmailEvent; organizer: string; manageUrl: string; eventUrl: string }) {
  const copy = COPY[kind];
  const when = eventWhen(event);
  const place = eventPlace(event);
  const where = [place.line, place.address].filter(Boolean).join(" · ");
  const subject = oneLine(copy.subject(event.title));
  const text = [
    `${copy.lead}`,
    "",
    `${event.title}, by ${organizer}`,
    `${when.date} ${when.year}, ${when.time}`,
    where,
    "",
    `Manage or cancel: ${manageUrl}`,
    `Event page: ${eventUrl}`,
    "",
    "You get this email because you registered on Setuvara. If this wasn't you, open the link and cancel.",
  ].filter((line, index, all) => line !== "" || all[index - 1] !== "").join("\n");
  const row = (label: string, value: string) => value ? `<tr><td style="padding:6px 16px 6px 0;color:#6b6b6b;font-size:12px;letter-spacing:.12em;text-transform:uppercase;vertical-align:top">${label}</td><td style="padding:6px 0;font-size:15px;font-weight:600">${escapeHtml(value)}</td></tr>` : "";
  const html = `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#0d0d0d;font-size:15px;line-height:1.5;max-width:480px"><p style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#a43d36;margin:0 0 12px">${copy.kicker}</p><p style="font-size:24px;font-weight:700;margin:0 0 4px">${escapeHtml(event.title)}</p><p style="margin:0 0 16px;color:#4a4a4a">by ${escapeHtml(organizer)}</p><p style="margin:0 0 16px">${escapeHtml(copy.lead)}</p><table style="border-collapse:collapse;margin:0 0 20px">${row("When", `${when.date} ${when.year}`)}${row("Time", when.time)}${row("Where", where)}</table><p><a href="${escapeHtml(manageUrl)}" style="display:inline-block;background:#0d0d0d;color:#f5f4ef;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:600">View my registration</a></p><p style="margin:12px 0 0"><a href="${escapeHtml(eventUrl)}" style="color:#0d0d0d">Event page</a></p><p style="color:#6b6b6b;margin-top:20px;font-size:13px">You get this email because you registered on Setuvara. Keep it: the link is your private way to manage or cancel. If this wasn't you, open it and cancel.</p></div>`;
  return { subject, text, html };
}

export async function sendGuestEmail(to: string, email: { subject: string; text: string; html: string }, idempotencyKey: string) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return "unconfigured" as const;
  const result = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
    body: JSON.stringify({ from: SENDER, to: [to], ...email }),
  }).catch(() => null);
  if (result?.ok) return "sent" as const;
  console.error("Event guest email failed", { status: result?.status ?? "network" });
  return "failed" as const;
}
