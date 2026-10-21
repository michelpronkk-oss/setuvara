import type { Metadata, Viewport } from "next";
import { after } from "next/server";
import { notFound } from "next/navigation";
import { cookies, headers } from "next/headers";
import { cache } from "react";

import { marketingFontClasses } from "@/app/(marketing)/fonts";
import { connectChatEnabled } from "@/lib/chat/launch";
import { nameFontClasses } from "@/components/profile/name-fonts";
import { ConnectFlow } from "@/components/connections/connect-flow";
import { ProfileRenderer } from "@/components/profile/profile-renderer";
import { ProfileStage } from "@/components/profile/profile-stage";
import { profileTone, resolvedBrowserThemeColor } from "@/components/profile/appearance-theme";
import { extraSlideLimit, inkOnAccent, resolveModeAccent, resolveAppearance } from "@/components/profile/appearance";
import { ActionCards } from "@/components/actions/action-card";
import { CreatorSections } from "@/components/creator/creator-sections";
import { getPublicActions } from "@/lib/actions/public";
import { PublicBuilder } from "@/components/builder/public-builder";
import { PublicTestimonials } from "@/components/business/public-testimonials";
import { getPublicTestimonials } from "@/lib/business/public";
import { getBuilderActivity, getPublicBuilder } from "@/lib/builder/public";
import { getPublicStore } from "@/lib/commerce/public";
import { lockedPieces } from "@/lib/creator/fan-drops";
import { isWorkBlock, readCreatorSettings, workItem } from "@/lib/creator/studio";
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
import { liveModeHandle } from "@/lib/handles/mode-server";
import { OwnerBar, OwnerConnect } from "@/components/profile/owner-view";

export type PublicProfileTarget = {
  username: string;
  slug: ModeSlug;
  /** Set when the page was opened through an opaque Mode share locator (or a handle, for its sub-pages). */
  shareToken?: string;
  /** Set when the page was opened through a live Business or Creator handle. */
  handle?: string;
  /** The owner chose to let search engines list this handle. */
  indexable?: boolean;
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

function publicPageUrls({ username, slug, shareToken, handle }: PublicProfileTarget) {
  // A Mode handle or share page points at itself, never at the username or a predictable Mode URL.
  if (handle) return { pageUrl: `https://setuvara.com/${handle}`, image: `https://setuvara.com/og/h/${handle}` };
  const pageUrl = shareToken
    ? `https://setuvara.com/s/${shareToken}`
    : `https://setuvara.com/${encodeURIComponent(username)}`;
  const image = shareToken
    ? `https://setuvara.com/og/s/${shareToken}`
    : `https://setuvara.com/og/profile/${encodeURIComponent(username)}/${slug}`;
  return { pageUrl, image };
}

const indexed: Metadata["robots"] = { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large" } };

export async function publicProfileMetadata(target: PublicProfileTarget): Promise<Metadata> {
  const { username, slug, shareToken, handle, indexable } = target;
  const record = await getPublishedPublicMode(username, slug);
  if (!record) notFound();
  // A /s/ link to a Mode that also has a live handle names the handle as canonical (still unlisted).
  const liveHandle = shareToken && !handle ? await liveModeHandle(record.profile.id, slug) : null;

  const title = publicProfileTitle(record.profile);
  const description = publicProfileDescription(record);
  const { pageUrl, image: imageBase } = publicPageUrls(target);
  // Platforms cache a card by its URL. The edit time in the query makes a changed photo or name
  // show on the next share instead of the stale card.
  const edited = Math.max(...[record.profile.updated_at, record.mode.updated_at].map((value) => (value ? Date.parse(value) : 0)).filter(Number.isFinite), 0);
  const image = edited ? `${imageBase}?v=${Math.floor(edited / 1000).toString(36)}` : imageBase;
  const imageAlt = `${title} on Setuvara`;

  return {
    title,
    description,
    // The Personal username URL is indexed (publishing is the opt-in, as the Privacy policy says).
    // A Business or Creator handle is indexed only when its owner turned search listing on.
    // Pages behind /s/<token> are private links: never indexed or followed.
    ...(handle
      ? { alternates: { canonical: pageUrl }, robots: indexable ? indexed : { index: false, follow: false } }
      : shareToken
        ? { ...(liveHandle ? { alternates: { canonical: `https://setuvara.com/${liveHandle}` } } : {}), robots: { index: false, follow: false } }
        : { alternates: { canonical: pageUrl }, robots: indexed }),
    openGraph: {
      type: "profile",
      ...(handle ? { username: handle } : shareToken ? {} : { username }),
      siteName: "Setuvara",
      locale: "en_US",
      title: `${title} | Setuvara`,
      description,
      url: pageUrl,
      images: [{ url: image, width: 1200, height: 630, alt: imageAlt, type: "image/png" }],
    },
    twitter: { card: "summary_large_image", title: `${title} | Setuvara`, description, images: [{ url: image, alt: imageAlt }] },
  };
}

export async function PublicProfilePage({ target, source: rawSource }: { target: PublicProfileTarget; source?: string }) {
  const { username, slug, shareToken, handle, indexable } = target;
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
    shareBackModes = (availableModes ?? []).filter((item) => ["personal", "event", "business", "creator"].includes(item.slug)).map((item) => ({ slug: item.slug as ModeSlug, label: item.label }));
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
  // Creator pages lead with the work: image and video blocks become Featured and Selected work.
  const creator = slug === "creator";
  const creatorOffers = creator ? await getPublicStore(username).catch(() => []) : [];
  // Fan-only pieces this viewer can't open yet, decided in the database for this viewer.
  const lockedWork = creator && !owner
    ? lockedPieces((await supabase.rpc("get_creator_public_summary", { p_username: username })).data, (profile.display_name || username).split(/\s+/)[0])
    : [];
  // Every Mode can carry Actions; Creator places them among its own sections.
  const modeActions = await getPublicActions(username, slug);
  const testimonials = slug === "business" ? await getPublicTestimonials(username) : [];
  // Builder Showcase: public projects on Creator and Business, their images taken from this Mode's own blocks.
  const projects = await getPublicBuilder(username, slug);
  // Voting and ideas are for real visitor pages only; the owner's own view and previews stay read-only.
  const builderViewer = projects.length && !owner ? {
    signedIn: Boolean(userId),
    loginHref: `/login?next=${encodeURIComponent(shareToken ? `/s/${shareToken}` : `/${handle ?? username}`)}`,
    activity: userId ? await getBuilderActivity(projects.map((project) => project.id)) : {},
  } : undefined;
  const blockImages: Record<string, string | null> = Object.fromEntries(publicBlocks.map((block) => [block.id, typeof (block.data as Record<string, unknown>).image_url === "string" ? (block.data as Record<string, unknown>).image_url as string : null]));
  const actionHref = owner ? undefined
    : shareToken ? (id: string) => `/s/${shareToken}/a/${id}`
      : slug === "personal" ? (id: string) => `/${username}/a/${id}` : undefined;
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
    blocks: creator ? publicBlocks.filter((block) => !isWorkBlock(block)) : publicBlocks,
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
      alternateName: `@${handle ?? profile.username}`,
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
      {(handle ? indexable : !shareToken) && <JsonLd data={personStructuredData} />}
      {owner && <OwnerBar editHref={`/app/identity?mode=${slug}`} shareHref={`/app/identity?mode=${slug}&section=share`} />}
      <ProfileStage accent={resolveModeAccent(mode)} base={pageTone.bg} dark={pageTone.dark} photo={imageUrl}>
        <ProfileRenderer
          attribution
          className="min-h-dvh"
          edgeToEdge
          footer={creator || modeActions.length || testimonials.length || projects.length || sharedPassportStamp ? (<>
            {creator && <CreatorSections
              accent={resolveModeAccent(mode)}
              accentInk={inkOnAccent(resolveModeAccent(mode))}
              actionHref={actionHref}
              productHref={owner || !shareToken ? undefined : (id) => `/s/${shareToken}/p/${id}`}
              actions={modeActions}
              offers={creatorOffers}
              settings={readCreatorSettings(rawMode.settings as Record<string, unknown>)}
              work={publicBlocks.filter(isWorkBlock).map(workItem)}
              locked={lockedWork}
            />}
            {!creator && <ActionCards accent={resolveModeAccent(mode)} accentInk={inkOnAccent(resolveModeAccent(mode))} actionHref={actionHref} actions={modeActions} />}
            <PublicBuilder accent={resolveModeAccent(mode)} accentInk={inkOnAccent(resolveModeAccent(mode))} actionHref={actionHref} actions={modeActions.map((item) => item.action)} images={blockImages} projects={projects} viewer={builderViewer} />
            <PublicTestimonials accent={resolveModeAccent(mode)} items={testimonials} />
            {sharedPassportStamp && (
            <aside aria-label="A Passport stamp they chose to share" className="flex items-center gap-4 rounded-[var(--sv-card-r,16px)] p-4" style={{ boxShadow: "inset 0 0 0 1px color-mix(in srgb, currentColor 14%, transparent)" }}>
              <PassportRecordStamp size={116} stamp={{ id: `${sharedPassportStamp.type}:${sharedPassportStamp.title}:${sharedPassportStamp.countryCode ?? ""}`, type: sharedPassportStamp.type, title: sharedPassportStamp.title, subtitle: sharedPassportStamp.subtitle, countryCode: sharedPassportStamp.countryCode, earnedAt: "" }} />
              <div className="min-w-0"><p className="font-label text-[9px] font-semibold tracking-[0.16em] opacity-60">A PASSPORT MARK THEY CHOSE TO SHARE</p><p className="mt-1 break-words text-sm font-semibold">{publicPassportStampTitle(sharedPassportStamp)}</p>{sharedPassportStamp.subtitle && <p className="mt-1 line-clamp-2 text-xs leading-5 opacity-65">{sharedPassportStamp.subtitle}</p>}</div>
            </aside>
            )}
          </>) : undefined}
          profile={identity}
          mode={mode}
          viewerState={viewerState}
          previewAsVisitor={owner}
          selectedRewards={Object.fromEntries((publicCosmetics ?? []).map((item) => [item.category, item.reward_id]))}
          connectionContext={connectedState?.context as ConnectionContext | undefined}
          connectionHref={connectedState?.connection_id ? (isGuestSession ? `/connections/${connectedState.connection_id}` : `/app/connections/${connectedState.connection_id}`) : undefined}
          messageHref={connectChatEnabled() && userId && connectedState?.connection_id && !owner && !isGuestSession
            ? `/app/connections/messages?connection=${connectedState.connection_id}` : undefined}
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
