import { CAMPAIGN_COLUMNS, audienceErrorMessage, type Campaign } from "@/lib/audience/model";
import { audienceSendEnabled } from "@/lib/audience/dispatch";
import { renderCampaignEmail } from "@/lib/audience/mail";
import { getPublicOrigin } from "@/lib/app/viewer";
import { sameOrigin } from "@/lib/marketing/inquiry-mail";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A test of a draft, to the owner's own sign-in address only. Counted against the plan's test allowance. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(request)) return Response.json({ error: "This request could not be verified." }, { status: 403 });
  if (!audienceSendEnabled()) return Response.json({ error: "Sending isn't switched on yet." }, { status: 503 });
  const { id } = await params;
  if (!uuid.test(id)) return Response.json({ error: "Not found." }, { status: 404 });
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const email = typeof claims?.claims?.email === "string" ? claims.claims.email : null;
  if (typeof claims?.claims?.sub !== "string" || !email) return Response.json({ error: "Sign in first." }, { status: 401 });

  const { data: row } = await supabase.from("audience_campaigns").select(CAMPAIGN_COLUMNS).eq("id", id).maybeSingle();
  const campaign = row as Campaign | null;
  if (!campaign) return Response.json({ error: "Not found." }, { status: 404 });
  if (!campaign.subject.trim() || !campaign.body.trim()) return Response.json({ error: audienceErrorMessage(campaign.subject.trim() ? "campaign_body_required" : "campaign_subject_required") }, { status: 400 });
  const { data: noted, error } = await supabase.rpc("note_audience_campaign_test", { p_campaign_id: id });
  if (error) return Response.json({ error: audienceErrorMessage(error.message) }, { status: 402 });
  if (noted !== true) return Response.json({ error: audienceErrorMessage("campaign_locked") }, { status: 409 });

  const [{ data: profile }, { data: lists }] = await Promise.all([
    supabase.from("profiles").select("display_name").eq("id", claims.claims.sub).maybeSingle(),
    campaign.list_ids.length ? supabase.from("profile_actions").select("title").in("id", campaign.list_ids) : Promise.resolve({ data: [] as { title: string }[] }),
  ]);
  const origin = await getPublicOrigin(request.headers);
  const message = renderCampaignEmail({
    to: email, senderDisplay: profile?.display_name || "You", subject: campaign.subject, preheader: campaign.preheader, body: campaign.body,
    replyTo: campaign.reply_to, lists: (lists ?? []).map((item) => item.title), unsubscribeUrl: `${origin}/s/unsubscribe?preview=1`, test: true,
  });
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return Response.json({ error: "Email isn't set up on this site." }, { status: 503 });
  const sent = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "Idempotency-Key": `audience-test-${id}-${campaign.test_count + 1}` },
    body: JSON.stringify(message),
    signal: AbortSignal.timeout(15_000),
  }).catch(() => null);
  if (!sent?.ok) return Response.json({ error: "The test didn't send. Try again." }, { status: 502 });
  return Response.json({ ok: true, to: email });
}
