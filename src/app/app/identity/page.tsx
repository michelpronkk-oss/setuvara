import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { cookies } from "next/headers";

import type { ModeSlug, ProfileIdentity, ProfileLink, ProfileMode } from "@/components/profile/types";
import { readableBlocks } from "@/lib/blocks/registry";
import { createClient } from "@/lib/supabase/server";

import { signOut } from "./actions";
import { IdentityEditor } from "./editor";
import type { RewardCategory } from "@/lib/passport/rewards";

type IdentityEditorPageProps = {
  searchParams: Promise<{ mode?: string; section?: string; error?: string; saved?: string }>;
};

export default async function IdentityEditorPage({ searchParams }: IdentityEditorPageProps) {
  const query = await searchParams;
  const requestHeaders = await headers();
  const requestHost = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "";
  const localHost = /^(localhost|127\.0\.0\.1):(?:3000|3014)$/.test(requestHost);
  const publicOrigin = localHost ? `http://${requestHost}` : "https://setuvara.com";
  const supabase = await createClient();
  const { data: claims, error: claimsError } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (claimsError || !userId) redirect("/login?next=/app/identity");
  const guestSessionToken = (await cookies()).get("sv-guest-session")?.value;
  if (guestSessionToken) await supabase.rpc("claim_guest_connections", { p_session_token: guestSessionToken });

  const [profileResult, modesResult, linksResult, blocksResult, passportResult] = await Promise.all([
    supabase.from("profiles").select("id, username, display_name, bio, is_published").eq("id", userId).maybeSingle(),
    supabase.from("profile_modes").select("id, slug, label, sort_order, is_enabled, settings, appearance, image_path").eq("profile_id", userId).order("sort_order"),
    supabase.from("profile_links").select("id, mode_id, title, url, link_type, sort_order, is_visible").eq("profile_id", userId).order("sort_order"),
    supabase.from("profile_blocks").select("id, mode_id, kind, data, sort_order, is_visible").eq("profile_id", userId).order("sort_order"),
    supabase.rpc("get_passport_overview"),
  ]);

  if (profileResult.error || modesResult.error || linksResult.error || !profileResult.data || !modesResult.data?.length) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f5f4ef] px-5 text-[#0d0d0d]">
        <section className="max-w-md rounded-[2rem] bg-white p-8 shadow-sm">
          <p className="text-xs font-bold lowercase tracking-[0.2em]">setuvara</p>
          <h1 className="mt-5 text-2xl font-semibold">Your identity is getting ready.</h1>
          <p className="mt-2 text-sm leading-6 text-black/55">We couldn’t load the editor right now. Refresh in a moment or sign out and back in.</p>
          <form action={signOut} className="mt-5"><button className="min-h-11 font-semibold underline underline-offset-4" type="submit">Sign out</button></form>
        </section>
      </main>
    );
  }

  const profile = profileResult.data as ProfileIdentity;
  const modes: ProfileMode[] = await Promise.all(modesResult.data.map(async (mode) => {
    const { data: signed } = mode.image_path
      ? await supabase.storage.from("profile-media").createSignedUrl(mode.image_path, 3600)
      : { data: null };
    return {
      ...mode,
      slug: mode.slug as ModeSlug,
      settings: mode.settings as Record<string, string | boolean>,
      appearance: mode.appearance as ProfileMode["appearance"],
      image_url: signed?.signedUrl ?? null,
      links: (linksResult.data ?? []).filter((link) => link.mode_id === mode.id) as ProfileLink[],
      // Blocks are optional: an older database without them still opens the editor.
      blocks: readableBlocks((blocksResult.data ?? []).filter((block) => block.mode_id === mode.id)),
    };
  }));
  const requestedMode = modes.find((mode) => mode.slug === query.mode)?.slug ?? "personal";
  const passport = (passportResult.data ?? {}) as { rewards?: { id: string }[]; preferences?: Partial<Record<RewardCategory, string>>; milestones?: { threshold: number; seenAt: string | null }[] };
  const unseenMilestone = passport.milestones?.filter((milestone) => !milestone.seenAt).at(-1)?.threshold ?? null;

  return (
    <IdentityEditor
      error={query.error}
      initialMode={requestedMode}
      initialModes={modes}
      initialProfile={profile}
      initialSection={query.section ?? "home"}
      unlockedRewards={(passport.rewards ?? []).map((reward) => reward.id)}
      selectedRewards={passport.preferences ?? {}}
      celebrationThreshold={unseenMilestone}
      publicOrigin={publicOrigin}
      saved={query.saved}
      signOut={signOut}
    />
  );
}
