import "server-only";

import { inkOnAccent, resolveModeAccent } from "@/components/profile/appearance";
import { BOOKING_PROVIDERS, profileTone } from "@/components/profile/appearance-theme";
import { readFocus } from "@/components/profile/photo-focus";
import type { ModeSlug, ProfileMode } from "@/components/profile/types";
import { ctaFor } from "@/lib/actions/model";
import { getPublicActions } from "@/lib/actions/public";
import { memberTierForPlan } from "@/lib/billing/member-badge";
import type { PlanCode } from "@/lib/billing/catalog";
import { getUserBillingState } from "@/lib/billing/service";
import { readableBlocks, selectBlocks } from "@/lib/blocks/registry";
import { getPublicStore } from "@/lib/commerce/public";
import { isWorkBlock, workItem } from "@/lib/creator/studio";
import { providerForLink } from "@/lib/links/providers";
import { getPublishedPublicMode, publicProfileTitle, publicSetting, type SeoPublicProfileRecord } from "@/lib/seo/public-profile";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { createPublicProfileImageUrl } from "@/lib/supabase/public-profile-image-url";
import { createClient } from "@/lib/supabase/server";
import type { CardMoment, CardPhoneSection, SocialCardData } from "./card";
import { fetchCardImage } from "./images";

/** When a Mode has nothing of its own to say yet. Written about the page, never naming the Mode. */
const FALLBACK_LEDE: Record<ModeSlug, string> = {
  personal: "Photo, music and the people they keep. Open it, then Connect.",
  event: "Here for this moment. Connect now and leave with names that stay.",
  business: "Who they are, what they do, and the fastest way to reach them.",
  creator: "Work, products and collabs, all under one name.",
};

type LinkRow = { title: string | null; link_type: string };

function clean(value: string | null | undefined, limit: number) {
  const text = (value ?? "").normalize("NFC").replace(/\s+/g, " ").trim();
  const points = Array.from(text);
  return points.length > limit ? `${points.slice(0, limit - 1).join("").trimEnd()}…` : text;
}

const join = (...parts: (string | null | undefined)[]) => parts.filter((part): part is string => Boolean(part)).join(" · ");

function linkTitle(link: LinkRow) {
  return clean(link.title, 40) || providerForLink(link.link_type).name;
}

/**
 * Everything the card needs, read the way a visitor reads the page: only a published identity
 * and an enabled Mode, through the request client and its public rules. Optional pieces (photo,
 * links, Actions, work, store, Live Context) fail soft, so the card always renders.
 */
export async function loadSocialCard(
  username: string,
  slug: ModeSlug,
  options: { displayUrl: string; handle?: string },
): Promise<SocialCardData | null> {
  const record = await getPublishedPublicMode(username, slug);
  if (!record) return null;
  const { profile, mode } = record;
  const get = (key: string, limit = 120) => publicSetting(mode, key, limit);

  const supabase = await createClient();
  const [plan, links, live, actions, blocks] = await Promise.all([
    getUserBillingState(profile.id).then((state) => state?.plan ?? "free" as PlanCode).catch(() => "free" as PlanCode),
    Promise.resolve(supabase.from("profile_links").select("title, link_type").eq("profile_id", profile.id).eq("mode_id", mode.id).eq("is_visible", true).order("sort_order").limit(12))
      .then(({ data }) => (data ?? []) as LinkRow[]).catch(() => [] as LinkRow[]),
    Promise.resolve(supabase.rpc("get_public_live_context", { p_username: username }))
      .then(({ data }) => {
        const row = Array.isArray(data) ? data[0] as { label?: string; expires_at?: string } | undefined : undefined;
        return row?.label && row.expires_at && Date.parse(row.expires_at) > Date.now() ? clean(row.label, 60) : null;
      }).catch(() => null),
    getPublicActions(username, slug).catch(() => []),
    slug === "creator"
      ? selectBlocks("id, kind, data, is_visible, sort_order", (columns) => supabase.from("profile_blocks").select(columns).eq("profile_id", profile.id).eq("mode_id", mode.id).eq("is_visible", true).order("sort_order"))
        .then(({ data }) => readableBlocks(data as unknown[] | null)).catch(() => [])
      : Promise.resolve([]),
  ]);

  const name = clean(publicProfileTitle(profile), 48);
  const first = clean(name.replace(/^@/, "").split(/\s+/)[0], 14) || profile.username;
  const handle = `@${options.handle ?? profile.username}`;
  const appearanceMode = { slug, appearance: mode.appearance as ProfileMode["appearance"] };
  const accent = resolveModeAccent(appearanceMode);
  const tone = profileTone(appearanceMode, plan);

  // Creator's work is its image and video blocks; the store is read only when there is one to show.
  const work = blocks.filter(isWorkBlock).map(workItem);
  const store = slug === "creator" ? await getPublicStore(username).catch(() => []) : [];

  const origin = getSupabaseConfig()?.url ? new URL(getSupabaseConfig()!.url).origin : null;
  const signed = (path: string | null) => (path && origin ? createPublicProfileImageUrl(supabase, path).catch(() => null) : Promise.resolve(null));
  const picture = async (path: string | null, width: number, height: number) => {
    const url = await signed(path);
    return url && origin ? fetchCardImage(url, origin, width, height) : null;
  };
  const workPaths = work.slice(0, 3).map((item) => {
    const block = blocks.find((candidate) => candidate.id === item.id);
    const path = block?.data.image_path;
    return { title: clean(item.title, 18), path: typeof path === "string" ? path : null };
  });
  const [photo, ...tiles] = await Promise.all([
    picture(mode.image_path, 640, 800),
    ...workPaths.map((item) => picture(item.path, 240, 240)),
  ]);

  const booking = slug === "business" ? links.find((link) => BOOKING_PROVIDERS.includes(link.link_type)) : undefined;
  const firstAction = actions[0]?.action;

  const moment: CardMoment = live
    ? { title: "Here now", sub: live, tag: "LIVE" }
    : firstAction
      ? { title: clean(firstAction.title, 34) || ctaFor(firstAction), sub: clean(firstAction.intro, 60) || ctaFor(firstAction), tag: "OPEN" }
      : booking
        ? { title: "Book a call", sub: linkTitle(booking), tag: null }
        : slug === "event" && get("eventName")
          ? { title: clean(get("eventName"), 34), sub: join(get("dateLabel", 40), get("city", 40)) || "Connect while you’re here", tag: null }
          : slug === "creator" && store.length
            ? { title: store.length === 1 ? "New in the store" : `${store.length} in the store`, sub: clean(store[0].title, 60), tag: null }
            : slug === "creator" && work.length
              ? { title: work.length === 1 ? "New work" : `${work.length} pieces of work`, sub: join(...work.slice(0, 3).map((item) => clean(item.title, 20))), tag: null }
              : { title: `Connect with ${first}`, sub: join(handle, get("location", 40) ?? get("city", 40)), tag: null };

  return {
    mode: slug,
    eyebrow: eyebrowFor(record) || null,
    headline: name,
    lede: clean(ledeFor(record), 150) || FALLBACK_LEDE[slug],
    url: options.displayUrl,
    corner: cornerFor(record, handle, work.length),
    word: first,
    rail: "dots",
    moment,
    phone: {
      name,
      line: roleLine(record) || null,
      handle,
      photo,
      focus: readFocus(mode.image_focus_x, mode.image_focus_y),
      initials: name.replace(/^@/, "").split(/\s+/).map((part) => Array.from(part)[0] ?? "").slice(0, 2).join("").toUpperCase(),
      accent,
      accentInk: inkOnAccent(accent),
      base: tone.bg,
      dark: tone.dark,
      cta: "Connect",
      tier: memberTierForPlan(plan),
      pill: live
        ? { text: live, live: true }
        : slug === "event" && get("eventName") ? { text: join(get("eventName", 40), get("dateLabel", 30)), live: false } : null,
      section: sectionFor(record, links, work.length ? workPaths.map((item, index) => ({ src: tiles[index] ?? null, title: item.title })) : []),
    },
  };
}

/** The phone's line under the name, as ProfileRenderer's identity line builds it. */
function roleLine({ mode }: SeoPublicProfileRecord) {
  const get = (key: string) => publicSetting(mode, key, 60);
  if (mode.slug === "event") return join(get("role"), get("city"));
  if (mode.slug === "business") return join(get("role"), get("company"), get("city"));
  if (mode.slug === "creator") return join(get("category"), get("city"));
  return join(get("location"), get("pronouns"));
}

function eyebrowFor({ mode }: SeoPublicProfileRecord) {
  const get = (key: string) => publicSetting(mode, key, 40);
  if (mode.slug === "event") return clean(join(get("eventName"), get("dateLabel")), 48);
  if (mode.slug === "business") return clean(get("company") ?? get("role"), 48);
  if (mode.slug === "creator") return clean(join(get("category"), get("city")), 48);
  return clean(get("location"), 48);
}

function ledeFor({ profile, mode }: SeoPublicProfileRecord) {
  const get = (key: string) => publicSetting(mode, key, 280);
  if (mode.slug === "event") return get("hereToMeet") ?? get("note");
  if (mode.slug === "business") return get("description") ?? join(get("role"), get("company"));
  if (mode.slug === "creator") return get("tagline");
  return profile.bio ?? get("note");
}

function cornerFor({ mode }: SeoPublicProfileRecord, handle: string, workCount: number) {
  const city = publicSetting(mode, mode.slug === "personal" ? "location" : "city", 30);
  if (mode.slug === "creator" && workCount > 1) return `${workCount} WORKS`;
  return clean(mode.slug === "personal" ? handle : city ?? handle, 30).toUpperCase();
}

function sectionFor({ profile, mode }: SeoPublicProfileRecord, links: LinkRow[], tiles: { src: string | null; title: string }[]): CardPhoneSection | null {
  const titles = links.filter((link) => !BOOKING_PROVIDERS.includes(link.link_type) && !["email", "phone"].includes(link.link_type)).map(linkTitle);
  const chips = titles.length ? { kind: "chips" as const, items: titles.slice(0, 3) } : null;
  if (mode.slug === "creator") return tiles.some((tile) => tile.src) ? { kind: "tiles", items: tiles } : chips;
  if (mode.slug === "business") return titles.length ? { kind: "rows", items: titles.slice(0, 3) } : null;
  if (mode.slug === "event") {
    // The card's lede already carries "Here to meet", so the phone shows the links when there are any.
    const meet = publicSetting(mode, "hereToMeet", 160);
    return chips ?? (meet ? { kind: "note", label: "Here to meet", text: meet } : null);
  }
  const about = profile.bio?.trim();
  return chips ?? (about ? { kind: "note", label: "About", text: clean(about, 160) } : null);
}
