import "server-only";

import { createClient } from "@/lib/supabase/server";

export const STUDIO_PAYMENTS = "/app/identity/creator/commerce/payments";
export const SELLER_TERMS_VERSION = "commerce-2026-10";

/** The signed-in member for owner routes, or null. */
export async function signedInUser() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const id = typeof claims?.claims?.sub === "string" ? claims.claims.sub : null;
  const email = typeof claims?.claims?.email === "string" ? claims.claims.email : null;
  return id ? { supabase, id, email } : null;
}

export const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
