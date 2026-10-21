import { after } from "next/server";
import { z } from "zod";

import { creatorActionsEnabled, createActionsServiceClient, hashIp } from "@/lib/actions/server";
import { sendEntryConfirmation } from "@/lib/actions/mail";
import { getPublicOrigin } from "@/lib/app/viewer";
import { alertAssignee } from "@/lib/business/mail";
import { clientIp, createRateLimit, sameOrigin } from "@/lib/marketing/inquiry-mail";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MIN_FILL_MS = 2000;
/** Action kinds whose responses on Business Mode become leads (private.lead_from_submission). */
const LEAD_KINDS = ["collab", "booking", "submission", "form"];
const limit = createRateLimit({ windowMs: 10 * 60 * 1000, perIp: 8, perWindow: 400 });
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const body = z.object({
  name: z.string().max(80).default(""),
  email: z.string().max(254).default(""),
  answers: z.record(z.string().regex(/^[A-Za-z0-9]{1,20}$/), z.string().max(2000)).refine((value) => Object.keys(value).length <= 24).default({}),
  featureConsent: z.boolean().default(false),
  /** Giveaways: the entrant confirms the age limit and the rules. */
  acceptRules: z.boolean().default(false),
  idempotencyKey: z.string().regex(/^[A-Za-z0-9_-]{16,64}$/),
  openedAt: z.number().int().positive(),
  /** Smart Bookings: the open time the visitor picked. */
  startsAt: z.iso.datetime({ offset: true }).optional(),
  /** The spam trap: hidden from people, filled by bots. */
  hp: z.string().max(200).default(""),
});

const REFUSALS: Record<string, [number, string]> = {
  action_unavailable: [410, "This isn't taking submissions right now."],
  action_closed: [410, "This is closed."],
  rate_limited: [429, "You've sent a few already. Try again later."],
  email_required: [400, "Add your email."],
  invalid_email: [400, "Check your email address."],
  name_required: [400, "Add your name."],
  message_required: [400, "Add a few words."],
  answer_required: [400, "Answer the required questions."],
  own_action: [400, "This is your own page."],
  slot_taken: [409, "That time was just taken. Pick another one."],
};

/**
 * A visitor's submission to a published Action. The route checks origin, the spam trap, fill time and
 * per-IP limits, then hands the payload to one narrow database function that validates everything again.
 * Submissions never open a chat or create a Connection.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!creatorActionsEnabled()) return Response.json({ error: "This isn't open yet." }, { status: 404 });
  if (!sameOrigin(request)) return Response.json({ error: "This request could not be verified." }, { status: 403 });
  const { id } = await params;
  if (!uuid.test(id)) return Response.json({ error: "Not found." }, { status: 404 });

  let raw: unknown;
  try { raw = await request.json(); } catch { return Response.json({ error: "The form could not be read." }, { status: 400 }); }
  const parsed = body.safeParse(raw);
  if (!parsed.success) return Response.json({ error: "Check the form and try again." }, { status: 400 });
  const input = parsed.data;
  // Bots get a quiet success so they don't learn what tripped them.
  if (input.hp || Date.now() - input.openedAt < MIN_FILL_MS) return Response.json({ ok: true, status: "new" }, { status: 202 });

  const ip = clientIp(request);
  if (!limit.allowed(ip)) return Response.json({ error: REFUSALS.rate_limited[1] }, { status: 429 });
  limit.record(ip);

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const submitter = typeof claims?.claims?.sub === "string" ? claims.claims.sub : null;

  let service;
  try { service = createActionsServiceClient(); } catch { return Response.json({ error: "Submissions are offline right now." }, { status: 503 }); }
  const { data: kind } = await service.from("profile_actions").select("kind").eq("id", id).maybeSingle();
  if (kind?.kind === "giveaway" && !input.acceptRules) return Response.json({ error: "Confirm the age limit and the rules to enter." }, { status: 400 });
  // A picked time goes through request_booking, which checks it is still open and holds it with the request.
  const { data, error } = kind?.kind === "booking" && input.startsAt
    ? await service.rpc("request_booking", {
      p_action_id: id,
      p_submitter: submitter,
      p_name: input.name,
      p_email: input.email,
      p_answers: input.answers,
      p_idempotency_key: input.idempotencyKey,
      p_ip_hash: hashIp(ip),
      p_starts_at: input.startsAt,
    })
    : await service.rpc("submit_profile_action", {
      p_action_id: id,
      p_submitter: submitter,
      p_name: input.name,
      p_email: input.email,
      p_answers: input.answers,
      p_feature_consent: input.featureConsent,
      p_idempotency_key: input.idempotencyKey,
      p_ip_hash: hashIp(ip),
    });
  if (error) {
    const refusal = Object.entries(REFUSALS).find(([key]) => error.message?.includes(key))?.[1];
    if (refusal) return Response.json({ error: refusal[1] }, { status: refusal[0] });
    if (error.code === "22023") return Response.json({ error: "Check the form and try again." }, { status: 400 });
    console.error("Action submission failed", { code: error.code });
    return Response.json({ error: "That didn't send. Try again." }, { status: 500 });
  }

  const result = data as { id: string | null; status: string; duplicate: boolean; verify_token?: string | null };
  if (result.status !== "pending_verification") {
    // A Business inquiry routed to a teammate tells them, after the visitor has their answer.
    if (result.id && !result.duplicate && kind?.kind && LEAD_KINDS.includes(kind.kind)) {
      const origin = await getPublicOrigin(request.headers);
      after(() => alertAssignee(origin, { submissionId: result.id! }));
    }
    // The owner's thank-you heading and reward, only now that a real response exists.
    const { data: thanks } = await service.rpc("action_thanks_for", { p_action_id: id });
    return Response.json({ ok: true, status: result.status, thanks: thanks ?? null }, { status: 201 });
  }
  // A repeat entry gets the same answer as a first one, so the form can't reveal who entered.
  if (!result.verify_token) return Response.json({ ok: true, status: "pending_verification" }, { status: 202 });

  const { data: action } = await service.from("profile_actions").select("title, profile_id").eq("id", id).maybeSingle();
  const { data: creator } = action ? await service.from("profiles").select("display_name").eq("id", action.profile_id).maybeSingle() : { data: null };
  const origin = await getPublicOrigin(request.headers);
  const sent = await sendEntryConfirmation({
    kind: kind?.kind === "newsletter" ? "newsletter" : "giveaway",
    to: input.email.trim(),
    title: action?.title ?? (kind?.kind === "newsletter" ? "Newsletter" : "Giveaway"),
    creatorName: creator?.display_name ?? "a Setuvara member",
    confirmUrl: `${origin}/s/confirm?token=${result.verify_token}`,
  });
  if (sent !== "sent") {
    // Without the email the entry can never be confirmed; remove it so the person can try again later.
    await service.from("action_submissions").delete().eq("id", result.id!);
    return Response.json({ error: "We couldn't send the confirmation email. Try again later." }, { status: 503 });
  }
  return Response.json({ ok: true, status: "pending_verification" }, { status: 202 });
}
