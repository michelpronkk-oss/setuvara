/**
 * Business Mode testimonials: invited, written by the client, public only once approved. The
 * database (20261025100000_business_testimonials.sql) holds every rule; this mirrors its shapes and
 * limits for forms and pages. Pure, so tests use it directly.
 */

export type TestimonialStatus = "pending" | "approved" | "hidden";
export type Testimonial = {
  id: string; lead_id: string | null; author_name: string; author_role: string; author_company: string;
  body: string; rating: number | null; verified: boolean; status: TestimonialStatus; approved_at: string | null; created_at: string;
};
export const TESTIMONIAL_COLUMNS = "id, lead_id, author_name, author_role, author_company, body, rating, verified, status, approved_at, created_at";
export type PublicTestimonial = Pick<Testimonial, "id" | "author_name" | "author_role" | "author_company" | "body" | "rating" | "verified">;

export type TestimonialRequest = { id: string; lead_id: string | null; name: string; expires_at: string; used_at: string | null; revoked_at: string | null; created_at: string };
export const REQUEST_COLUMNS = "id, lead_id, name, expires_at, used_at, revoked_at, created_at";

export const BODY_MIN = 20;
export const BODY_MAX = 600;
export const TOKEN = /^[A-Za-z0-9_-]{32}$/;

/** The invite page for a token. */
export const testimonialPath = (token: string) => `/s/testimonial/${token}`;

/** A request is open while it is unused, not revoked and not expired. */
export function requestState(request: TestimonialRequest, now = Date.now()): "open" | "used" | "revoked" | "expired" {
  if (request.used_at) return "used";
  if (request.revoked_at) return "revoked";
  return new Date(request.expires_at).getTime() > now ? "open" : "expired";
}

/** What a client still has to fix before sending, in the order the form shows it. */
export function testimonialProblems(input: { body: string; name: string; consent: boolean; role?: string; company?: string }) {
  const problems: Record<string, string> = {};
  const body = input.body.trim();
  if (body.length < BODY_MIN) problems.body = `A sentence or two, at least ${BODY_MIN} characters.`;
  else if (body.length > BODY_MAX) problems.body = `Keep it under ${BODY_MAX} characters.`;
  if (!input.name.trim()) problems.name = "Add your name as it should appear.";
  else if (input.name.trim().length > 80) problems.name = "Keep your name under 80 characters.";
  if ((input.role ?? "").trim().length > 80) problems.role = "Keep it under 80 characters.";
  if ((input.company ?? "").trim().length > 100) problems.company = "Keep it under 100 characters.";
  if (!input.consent) problems.consent = "Agree to be shown, or close this page.";
  return problems;
}

/** "Founder, Vos & Co", or whichever half is there. */
export const byline = (item: Pick<PublicTestimonial, "author_role" | "author_company">) => [item.author_role, item.author_company].map((part) => part.trim()).filter(Boolean).join(", ");

/** A prefilled email the owner can send with the link. */
export function inviteMail({ to, name, owner, url }: { to: string | null; name: string; owner: string; url: string }) {
  const first = name.trim().split(/\s+/)[0] ?? "";
  const subject = `A quick favour from ${owner}`;
  const body = `${first ? `Hi ${first},` : "Hi,"}\n\nWould you write a few words about working with me? It takes a minute, and I'll only show it once I've read it.\n\n${url}\n\nThank you,\n${owner}`;
  return `mailto:${to ? encodeURIComponent(to) : ""}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
