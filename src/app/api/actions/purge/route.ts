import { createActionsServiceClient } from "@/lib/actions/server";
import { sameSecret } from "@/lib/social/crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Daily retention: unconfirmed giveaway entries after 7 days, entrant contact details 180 days after a giveaway ends. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || !sameSecret(request.headers.get("authorization") ?? "", `Bearer ${secret}`)) return Response.json({ error: "Not found." }, { status: 404 });
  const { data, error } = await createActionsServiceClient().rpc("purge_action_submissions");
  if (error) return Response.json({ error: "Purge failed." }, { status: 500 });
  return Response.json(data);
}
