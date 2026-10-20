import { sameOrigin } from "@/lib/marketing/inquiry-mail";
import { socialRequest } from "@/lib/social/routes";
import { ownAccount, refreshAllowed, socialProviderReady, syncAccount } from "@/lib/social/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Refresh now, at most every few minutes per account so platform quotas hold. */
export async function POST(request: Request, { params }: { params: Promise<{ provider: string }> }) {
  if (!sameOrigin(request)) return Response.json({ error: "This request could not be verified." }, { status: 403 });
  const who = await socialRequest(params);
  if (!who) return Response.json({ error: "Sign in again." }, { status: 401 });
  if (!socialProviderReady(who.provider)) return Response.json({ error: "This platform isn't available yet." }, { status: 404 });
  const account = await ownAccount(who.userId, who.provider);
  if (!account) return Response.json({ error: "Not connected." }, { status: 404 });
  if (!refreshAllowed(account)) return Response.json({ error: "Updated a moment ago. Try again in a few minutes." }, { status: 429 });
  const result = await syncAccount(account);
  return Response.json({ status: result }, { status: result === "synced" ? 200 : 502 });
}
