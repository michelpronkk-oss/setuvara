import type { Metadata, Viewport } from "next";
import { after } from "next/server";
import { notFound } from "next/navigation";
import { cookies, headers } from "next/headers";
import { cache } from "react";

import { marketingFontClasses } from "@/app/(marketing)/fonts";
import { nameFontClasses } from "@/components/profile/name-fonts";
import { ConnectFlow } from "@/components/connections/connect-flow";
import { ProfileRenderer } from "@/components/profile/profile-renderer";
import { ProfileStage } from "@/components/profile/profile-stage";
import { profileTone, resolvedBrowserThemeColor } from "@/components/profile/appearance-theme";
import { extraSlideLimit, resolveModeAccent, resolveAppearance } from "@/components/profile/appearance";
import { getMessages } from "@/lib/i18n/messages";
import type { ConnectionContext, ModeSlug, ProfileIdentity, ProfileLink, ProfileMode, PublicLiveContext } from "@/components/profile/types";
import { readableBlocks, selectBlocks } from "@/lib/blocks/registry";
import { visitorPassCookie } from "@/lib/connections/access";
import { memberTierForPlan } from "@/lib/billing/member-badge";
import type { PlanCode } from "@/lib/billing/catalog";
import { PassportRecordStamp, type PassportStampType } from "@/components/passport/passport-stamp";
import { JsonLd } from "@/components/seo/json-ld";
import { getUserBillingState } from "@/lib/billing/service";
import { classifyAnalyticsDevice, isAnalyticsMode, isAnalyticsSource, recordProductAnalyticsEvent } from "@/lib/analytics/events";
import { recordSitePageView } from "@/lib/analytics/site";
import { getPublishedPublicMode, publicProfileDescription, publicProfileTitle, publicSetting, safePublicHttpUrl } from "@/lib/seo/public-profile";
import { createClient } from "@/lib/supabase/server";
import { createPublicProfileImageUrl } from "@/lib/supabase/public-profile-image-url";
import { parseSlidePhotos, signSlidePhotos } from "@/lib/app/slides";
import { isAllowedUsername } from "@/lib/usernames";
import { OwnerBar, OwnerConnect } from "@/components/profile/owner-view";

export type PublicProfileTarget = {
  username: string;
  slug: ModeSlug;
  /** Set when the page was opened through an opaque Mode share locator. */
  shareToken?: string;
};

const FALLBACK_BROWSER_THEME_COLOR = "#F5F4EF";

export const readPublicProfileMode = cache(async (username: string, slug: ModeSlug) => {
  const publicRecord = await getPublishedPublicMode(username, slug);
  if (!publicRecord) return null;

  try {
    const billing = await getUserBillingState(publicRecord.profile.id).catch(() => null);
    return { ...publicRecord, plan: billing?.plan ?? "free" as PlanCode };
  } catch {
    return null;
  }
});

export async function publicProfileViewport(target: PublicProfileTarget | null): Promise<Viewport> {
  const record = target && isAllowedUsername(target.username)
    ? await readPublicProfileMode(target.username, target.slug)
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

function publicPageUrls({ username, slug, shareToken }: PublicProfileTarget) {
  // A Mode share page points at itself, never at a predictable Mode URL.
  const pageUrl = shareToken
    ? `https://setuvara.com/s/${shareToken}`
    : `https://setuvara.com/${encodeURIComponent(username)}`;
  const image = shareToken
    ? `https://setuvara.com/og/s/${shareToken}`
    : `https://setuvara.com/og/profile/${encodeURIComponent(username)}/${slug}`;
  return { pageUrl, image };
}

export async function publicProfileMetadata(target: PublicProfileTarget): Promise<Metadata> {
  const { username, slug, shareToken } = target;
  const record = await getPublishedPublicMode(username, slug);
  if (!record) notFound();

  const title = publicProfileTitle(record.profile);
  const description = publicProfileDescription(record);
  const { pageUrl, image } = publicPageUrls(target);

  return {
    title,
    description,
    // Only the Personal username URL can be indexed (publishing is the opt-in, as the Privacy policy
    // says). Event and Business pages behind /s/<token> are private links: never indexed or followed.
    ...(shareToken
      ? { robots: { index: false, follow: false } }
      : { alternates: { canonical: pageUrl }, robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large" } } }),
    openGraph: {
      type: "profile",
      ...(shareToken ? {} : { username }),
      siteName: "Setuvara",
      locale: "en_US",
      title: `${title} | Setuvara`,
      description,
      url: pageUrl,
      images: [{ url: image, width: 1200, height: 630, alt: `${title} on Setuvara` }],
    },
    twitter: { card: "summary_large_image", title: `${title} | Setuvara`, description, images: [image] },
  };
}

export async function PublicProfilePage({ target, source: rawSource }: { target: PublicProfileTarget; source?: string }) {
  const { username, slug, shareToken } = target;
  if (!isAllowedUsername(username)) notFound();
  const query = { source: rawSource };

  const record = await readPublicProfileMode(username, slug);
  if (!record) notFound();
  const { profile, mode: rawMode, plan } = record;
  const supabase = await createClient();

  const [{ data: publicCosmetics }, { data: links, error: linksError }, { data: passportHighlight }, { data: liveContextRows }] = await Promise.all([
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
    // Only the label, type and expiry of a currently effective Live Context are public.
    supabase.rpc("get_public_live_context", { p_username: username }),
  ]);
  const liveRow = Array.isArray(liveContextRows) ? liveContextRows[0] as { context_type?: string; label?: string; expires_at?: string } | undefined : undefined;
  const liveContext: PublicLiveContext | null = liveRow?.label && liveRow.expires_at && ["event", "meeting", "place", "custom"].includes(liveRow.context_type ?? "")
    ? { label: liveRow.label, type: liveRow.context_type as PublicLiveContext["type"], expiresAt: liveRow.expires_at }
    : null;
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

  // The saved 4:5 photo (share cards, the sound gate) and the kept original every hero frames from.
  const [savedImage, originalImage] = await Promise.all([
    rawMode.image_path ? createPublicProfileImageUrl(supabase, rawMode.image_path) : Promise.resolve(null),
    rawMode.image_path && rawMode.image_original_path ? createPublicProfileImageUrl(supabase, rawMode.image_original_path) : Promise.resolve(null),
  ]);
  const imageUrl = savedImage;
  const imageOriginalUrl = imageUrl ? originalImage : null;

  // Only the slides the owner's plan shows are signed (Plus 1, Pro 3 after the main photo).
  const slideUrls = imageUrl ? await signSlidePhotos(supabase, parseSlidePhotos(rawMode.slide_photos), extraSlideLimit(plan), (path) => createPublicProfileImageUrl(supabase, path)) : [];

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
        // Site traffic counts the view too, with the edge country, but without the profile.
        await recordSitePageView("profile", requestHeaders);
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
      typeof imagePath === "string" ? createPublicProfileImageUrl(supabase, imagePath) : Promise.resolve(null),
      typeof videoPath === "string" ? supabase.storage.from("profile-media").createSignedUrl(videoPath, 3600) : Promise.resolve({ data: null }),
    ]);
    return {
      ...block,
      data: {
        ...data,
        ...(typeof imagePath === "string" ? { image_url: image } : {}),
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
    image_original_url: imageOriginalUrl,
    image_crop: rawMode.image_crop as ProfileMode["image_crop"],
    slide_photos: undefined,
    slide_urls: slideUrls,
    links: (links ?? []) as ProfileLink[],
    blocks: publicBlocks,
  };
  const { pageUrl: canonicalUrl, image: previewImageUrl } = publicPageUrls(target);
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
  const modified = [profile.updated_at, rawMode.updated_at]
    .map((value) => (value ? new Date(value) : null))
    .filter((value): value is Date => Boolean(value && Number.isFinite(value.getTime())))
    .sort((a, b) => b.getTime() - a.getTime())[0];
  // Google reads a member page as a ProfilePage about one Person.
  const personStructuredData: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    url: canonicalUrl,
    ...(modified ? { dateModified: modified.toISOString() } : {}),
    mainEntity: {
      "@type": "Person",
      name: publicProfileTitle(profile),
      alternateName: `@${profile.username}`,
      url: canonicalUrl,
      ...(imageUrl ? { image: previewImageUrl } : {}),
      ...(publicRole ? { jobTitle: publicRole } : {}),
      ...(publicCompany ? { worksFor: { "@type": "Organization", name: publicCompany } } : {}),
      ...(sameAs.length ? { sameAs } : {}),
    },
  };

  // The profile is the page: it fills the window and the browser chrome takes on its background.
  const pageTone = profileTone(mode, plan);
  const browserThemeColor = resolvedBrowserThemeColor(mode, plan);
  const resolvedLook = resolveAppearance(mode, plan);
  const copy = getMessages("en").profile;
  const sharedPassportStamp = passportHighlight && typeof passportHighlight === "object"
    ? passportHighlight as { type: PassportStampType; title: string; subtitle: string | null; countryCode: string | null }
    : null;

  return (
    <main data-public-profile-surface="true" data-public-profile-appearance={resolvedLook.id} className={`${marketingFontClasses} ${nameFontClasses} min-h-dvh bg-[var(--page-bg)] font-brand`} style={{ "--page-bg": browserThemeColor, colorScheme: pageTone.dark ? "dark" : "light" } as React.CSSProperties}>
      {!shareToken && <JsonLd data={personStructuredData} />}
      {owner && <OwnerBar editHref={`/app/identity?mode=${slug}`} shareHref={`/app/identity?mode=${slug}&section=share`} />}
      <ProfileStage accent={resolveModeAccent(mode)} base={pageTone.bg} dark={pageTone.dark} photo={imageUrl}>
        <ProfileRenderer
          attribution
          className="min-h-dvh"
          edgeToEdge
          footer={sharedPassportStamp ? (
            <aside aria-label="A Passport stamp they chose to share" className="flex items-center gap-4 rounded-[var(--sv-card-r,16px)] p-4" style={{ boxShadow: "inset 0 0 0 1px color-mix(in srgb, currentColor 14%, transparent)" }}>
              <PassportRecordStamp size={116} stamp={{ id: `${sharedPassportStamp.type}:${sharedPassportStamp.title}:${sharedPassportStamp.countryCode ?? ""}`, type: sharedPassportStamp.type, title: sharedPassportStamp.title, subtitle: sharedPassportStamp.subtitle, countryCode: sharedPassportStamp.countryCode, earnedAt: "" }} />
              <div className="min-w-0"><p className="font-label text-[9px] font-semibold tracking-[0.16em] opacity-60">A PASSPORT MARK THEY CHOSE TO SHARE</p><p className="mt-1 break-words text-sm font-semibold">{publicPassportStampTitle(sharedPassportStamp)}</p>{sharedPassportStamp.subtitle && <p className="mt-1 line-clamp-2 text-xs leading-5 opacity-65">{sharedPassportStamp.subtitle}</p>}</div>
            </aside>
          ) : undefined}
          profile={identity}
          mode={mode}
          viewerState={viewerState}
          previewAsVisitor={owner}
          selectedRewards={Object.fromEntries((publicCosmetics ?? []).map((item) => [item.category, item.reward_id]))}
          connectionContext={connectedState?.context as ConnectionContext | undefined}
          connectionHref={connectedState?.connection_id ? (isGuestSession ? `/connections/${connectedState.connection_id}` : `/app/connections/${connectedState.connection_id}`) : undefined}
          guestClaimHref={isGuestSession ? "/signup?claim=1" : undefined}
          memberTier={memberTier}
          plan={plan}
          liveContext={liveContext}
          sound="live"
          visitorAction={owner ? ((mode.connect_policy ?? "anyone") === "anyone" ? <OwnerConnect label={copy.connect} /> : undefined) : canInitiateConnection ? <ConnectFlow
            username={username}
            mode={slug}
            source={query.source ?? "direct"}
            registered={Boolean(userId)}
            shareBackModes={shareBackModes}
            guestSessionName={guestSessionName}
            alreadyConnected={Boolean(connectedState?.connection_id)}
            label={copy.connect}
            accent={resolveModeAccent(mode)}
          /> : undefined}
        />
      </ProfileStage>
    </main>
  );
}

function publicPassportStampTitle(stamp: { type: PassportStampType; title: string; countryCode: string | null }) {
  if (stamp.type !== "country" || !stamp.countryCode) return stamp.title;
  try { return new Intl.DisplayNames(["en"], { type: "region" }).of(stamp.countryCode) ?? stamp.title; }
  catch { return stamp.title; }
}
