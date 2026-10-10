import { redirect } from "next/navigation";

import { TapExperience, type TapProfile } from "@/components/app/tap/tap-experience";
import { parseConnectPolicy } from "@/lib/connections/access";
import { createClient } from "@/lib/supabase/server";

const modeOrder = ["personal", "event", "business"] as const;

export default async function TapPage() {
  const supabase = await createClient();
  const { data: claims, error: claimsError } = await supabase.auth.getClaims();
  const userId = typeof claims?.claims?.sub === "string" ? claims.claims.sub : null;
  if (claimsError || !userId) redirect("/login?next=/app/tap");

  const [{ data: profile, error: profileError }, { data: modes, error: modesError }] = await Promise.all([
    supabase.from("profiles").select("display_name, username, is_published").eq("id", userId).maybeSingle(),
    supabase.from("profile_modes").select("slug, is_enabled, connect_policy").eq("profile_id", userId),
  ]);

  if (profileError || modesError || !profile || !modes) {
    return (
      <main className="mx-auto max-w-xl px-5 py-16">
        <p className="font-label text-xs uppercase tracking-[0.16em] text-black/55">Setuvara Tap</p>
        <h1 className="mt-4 font-display text-4xl font-bold tracking-[-0.05em]">Your Tap is taking a moment.</h1>
        <p className="mt-3 text-base text-black/65">We could not load your identity right now. Refresh this page in a moment.</p>
      </main>
    );
  }

  const tapProfile: TapProfile = {
    displayName: profile.display_name,
    username: profile.username,
    published: profile.is_published,
    modes: modeOrder.map((slug) => {
      const mode = modes.find((item) => item.slug === slug);
      return { slug, enabled: mode?.is_enabled ?? false, connectPolicy: parseConnectPolicy(mode?.connect_policy) };
    }),
  };

  return <TapExperience profile={tapProfile} />;
}
