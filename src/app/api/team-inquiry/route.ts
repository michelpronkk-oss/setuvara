import { teamInquirySchema, type TeamInquiry } from "@/lib/marketing/team-inquiry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SENDER = "Setuvara <noreply@setuvara.com>";
const MIN_FILL_MS = 2500;
const WINDOW_MS = 10 * 60 * 1000;
const PER_IP = 3;
const PER_WINDOW = 30;

// Best-effort limits per server instance; the honeypot and fill-time check catch most bots first.
const recent = new Map<string, number[]>();
let all: number[] = [];

/**
 * "Tell us about your team" on /teams. Sends one plain email to hello@setuvara.com through
 * Resend, with the sender's address as Reply-To. Nothing is stored.
 */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "This request could not be verified." }, { status: 403 });

  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "The form could not be read." }, { status: 400 }); }
  const parsed = teamInquirySchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Add your name, a work email, your company and team size." }, { status: 400 });
  const inquiry = parsed.data;

  // Bots get a quiet success so they don't learn what tripped them.
  if (inquiry.website || Date.now() - inquiry.openedAt < MIN_FILL_MS) return Response.json({ ok: true }, { status: 202 });

  const now = Date.now();
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  const mine = (recent.get(ip) ?? []).filter((at) => now - at < WINDOW_MS);
  all = all.filter((at) => now - at < WINDOW_MS);
  if (mine.length >= PER_IP || all.length >= PER_WINDOW) return Response.json({ error: "Thanks, we have your note. Try again in a few minutes, or email hello@setuvara.com." }, { status: 429 });

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return Response.json({ error: "The form isn’t connected yet. Email hello@setuvara.com and we’ll reply." }, { status: 503 });

  const result = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: SENDER,
      to: [process.env.TEAM_INQUIRY_TO || "hello@setuvara.com"],
      reply_to: inquiry.email,
      subject: oneLine(`Teams: ${inquiry.company} (${inquiry.size})`),
      text: text(inquiry),
      html: html(inquiry),
    }),
  }).catch(() => null);

  if (!result?.ok) {
    console.error("Team inquiry email failed", { status: result?.status ?? "network" });
    return Response.json({ error: "That didn’t send. Try again, or email hello@setuvara.com." }, { status: 502 });
  }
  mine.push(now);
  recent.set(ip, mine);
  all.push(now);
  return Response.json({ ok: true }, { status: 201 });
}

const oneLine = (value: string) => value.replace(/[\r\n]+/g, " ").slice(0, 180);

function rows(inquiry: TeamInquiry): [string, string][] {
  return [["Name", inquiry.name], ["Email", inquiry.email], ["Company", inquiry.company], ["Team size", inquiry.size], ["Needs", inquiry.message || "—"]];
}

function text(inquiry: TeamInquiry) {
  return `New Setuvara for Teams inquiry\n\n${rows(inquiry).map(([label, value]) => `${label}: ${value}`).join("\n")}\n\nReply to this email to answer ${inquiry.name}.`;
}

function escape(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
}

function html(inquiry: TeamInquiry) {
  const body = rows(inquiry).map(([label, value]) => `<tr><td style="padding:8px 16px 8px 0;color:#6b6b6b;vertical-align:top;white-space:nowrap">${label}</td><td style="padding:8px 0;white-space:pre-wrap">${escape(value)}</td></tr>`).join("");
  return `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#0d0d0d;font-size:15px;line-height:1.5"><p style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#a43d36;margin:0 0 12px">Setuvara for Teams</p><table style="border-collapse:collapse">${body}</table><p style="color:#6b6b6b;margin-top:20px">Reply to this email to answer ${escape(inquiry.name)}.</p></div>`;
}

function sameOrigin(request: Request) {
  if (request.headers.get("x-setuvara-request") !== "same-origin") return false;
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin") return false;
  const origin = request.headers.get("origin");
  if (!origin) return true;
  const host = request.headers.get("x-forwarded-host")?.split(",")[0].trim() ?? request.headers.get("host");
  const protocol = request.headers.get("x-forwarded-proto")?.split(",")[0].trim() ?? new URL(request.url).protocol.replace(":", "");
  try { return new URL(origin).origin === (host ? `${protocol}://${host}` : new URL(request.url).origin); } catch { return false; }
}
