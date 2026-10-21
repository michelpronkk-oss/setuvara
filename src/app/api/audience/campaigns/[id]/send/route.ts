import { after } from "next/server";

import { audienceErrorMessage } from "@/lib/audience/model";
import { audienceSendEnabled, dispatchAudience } from "@/lib/audience/dispatch";
import { getPublicOrigin } from "@/lib/app/viewer";
import { sameOrigin } from "@/lib/marketing/inquiry-mail";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The owner sends a draft: the database checks the plan, snapshots the confirmed subscribers and
 * queues them; delivery starts right after the response. Pressing it again on a campaign that is
 * still going only resumes delivery, it never queues anyone twice.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(request)) return Response.json({ error: "This request could not be verified." }, { status: 403 });
  if (!audienceSendEnabled()) return Response.json({ error: "Sending isn't switched on yet." }, { status: 503 });
  const { id } = await params;
  if (!uuid.test(id)) return Response.json({ error: "Not found." }, { status: 404 });
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (typeof claims?.claims?.sub !== "string") return Response.json({ error: "Sign in first." }, { status: 401 });

  const { data: campaign } = await supabase.from("audience_campaigns").select("status, recipient_count").eq("id", id).maybeSingle();
  if (!campaign) return Response.json({ error: "Not found." }, { status: 404 });
  let recipients = campaign.recipient_count as number;
  if (campaign.status === "draft") {
    const { data, error } = await supabase.rpc("queue_audience_campaign", { p_campaign_id: id });
    if (error) return Response.json({ error: audienceErrorMessage(error.message) }, { status: error.code === "P0001" ? 402 : 400 });
    recipients = (data as { recipients: number }).recipients;
  } else if (campaign.status !== "queued" && campaign.status !== "sending") {
    return Response.json({ error: audienceErrorMessage("campaign_locked") }, { status: 409 });
  }
  const origin = await getPublicOrigin(request.headers);
  after(() => dispatchAudience({ campaignId: id, origin }).then(() => undefined, (error) => console.error("Audience dispatch failed", { message: String(error).slice(0, 120) })));
  return Response.json({ ok: true, recipients }, { status: 202 });
}
