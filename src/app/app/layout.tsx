import { redirect } from "next/navigation";
import { headers } from "next/headers";
import type { ReactNode } from "react";
import type { Metadata } from "next";

import { marketingFontClasses } from "@/app/(marketing)/fonts";
import { AppShell } from "@/components/app/app-shell";
import { getPublicOrigin, getViewerPlan } from "@/lib/app/viewer";
import { signHomeImage } from "@/lib/app/media";
import { WALLET_PUBLICLY_LAUNCHED } from "@/lib/wallet/launch";
import { readFocus } from "@/components/profile/photo-focus";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "./identity/actions";

export const metadata: Metadata = {
  title: { default: "Your Setuvara", template: "%s | Setuvara" },
  robots: { index: false, follow: false },
  openGraph: null,
  twitter: null,
};

export default async function AppLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const { data: claims, error } = await supabase.auth.getClaims();
  const userId = typeof claims?.claims?.sub === "string" ? claims.claims.sub : null;
  if (error || !userId) redirect("/login?next=/app");

  const [{ data: profile }, { data: personal }, requestHeaders, billing] = await Promise.all([
    supabase.from("profiles").select("username, display_name").eq("id", userId).maybeSingle(),
    supabase.from("profile_modes").select("image_path, image_focus_x, image_focus_y").eq("profile_id", userId).eq("slug", "personal").maybeSingle(),
    headers(),
    getViewerPlan(userId),
  ]);
  const publicOrigin = await getPublicOrigin(requestHeaders);
  // Small signed thumbnail for the avatar. Width transform keeps the header light.
  const avatarUrl = await signHomeImage(supabase, personal?.image_path, true);

  return (
    <div className={marketingFontClasses}>
      <AppShell
        avatarFocus={readFocus(personal?.image_focus_x, personal?.image_focus_y)}
        avatarUrl={avatarUrl}
        canManageBilling={billing.canManageBilling}
        displayName={profile?.display_name ?? "Your identity"}
        plan={billing.plan}
        publicProfileUrl={profile?.username ? `${publicOrigin}/${profile.username}` : null}
        signOut={signOut}
        walletPubliclyLaunched={WALLET_PUBLICLY_LAUNCHED}
        username={profile?.username ?? null}
      >
        {children}
      </AppShell>
    </div>
  );
}
