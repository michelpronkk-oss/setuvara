import { teamInquirySchema, type TeamInquiry } from "@/lib/marketing/team-inquiry";
import { clientIp, contactInbox, createRateLimit, inquiryBodies, sameOrigin, sendInquiryEmail } from "@/lib/marketing/inquiry-mail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MIN_FILL_MS = 2500;
const limit = createRateLimit({ windowMs: 10 * 60 * 1000, perIp: 3, perWindow: 30 });

/**
 * "Tell us about your team" on /teams. Sends one plain email to TEAM_INQUIRY_TO, else CONTACT_INBOX
 * (hello@setuvara.com by default), through Resend, with the sender's address as Reply-To. Nothing is stored.
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

  const ip = clientIp(request);
  if (!limit.allowed(ip)) return Response.json({ error: "Thanks, we have your note. Try again in a few minutes, or email hello@setuvara.com." }, { status: 429 });

  const result = await sendInquiryEmail({
    tag: "Team inquiry",
    to: process.env.TEAM_INQUIRY_TO?.trim() || contactInbox(),
    replyTo: inquiry.email,
    subject: `Teams: ${inquiry.company} (${inquiry.size})`,
    ...inquiryBodies({ kicker: "Setuvara for Teams", name: inquiry.name, rows: rows(inquiry) }),
  });

  if (result === "unconfigured") return Response.json({ error: "The form isn’t connected yet. Email hello@setuvara.com and we’ll reply." }, { status: 503 });
  if (result === "failed") return Response.json({ error: "That didn’t send. Try again, or email hello@setuvara.com." }, { status: 502 });
  limit.record(ip);
  return Response.json({ ok: true }, { status: 201 });
}

function rows(inquiry: TeamInquiry): [string, string][] {
  return [["Name", inquiry.name], ["Email", inquiry.email], ["Company", inquiry.company], ["Team size", inquiry.size], ["Needs", inquiry.message || "—"]];
}
