import { z } from "zod";

import { createActionsServiceClient } from "@/lib/actions/server";
import { TOKEN } from "@/lib/business/testimonials";
import { clientIp, createRateLimit, sameOrigin } from "@/lib/marketing/inquiry-mail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const limit = createRateLimit({ windowMs: 10 * 60 * 1000, perIp: 6, perWindow: 300 });
const body = z.object({
  token: z.string().regex(TOKEN),
  name: z.string().max(80),
  role: z.string().max(80).default(""),
  company: z.string().max(100).default(""),
  body: z.string().max(600),
  rating: z.number().int().min(1).max(5).nullable().default(null),
  consent: z.literal(true),
});
const REFUSALS: Record<string, [number, string]> = {
  request_unavailable: [410, "This link has been used or has ended."],
  consent_required: [400, "Agree to be shown, or close this page."],
  name_required: [400, "Add your name as it should appear."],
  body_length: [400, "Write between 20 and 600 characters."],
};

/** A client's testimonial through a private link. One narrow database function checks it all again. */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "This request could not be verified." }, { status: 403 });
  let raw: unknown;
  try { raw = await request.json(); } catch { return Response.json({ error: "The form could not be read." }, { status: 400 }); }
  const parsed = body.safeParse(raw);
  if (!parsed.success) return Response.json({ error: "Check the form and try again." }, { status: 400 });
  const ip = clientIp(request);
  if (!limit.allowed(ip)) return Response.json({ error: "Try again in a few minutes." }, { status: 429 });
  limit.record(ip);
  let service;
  try { service = createActionsServiceClient(); } catch { return Response.json({ error: "This is offline right now." }, { status: 503 }); }
  const input = parsed.data;
  const { error } = await service.rpc("submit_testimonial", {
    p_token: input.token, p_name: input.name, p_role: input.role, p_company: input.company, p_body: input.body, p_rating: input.rating, p_consent: input.consent,
  });
  if (error) {
    const refusal = Object.entries(REFUSALS).find(([key]) => error.message?.includes(key))?.[1];
    if (refusal) return Response.json({ error: refusal[1] }, { status: refusal[0] });
    console.error("Testimonial failed", { code: error.code });
    return Response.json({ error: "That didn't send. Try again." }, { status: 500 });
  }
  return Response.json({ ok: true }, { status: 201 });
}
