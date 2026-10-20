import { NextResponse } from "next/server";

import { getPublicOrigin } from "@/lib/app/viewer";
import { pkcePair, randomToken, signState } from "@/lib/social/crypto";
import { PROVIDERS } from "@/lib/social/providers";
import { SETTINGS_PATH, socialRequest, STATE_COOKIE } from "@/lib/social/routes";
import { providerCredentials, redirectUri, socialProviderReady } from "@/lib/social/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATE_TTL_S = 600;

/** Sends the signed-in member to the platform's own sign-in, with a signed one-time state. */
export async function GET(request: Request, { params }: { params: Promise<{ provider: string }> }) {
  const origin = await getPublicOrigin(request.headers);
  const who = await socialRequest(params);
  if (!who) return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(SETTINGS_PATH)}`, origin));
  const creds = providerCredentials(who.provider);
  if (!socialProviderReady(who.provider) || !creds) return NextResponse.redirect(new URL(`${SETTINGS_PATH}&social=unavailable`, origin));

  const spec = PROVIDERS[who.provider];
  const state = randomToken(24);
  const pkce = spec.pkce ? pkcePair() : null;
  const response = NextResponse.redirect(spec.authorizeUrl({ creds, redirectUri: redirectUri(origin, who.provider), state, challenge: pkce?.challenge }));
  response.cookies.set(STATE_COOKIE, signState({ provider: who.provider, state, user: who.userId, verifier: pkce?.verifier, exp: Date.now() + STATE_TTL_S * 1000 }), {
    httpOnly: true, secure: origin.startsWith("https://"), sameSite: "lax", path: "/api/social", maxAge: STATE_TTL_S,
  });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
