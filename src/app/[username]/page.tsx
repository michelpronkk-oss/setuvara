import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";

import { marketingFontClasses } from "@/app/(marketing)/fonts";
import { MeetMark } from "@/components/marketing/brand";
import { ConnectFlow } from "@/components/connections/connect-flow";
import { isFullBleed, ProfileRenderer, profileTone } from "@/components/profile/profile-renderer";
import type { ConnectionContext, ModeSlug, ProfileIdentity, ProfileLink, ProfileMode } from "@/components/profile/types";
import { readableBlocks } from "@/lib/blocks/registry";
import { createClient } from "@/lib/supabase/server";
import { isAllowedUsername, normalizeUsername } from "@/lib/usernames";

type PublicProfilePageProps = {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ mode?: string; source?: string }>;
};

type ConnectionState = {
  connection_id: string;
  context?: ConnectionContext | null;
};

export async function generateMetadata({ params }: PublicProfilePageProps): Promise<Metadata> {
  const { username: rawUsername } = await params;
  const username = normalizeUsername(rawUsername);
  if (!isAllowedUsername(username)) notFound();
  return {
    title: `@${username} · Setuvara`,
    alternates: { canonical: `https://setuvara.com/${encodeURIComponent(username)}` },
  };
}

export default async function PublicProfilePage({ params, searchParams }: PublicProfilePageProps) {
  const [{ username: rawUsername }, query] = await Promise.all([params, searchParams]);
  const username = normalizeUsername(rawUsername);
  if (!isAllowedUsername(username)) notFound();
  const slug = (query.mode ?? "personal") as ModeSlug;
  if (!["personal", "event", "business"].includes(slug)) notFound();

  const supabase = await createClient();
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, username, display_name, bio, is_published")
    .eq("username", username)
    .eq("is_published", true)
    .maybeSingle();
  if (profileError || !profile) notFound();
  const { data: publicCosmetics } = await supabase.from("passport_preferences")
    .select("category,reward_id")
    .eq("user_id", profile.id)
    .in("category", ["profile_treatment", "accent", "profile_mark"]);

  const { data: rawMode, error: modeError } = await supabase
    .from("profile_modes")
    .select("id, slug, label, is_enabled, settings, appearance, image_path")
    .eq("profile_id", profile.id)
    .eq("slug", slug)
    .eq("is_enabled", true)
    .maybeSingle();
  if (modeError || !rawMode) notFound();

  const { data: links, error: linksError } = await supabase
    .from("profile_links")
    .select("id, title, url, link_type, is_visible, sort_order")
    .eq("profile_id", profile.id)
    .eq("mode_id", rawMode.id)
    .eq("is_visible", true)
    .order("sort_order");
  if (linksError) notFound();

  // Blocks are optional content: if they can't load, the profile still renders.
  const { data: blockRows } = await supabase
    .from("profile_blocks")
    .select("id, kind, data, is_visible, sort_order")
    .eq("profile_id", profile.id)
    .eq("mode_id", rawMode.id)
    .eq("is_visible", true)
    .order("sort_order");

  let imageUrl: string | null = null;
  if (rawMode.image_path) {
    const { data: image } = await supabase.storage.from("profile-media").createSignedUrl(rawMode.image_path, 3600);
    imageUrl = image?.signedUrl ?? null;
  }

  const { data: claims } = await supabase.auth.getClaims();
  const userId = typeof claims?.claims?.sub === "string" ? claims.claims.sub : null;
  const owner = userId === profile.id;
  let viewerState: "owner" | "visitor_unconnected" | "visitor_connected" = owner ? "owner" : "visitor_unconnected";
  let connectedState: ConnectionState | null = null;
  let guestSessionName: string | null = null;
  let isGuestSession = false;
  let shareBackModes: { slug: ModeSlug; label: string }[] = [];

  if (!owner && userId) {
    const [{ data: connection }, { data: availableModes }] = await Promise.all([
      supabase.rpc("get_registered_connection_state", { p_target_username: username, p_target_mode: slug }),
      supabase.from("profile_modes").select("slug,label").eq("profile_id", userId).eq("is_enabled", true).order("sort_order"),
    ]);
    connectedState = connection as unknown as ConnectionState | null;
    shareBackModes = (availableModes ?? []).filter((item) => ["personal", "event", "business"].includes(item.slug)).map((item) => ({ slug: item.slug as ModeSlug, label: item.label }));
  } else if (!owner) {
    const cookieStore = await cookies();
    const guestToken = cookieStore.get("sv-guest-session")?.value;
    if (guestToken) {
      const [{ data: state }, { data: guestStatus }] = await Promise.all([
        supabase.rpc("get_guest_connection_state", { p_target_username: username, p_target_mode: slug, p_session_token: guestToken }),
        supabase.rpc("get_guest_session_status", { p_session_token: guestToken }),
      ]);
      connectedState = state as unknown as ConnectionState | null;
      guestSessionName = (guestStatus as { display_name?: string } | null)?.display_name ?? null;
      isGuestSession = Boolean(guestSessionName);
    }
  }
  if (connectedState?.connection_id) viewerState = "visitor_connected";
  const identity = profile as ProfileIdentity;
  const mode: ProfileMode = {
    ...rawMode,
    slug: rawMode.slug as ModeSlug,
    settings: rawMode.settings as Record<string, string | boolean>,
    appearance: rawMode.appearance as ProfileMode["appearance"],
    image_url: imageUrl,
    links: (links ?? []) as ProfileLink[],
    blocks: readableBlocks(blockRows),
  };

  // Full Bleed runs the photo to the phone's edges; the page takes on the profile's own background.
  const bleed = isFullBleed(mode);
  const pageTone = profileTone(mode);

  return (
    <main className={`${marketingFontClasses} min-h-dvh bg-[#f5f4ef] px-3 py-4 font-brand text-[#0d0d0d] sm:px-6 sm:py-10 ${bleed ? "max-sm:bg-[var(--page-bg)] max-sm:px-0 max-sm:py-0" : ""}`} style={bleed ? ({ "--page-bg": pageTone.bg } as React.CSSProperties) : undefined}>
      <div className="relative mx-auto w-full max-w-[440px]">
        <header className={`mb-4 flex items-center justify-between px-2 ${bleed ? "max-sm:absolute max-sm:inset-x-0 max-sm:top-0 max-sm:z-20 max-sm:mb-0 max-sm:px-4 max-sm:pt-2 max-sm:text-[#f5f4ef] max-sm:[text-shadow:0_1px_12px_rgba(0,0,0,.35)]" : ""}`}>
          <Link aria-label="Setuvara home" className="inline-flex min-h-11 items-center gap-2" href="/"><MeetMark className="size-5" /><span className="font-display text-[17px] font-bold tracking-[-0.05em]">setuvara</span></Link>
          {owner && <Link className={`inline-flex min-h-10 items-center rounded-full bg-[#0d0d0d] px-4 text-xs font-semibold text-[#f5f4ef] ${bleed ? "max-sm:bg-black/45 max-sm:backdrop-blur-md max-sm:[text-shadow:none]" : ""}`} href={`/app/identity?mode=${slug}`}>Edit profile</Link>}
        </header>
        <ProfileRenderer
          bleed={bleed}
          profile={identity}
          mode={mode}
          viewerState={viewerState}
          selectedRewards={Object.fromEntries((publicCosmetics ?? []).map((item) => [item.category, item.reward_id]))}
          connectionContext={connectedState?.context as ConnectionContext | undefined}
          connectionHref={connectedState?.connection_id ? (isGuestSession ? `/connections/${connectedState.connection_id}` : `/app/connections/${connectedState.connection_id}`) : undefined}
          guestClaimHref={isGuestSession ? "/signup?claim=1" : undefined}
          visitorAction={!owner ? <ConnectFlow
            username={username}
            mode={slug}
            source={query.source ?? "direct"}
            registered={Boolean(userId)}
            shareBackModes={shareBackModes}
            guestSessionName={guestSessionName}
            alreadyConnected={Boolean(connectedState?.connection_id)}
            label={slug === "event" && typeof mode.settings.eventName === "string" && mode.settings.eventName.trim() ? `Connect at ${mode.settings.eventName.trim()}` : "Connect"}
            tone={slug === "personal" ? "accent" : "ink"}
          /> : undefined}
        />
        <p className={`mt-5 text-center font-label text-[10px] tracking-wide text-black/40 ${bleed ? `max-sm:mt-0 max-sm:pb-8 ${pageTone.dark ? "max-sm:text-white/40" : ""}` : ""}`}>Your identity, your context. Shared with Setuvara.</p>
      </div>
    </main>
  );
}
