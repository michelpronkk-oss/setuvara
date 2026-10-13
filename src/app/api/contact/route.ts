import { COMPANY_TYPES, CONTACT_EMAIL, contactFieldErrors, contactSchema, inquiryLabel, type ContactInquiry } from "@/lib/marketing/contact";
import { clientIp, contactInbox, createRateLimit, inquiryBodies, sameOrigin, sendInquiryEmail } from "@/lib/marketing/inquiry-mail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MIN_FILL_MS = 2500;
const limit = createRateLimit({ windowMs: 10 * 60 * 1000, perIp: 3, perWindow: 30 });

/**
 * The /contact form. Sends one plain email to CONTACT_INBOX (hello@setuvara.com by default)
 * through Resend, with the sender's address as Reply-To. Nothing is stored.
 */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "This request could not be verified." }, { status: 403 });

  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "The form could not be read." }, { status: 400 }); }
  const parsed = contactSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Check the highlighted fields.", fields: contactFieldErrors(body) }, { status: 400 });
  const inquiry = parsed.data;

  // Bots get a quiet success so they don't learn what tripped them.
  if (inquiry.website || Date.now() - inquiry.openedAt < MIN_FILL_MS) return Response.json({ ok: true }, { status: 202 });

  const ip = clientIp(request);
  if (!limit.allowed(ip)) return Response.json({ error: `We already have a few messages from you. Try again in a few minutes, or email ${CONTACT_EMAIL}.` }, { status: 429 });

  const company = COMPANY_TYPES.includes(inquiry.type) ? inquiry.company : "";
  const label = inquiryLabel(inquiry.type);
  const result = await sendInquiryEmail({
    tag: "Contact",
    to: contactInbox(),
    replyTo: inquiry.email,
    subject: `${label}: ${inquiry.name}${company ? ` (${company})` : ""}`,
    ...inquiryBodies({ kicker: `Setuvara contact · ${label}`, name: inquiry.name, rows: rows(inquiry, company) }),
  });

  if (result === "unconfigured") return Response.json({ error: `The form isn’t connected yet. Email ${CONTACT_EMAIL} and we’ll reply.` }, { status: 503 });
  if (result === "failed") return Response.json({ error: `That didn’t send. Try again, or email ${CONTACT_EMAIL}.` }, { status: 502 });
  limit.record(ip);
  return Response.json({ ok: true }, { status: 201 });
}

function rows(inquiry: ContactInquiry, company: string): [string, string][] {
  return [
    ["Topic", inquiryLabel(inquiry.type)],
    ["Name", inquiry.name],
    ["Email", inquiry.email],
    ...(company ? [["Company", company] as [string, string]] : []),
    ["Message", inquiry.message],
  ];
}
