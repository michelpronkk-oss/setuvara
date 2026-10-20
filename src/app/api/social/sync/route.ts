import { sameSecret } from "@/lib/social/crypto";
import { dueAccounts, socialConnectEnabled, syncAccount } from "@/lib/social/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** The scheduled refresh (hourly). Only a caller holding CRON_SECRET can run it. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || !sameSecret(request.headers.get("authorization") ?? "", `Bearer ${secret}`)) return Response.json({ error: "Not found." }, { status: 404 });
  if (!socialConnectEnabled()) return Response.json({ synced: 0, skipped: "disabled" });
  const results = { synced: 0, needs_reauth: 0, error: 0 };
  // One at a time keeps each platform's per-app rate limit comfortable.
  for (const account of await dueAccounts(50)) results[await syncAccount(account)] += 1;
  return Response.json(results);
}
