import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getPublicOrigin } from "@/lib/app/viewer";
import { readState, sameSecret } from "@/lib/social/crypto";
import { PROVIDERS, ProviderError } from "@/lib/social/providers";
import { SETTINGS_PATH, socialRequest, STATE_COOKIE } from "@/lib/social/routes";
import { providerCredentials, redirectUri, saveConnection, socialProviderReady } from "@/lib/social/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The platform sends the member back here. The state must match the signed cookie from this browser
 * and the same signed-in member, or nothing is stored. Tokens go straight into sealed storage.
 */
export async function GET(request: Request, { params }: { params: Promise<{ provider: string }> }) {
  const origin = await getPublicOrigin(request.headers);
  const back = (result: string) => {
    const response = NextResponse.redirect(new URL(`${SETTINGS_PATH}&social=${result}`, origin));
    response.cookies.set(STATE_COOKIE, "", { path: "/api/social", maxAge: 0 });
    response.headers.set("Cache-Control", "no-store");
    return response;
  };

  const who = await socialRequest(params);
  if (!who) return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(SETTINGS_PATH)}`, origin));
  const creds = providerCredentials(who.provider);
  if (!socialProviderReady(who.provider) || !creds) return back("unavailable");

  const url = new URL(request.url);
  const saved = readState((await cookies()).get(STATE_COOKIE)?.value);
  const state = url.searchParams.get("state") ?? "";
  if (!saved || saved.provider !== who.provider || saved.user !== who.userId || !state || !sameSecret(state, saved.state)) return back("expired");
  if (url.searchParams.get("error")) return back("cancelled");
  const code = url.searchParams.get("code");
  if (!code || code.length > 2048) return back("failed");

  try {
    const spec = PROVIDERS[who.provider];
    const tokens = await spec.exchange({ creds, redirectUri: redirectUri(origin, who.provider), code, verifier: saved.verifier });
    const snapshot = await spec.snapshot({ creds, accessToken: tokens.accessToken });
    const result = await saveConnection(who.userId, who.provider, tokens, snapshot);
    return back(result === "connected" ? `connected-${who.provider}` : "taken");
  } catch (error) {
    if (error instanceof ProviderError && error.code === "not_professional") return back("not-professional");
    if (error instanceof ProviderError && error.code === "no_account") return back("no-account");
    if (error instanceof Error && error.message === "account_taken") return back("taken");
    console.error("social_connect_failed", who.provider, error instanceof ProviderError ? error.code : "unexpected");
    return back("failed");
  }
}
