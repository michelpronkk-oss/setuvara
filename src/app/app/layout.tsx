import { redirect } from "next/navigation";
import { headers } from "next/headers";
import type { ReactNode } from "react";

import { AppShell } from "@/components/app/app-shell";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "./identity/actions";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const { data: claims, error } = await supabase.auth.getClaims();
  const userId = typeof claims?.claims?.sub === "string" ? claims.claims.sub : null;
  if (error || !userId) redirect("/login?next=/app");

  const [{ data: profile }, requestHeaders] = await Promise.all([
    supabase.from("profiles").select("username, display_name").eq("id", userId).maybeSingle(),
    headers(),
  ]);
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "setuvara.com";
  const publicOrigin = /^(localhost|127\.0\.0\.1):(?:3000|3014)$/.test(host) ? `http://${host}` : "https://setuvara.com";

  return (
    <AppShell
      displayName={profile?.display_name ?? "Your identity"}
      publicProfileUrl={profile?.username ? `${publicOrigin}/${profile.username}` : null}
      signOut={signOut}
    >
      {children}
    </AppShell>
  );
}
