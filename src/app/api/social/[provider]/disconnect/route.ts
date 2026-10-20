import { sameOrigin } from "@/lib/marketing/inquiry-mail";
import { socialRequest } from "@/lib/social/routes";
import { disconnectAccount, ownAccount } from "@/lib/social/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Revokes the sign-in where the platform allows it and deletes the account, its numbers and tokens. Works while sign-in is switched off too. */
export async function POST(request: Request, { params }: { params: Promise<{ provider: string }> }) {
  if (!sameOrigin(request)) return Response.json({ error: "This request could not be verified." }, { status: 403 });
  const who = await socialRequest(params);
  if (!who) return Response.json({ error: "Sign in again." }, { status: 401 });
  const account = await ownAccount(who.userId, who.provider);
  if (account) {
    try {
      await disconnectAccount(account);
    } catch {
      console.error("social_disconnect_failed", who.provider);
      return Response.json({ error: "We couldn't remove it just now. Nothing was deleted. Try again." }, { status: 500 });
    }
  }
  return Response.json({ ok: true });
}
