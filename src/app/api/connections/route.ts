import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const modeSchema = z.enum(["personal", "event", "business"]);
const sourceSchema = z.enum(["qr", "link", "share", "native_share", "profile", "direct"]).catch("direct");
const requestSchema = z.object({
  username: z.string().regex(/^[a-z0-9_]{3,24}$/),
  mode: modeSchema,
  source: sourceSchema,
  requestId: z.string().uuid(),
  shareBackMode: modeSchema.optional(),
  displayName: z.string().trim().min(1).max(80).optional(),
  email: z.string().trim().email().max(254).optional(),
}).strict();

const guestCookieName = "sv-guest-session";

export async function POST(request: Request) {
  const requestUrl = new URL(request.url);
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  const sameOriginIntent = request.headers.get("x-setuvara-request") === "same-origin";
  const requestHost = request.headers.get("x-forwarded-host")?.split(",")[0].trim()
    ?? request.headers.get("host");
  const requestProtocol = request.headers.get("x-forwarded-proto")?.split(",")[0].trim()
    ?? requestUrl.protocol.replace(":", "");
  const expectedOrigin = requestHost ? `${requestProtocol}://${requestHost}` : requestUrl.origin;
  let sameOrigin = sameOriginIntent;
  try {
    sameOrigin = sameOriginIntent && (!origin || new URL(origin).origin === expectedOrigin)
      && (!fetchSite || fetchSite === "same-origin");
  } catch { sameOrigin = false; }
  if (!sameOrigin) {
    return Response.json({ error: "This connection request could not be verified." }, { status: 403 });
  }
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return Response.json({ error: "Use the Setuvara connection form." }, { status: 415 });
  }

  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Check the connection details and try again." }, { status: 400 });

  try {
    const supabase = await createClient();
    const { data: claims } = await supabase.auth.getClaims();
    const userId = claims?.claims?.sub;

    if (userId) {
      if (!parsed.data.shareBackMode) return Response.json({ error: "Choose a Mode to share back." }, { status: 400 });
      const { data, error } = await supabase.rpc("connect_registered", {
        p_target_username: parsed.data.username,
        p_target_mode: parsed.data.mode,
        p_share_back_mode: parsed.data.shareBackMode,
        p_request_id: parsed.data.requestId,
        p_source: parsed.data.source,
      });
      if (error || !data) return Response.json({ error: "We couldn’t connect right now. Try again." }, { status: 400 });
      return Response.json({ connected: true, connectionId: data.connection_id, encounterId: data.encounter_id }, { status: 201 });
    }

    const cookieStore = await cookies();
    let token = cookieStore.get(guestCookieName)?.value;
    let newSession = false;
    if (token) {
      const { data: guestSession } = await supabase.rpc("get_guest_session_status", { p_session_token: token });
      if (!guestSession) token = undefined;
    }
    if (!token) {
      token = randomBytes(32).toString("base64url");
      newSession = true;
    }
    if (!newSession && parsed.data.email) {
      // An established guest session is tied to its original email and name.
      // Ignore new client-supplied values and keep those fields private.
    } else if (newSession && (!parsed.data.email || !parsed.data.displayName)) {
      return Response.json({ error: "Add your name and email to keep this connection." }, { status: 400 });
    }

    const { data, error } = await supabase.rpc("create_guest_connection", {
      p_target_username: parsed.data.username,
      p_target_mode: parsed.data.mode,
      p_display_name: parsed.data.displayName ?? "",
      p_email: parsed.data.email ?? "",
      p_session_token: token,
      p_request_id: parsed.data.requestId,
      p_source: parsed.data.source,
    });
    if (error || !data) return Response.json({ error: "We couldn’t connect right now. Check the details and try again." }, { status: 400 });

    if (newSession) {
      cookieStore.set(guestCookieName, token, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
      });
    }
    return Response.json({ connected: true, connectionId: data.connection_id, encounterId: data.encounter_id }, { status: 201 });
  } catch {
    return Response.json({ error: "We couldn’t save this connection right now. Try again." }, { status: 500 });
  }
}
