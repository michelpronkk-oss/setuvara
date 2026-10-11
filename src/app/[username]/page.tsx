import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { after } from "next/server";
import { notFound } from "next/navigation";
import { cookies, headers } from "next/headers";
import { cache } from "react";

import { marketingFontClasses } from "@/app/(marketing)/fonts";
import { MeetMark } from "@/components/marketing/brand";
import { ConnectFlow } from "@/components/connections/connect-flow";
import { isFullBleed, ProfileRenderer, profileTone, resolvedBrowserThemeColor } from "@/components/profile/profile-renderer";
import { resolveModeAccent, resolveAppearance } from "@/components/profile/appearance";
import type { ConnectionContext, ModeSlug, ProfileIdentity, ProfileLink, ProfileMode } from "@/components/profile/types";
import { readableBlocks, selectBlocks } from "@/lib/blocks/registry";
import { visitorPassCookie } from "@/lib/connections/access";
import { memberTierForPlan } from "@/lib/billing/member-badge";
import type { PlanCode } from "@/lib/billing/catalog";
import { PassportStamp, type PassportStampType } from "@/components/passport/passport-stamp";
import { JsonLd } from "@/components/seo/json-ld";
import { getUserBillingState } from "@/lib/billing/service";
import { classifyAnalyticsDevice, isAnalyticsMode, isAnalyticsSource, recordProductAnalyticsEvent } from "@/lib/analytics/events";
import { getPublishedPublicMode, publicProfileDescription, publicProfileTitle, publicSetting, safePublicHttpUrl } from "@/lib/seo/public-profile";
import { createClient } from "@/lib/supabase/server";
import { isAllowedUsername, normalizeUsername } from "@/lib/usernames";

type PublicProfilePageProps = {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ mode?: string; source?: string }>;
};

const FALLBACK_BROWSER_THEME_COLOR = "#F5F4EF";

const readPublicProfileMode = cache(async (username: string, slug: ModeSlug) => {
  const publicRecord = await getPublishedPublicMode(username, slug);
  if (!publicRecord) return null;

  try {
    const billing = await getUserBillingState(publicRecord.profile.id).catch(() => null);
    return { ...publicRecord, plan: billing?.plan ?? "free" as PlanCode };
  } catch {
    return null;
  }
});

function parseModeSlug(value?: string): ModeSlug | null {
  return value === undefined || value === "personal" ? "personal"
    : value === "event" || value === "business" ? value
      : null;
}

export async function generateViewport({ params, searchParams }: PublicProfilePageProps): Promise<Viewport> {
  const [{ username }, query] = await Promise.all([params, searchParams]);
  const normalizedUsername = normalizeUsername(username);
  const slug = parseModeSlug(query.mode);
  const record = isAllowedUsername(normalizedUsername) && slug
    ? await readPublicProfileMode(normalizedUsername, slug)
    : null;
  return {
    themeColor: record
      ? resolvedBrowserThemeColor({ slug: record.mode.slug as ModeSlug, appearance: record.mode.appearance as ProfileMode["appearance"] }, record.plan)
      : FALLBACK_BROWSER_THEME_COLOR,
    viewportFit: "cover",
  };
}

type ConnectionState = {
  connection_id: string;
  context?: ConnectionContext | null;
};

export async function generateMetadata({ params, searchParams }: PublicProfilePageProps): Promise<Metadata> {
  const { username: rawUsername } = await params;
  const username = normalizeUsername(rawUsername);
  if (!isAllowedUsername(username)) notFound();
  const query = await searchParams;
  const slug = parseModeSlug(query.mode);
  if (!slug) notFound();
  const record = await getPublishedPublicMode(username, slug);
  if (!record) notFound();

  const title = publicProfileTitle(record.profile);
  const description = publicProfileDescription(record);
  const canonical = `https://setuvara.com/${encodeURIComponent(username)}`;
  const image = `https://setuvara.com/og/profile/${encodeURIComponent(username)}/${slug}`;
  const modeName = slug[0].toUpperCase() + slug.slice(1);

  return {
    title,
    description,
    alternates: { canonical },
    robots: { index: true, follow: true },
    openGraph: {
      type: "profile",
      siteName: "Setuvara",
      title: `${title} | Setuvara`,
      description,
      url: canonical,
      images: [{ url: image, width: 1200, height: 630, alt: `${title} · ${modeName} Mode on Setuvara` }],
    },
    twitter: { card: "summary_large_image", title: `${title} | Setuvara`, description, images: [image] },
  };
}

export default async function PublicProfilePage({ params, searchParams }: PublicProfilePageProps) {
  const [{ username: rawUsername }, query] = await Promise.all([params, searchParams]);
  const username = normalizeUsername(rawUsername);
  if (!isAllowedUsername(username)) notFound();
  const slug = parseModeSlug(query.mode);
  if (!slug) notFound();

  const record = await readPublicProfileMode(username, slug);
  if (!record) notFound();
  const { profile, mode: rawMode, plan } = record;
  const supabase = await createClient();

  const [{ data: publicCosmetics }, { data: links, error: linksError }, { data: passportHighlight }] = await Promise.all([
    supabase.from("passport_preferences")
      .select("category,reward_id")
      .eq("user_id", profile.id)
      .in("category", ["profile_treatment", "accent", "profile_mark"]),
    supabase.from("profile_links")
      .select("id, title, url, link_type, is_visible, sort_order")
      .eq("profile_id", profile.id)
      .eq("mode_id", rawMode.id)
      .eq("is_visible", true)
      .order("sort_order"),
    supabase.rpc("get_public_passport_featured_stamp", { p_username: username }),
  ]);
  // Member status and premium presentation come from canonical billing, never profile data.
  const memberTier = memberTierForPlan(plan);
  if (linksError) notFound();

  // Blocks are optional content: if they can't load, the profile still renders.
  const { data: blockRows } = await selectBlocks("id, kind, data, is_visible, sort_order", (columns) => supabase
    .from("profile_blocks")
    .select(columns)
    .eq("profile_id", profile.id)
    .eq("mode_id", rawMode.id)
    .eq("is_visible", true)
    .order("sort_order"));

  let imageUrl: string | null = null;
  if (rawMode.image_path) {
    const { data: image } = await supabase.storage.from("profile-media").createSignedUrl(rawMode.image_path, 3600);
    imageUrl = image?.signedUrl ?? null;
  }

  const { data: claims } = await supabase.auth.getClaims();
  const userId = typeof claims?.claims?.sub === "string" ? claims.claims.sub : null;
  const owner = userId === profile.id;
  if (!owner) {
    const requestHeaders = await headers();
    const userAgent = requestHeaders.get("user-agent");
    const purpose = `${requestHeaders.get("purpose") ?? ""} ${requestHeaders.get("sec-purpose") ?? ""}`.toLowerCase();
    const prefetch = requestHeaders.has("next-router-prefetch") || /prefetch|prerender/.test(purpose);
    const crawler = /bot|crawler|spider|preview|facebookexternalhit|slackbot|whatsapp/i.test(userAgent ?? "");
    if (!prefetch && !crawler) {
      const source = query.source && isAnalyticsSource(query.source) ? query.source : "direct";
      const deviceClass = classifyAnalyticsDevice(userAgent);
      after(async () => {
        await recordProductAnalyticsEvent({
          eventName: "profile_viewed",
          ownerProfileId: profile.id,
          mode: isAnalyticsMode(slug) ? slug : null,
          source,
          deviceClass,
        });
      });
    }
  }
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

  // Connection Access is decided server-side for this exact profile and Mode.
  // Query parameters and client state never authorize; only a valid pass does.
  let canInitiateConnection = false;
  if (!owner) {
    const passToken = (await cookies()).get(visitorPassCookie(username, slug))?.value ?? null;
    const { data: access } = await supabase.rpc("get_connect_access", { p_target_username: username, p_target_mode: slug, p_pass_token: passToken });
    canInitiateConnection = access === true;
  }
  const identity = profile as ProfileIdentity;
  const publicBlocks = await Promise.all(readableBlocks(blockRows).map(async (block) => {
    if (block.is_soundtrack) return { ...block, data: { url: block.data.url } };
    const imagePath = block.data.image_path;
    const videoPath = block.data.video_path;
    const data = { ...block.data };
    delete data.image_path;
    delete data.video_path;
    delete data.video_mime_type;
    const [image, video] = await Promise.all([
      typeof imagePath === "string" ? supabase.storage.from("profile-media").createSignedUrl(imagePath, 3600) : Promise.resolve({ data: null }),
      typeof videoPath === "string" ? supabase.storage.from("profile-media").createSignedUrl(videoPath, 3600) : Promise.resolve({ data: null }),
    ]);
    return {
      ...block,
      data: {
        ...data,
        ...(typeof imagePath === "string" ? { image_url: image.data?.signedUrl ?? null } : {}),
        ...(typeof videoPath === "string" ? { video_url: video.data?.signedUrl ?? null } : {}),
      },
    };
  }));
  const mode: ProfileMode = {
    ...rawMode,
    slug: rawMode.slug as ModeSlug,
    settings: rawMode.settings as Record<string, string | boolean>,
    appearance: rawMode.appearance as ProfileMode["appearance"],
    image_url: imageUrl,
    links: (links ?? []) as ProfileLink[],
    blocks: publicBlocks,
  };
  const canonicalUrl = `https://setuvara.com/${encodeURIComponent(username)}`;
  const previewImageUrl = `https://setuvara.com/og/profile/${encodeURIComponent(username)}/${slug}`;
  const publicSettings = { settings: rawMode.settings as Record<string, unknown> };
  const publicRole = publicSetting(publicSettings, "role", 80);
  const publicCompany = slug === "business"
    ? publicSetting(publicSettings, "company", 100)
    : null;
  const sameAs = Array.from(new Set((links ?? []).flatMap((link) => {
    if (!( ["instagram", "linkedin", "spotify", "github", "youtube", "tiktok", "x", "facebook"] as string[]).includes(link.link_type)) return [];
    const url = safePublicHttpUrl(link.url);
    return url ? [url] : [];
  }))).slice(0, 10);
  const personStructuredData: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: identity.display_name,
    url: canonicalUrl,
    ...(imageUrl ? { image: previewImageUrl } : {}),
    ...(publicRole ? { jobTitle: publicRole } : {}),
    ...(publicCompany ? { worksFor: { "@type": "Organization", name: publicCompany } } : {}),
    ...(sameAs.length ? { sameAs } : {}),
  };

  // Full Bleed runs the photo to the phone's edges; the page takes on the profile's own background.
  const bleed = isFullBleed(mode, plan);
  const pageTone = profileTone(mode, plan);
  const browserThemeColor = resolvedBrowserThemeColor(mode, plan);
  const resolvedLook = resolveAppearance(mode, plan);
  const sharedPassportStamp = passportHighlight && typeof passportHighlight === "object"
    ? passportHighlight as { type: PassportStampType; title: string; subtitle: string | null; countryCode: string | null }
    : null;

  return (
    <main data-public-profile-surface="true" data-public-profile-theme={resolvedLook.theme} data-public-profile-layout={resolvedLook.layout} className={`${marketingFontClasses} min-h-dvh bg-[var(--page-bg)] px-3 py-4 font-brand text-[#0d0d0d] sm:px-6 sm:py-10 ${bleed ? "max-sm:px-0 max-sm:py-0" : ""}`} style={{ "--page-bg": browserThemeColor } as React.CSSProperties}>
      <JsonLd data={personStructuredData} />
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
          memberTier={memberTier}
          plan={plan}
          visitorAction={canInitiateConnection ? <ConnectFlow
            username={username}
            mode={slug}
            source={query.source ?? "direct"}
            registered={Boolean(userId)}
            shareBackModes={shareBackModes}
            guestSessionName={guestSessionName}
            alreadyConnected={Boolean(connectedState?.connection_id)}
            label={slug === "event" && typeof mode.settings.eventName === "string" && mode.settings.eventName.trim() ? `Connect at ${mode.settings.eventName.trim()}` : "Connect"}
            accent={resolveModeAccent(mode)}
          /> : undefined}
        />
        {sharedPassportStamp && <aside aria-label="A Passport stamp they chose to share" className="mt-4 flex items-center gap-4 rounded-[24px] border border-black/10 bg-white/85 p-4 shadow-sm">
          <PassportStamp type={sharedPassportStamp.type} title={sharedPassportStamp.title} subtitle={sharedPassportStamp.subtitle} status="earned" rotationKey={`${sharedPassportStamp.type}:${sharedPassportStamp.title}:${sharedPassportStamp.countryCode ?? ""}`} />
          <div className="min-w-0"><p className="font-label text-[9px] font-semibold tracking-[0.16em] text-black/45">A PASSPORT MARK THEY CHOSE TO SHARE</p><p className="mt-1 break-words text-sm font-semibold">{publicPassportStampTitle(sharedPassportStamp)}</p>{sharedPassportStamp.subtitle && <p className="mt-1 line-clamp-2 text-xs leading-5 text-black/55">{sharedPassportStamp.subtitle}</p>}</div>
        </aside>}
        <p className={`mt-5 text-center font-label text-[10px] tracking-wide text-black/40 ${bleed ? `max-sm:mt-0 max-sm:pb-8 ${pageTone.dark ? "max-sm:text-white/40" : ""}` : ""}`}>Your identity, your context. Shared with Setuvara.</p>
      </div>
    </main>
  );
}

function publicPassportStampTitle(stamp: { type: PassportStampType; title: string; countryCode: string | null }) {
  if (stamp.type !== "country" || !stamp.countryCode) return stamp.title;
  try { return new Intl.DisplayNames(["en"], { type: "region" }).of(stamp.countryCode) ?? stamp.title; }
  catch { return stamp.title; }
}
