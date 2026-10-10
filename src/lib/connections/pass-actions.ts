"use server";

import { cookies, headers } from "next/headers";
import { z } from "zod";

import { getPublicOrigin } from "@/lib/app/viewer";
import { ownerPassCookie } from "@/lib/connections/access";
import { createClient } from "@/lib/supabase/server";

const modeSchema = z.enum(["personal", "event", "business"]);

export type ConnectPassResult =
  | { ok: true; url: string; expiresAt: string }
  | { ok: false; message: string };

/**
 * Connect in person: returns the owner's Connection Pass link for one of their
 * own Modes. The database reuses the pass kept in this browser while it has
 * time left, so reopening the share sheet does not mint new grants.
 */
export async function getConnectPass(mode: unknown): Promise<ConnectPassResult> {
  const parsed = modeSchema.safeParse(mode);
  if (!parsed.success) return { ok: false, message: "Choose a Mode to share." };
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return { ok: false, message: "Sign in to share." };

  const cookieStore = await cookies();
  const current = cookieStore.get(ownerPassCookie(parsed.data))?.value ?? null;
  const { data, error } = await supabase.rpc("issue_connection_pass", { p_mode: parsed.data, p_current_token: current });
  const pass = data as { token?: string; expires_at?: string } | null;
  if (error || !pass?.token || !pass.expires_at) {
    return { ok: false, message: error?.message === "Too many Connection Passes today" ? "You’ve made a lot of passes today. Try again tomorrow." : "Connect in person isn’t available right now." };
  }

  const expiresAt = new Date(pass.expires_at);
  cookieStore.set(ownerPassCookie(parsed.data), pass.token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
  const origin = await getPublicOrigin(await headers());
  return { ok: true, url: `${origin}/connect/${pass.token}`, expiresAt: expiresAt.toISOString() };
}

/** Ends every active Connection Pass for one of the owner's Modes. */
export async function endConnectPasses(mode: unknown): Promise<{ ok: boolean }> {
  const parsed = modeSchema.safeParse(mode);
  if (!parsed.success) return { ok: false };
  const supabase = await createClient();
  const { error } = await supabase.rpc("revoke_connection_passes", { p_mode: parsed.data });
  (await cookies()).delete(ownerPassCookie(parsed.data));
  return { ok: !error };
}
