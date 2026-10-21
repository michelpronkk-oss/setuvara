import { dispatchAudience } from "@/lib/audience/dispatch";
import { getPublicOrigin } from "@/lib/app/viewer";
import { sameSecret } from "@/lib/social/crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Picks up any campaign still sending (a run that timed out, or a batch to retry). Schedule every few minutes. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || !sameSecret(request.headers.get("authorization") ?? "", `Bearer ${secret}`)) return Response.json({ error: "Not found." }, { status: 404 });
  return Response.json(await dispatchAudience({ origin: await getPublicOrigin(request.headers), budgetMs: 50_000 }));
}
