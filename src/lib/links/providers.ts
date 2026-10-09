import {
  siApplemusic, siBehance, siBluesky, siCalendly, siDiscord, siDribbble, siDropbox,
  siFacebook, siGitlab, siGithub, siGoogledrive, siInstagram, siKick, siMastodon,
  siMedium, siMessenger, siNotion, siPatreon, siPinterest, siPlaystation, siProducthunt,
  siSignal, siSnapchat, siSoundcloud, siSpotify, siSteam, siSubstack, siTelegram,
  siThreads, siTiktok, siTwitch, siWhatsapp, siX, siYoutube,
} from "simple-icons";
import type { SimpleIcon } from "simple-icons";

/** simple-icons no longer ships LinkedIn; this is its standard mark. */
const linkedinIcon = {
  title: "LinkedIn",
  slug: "linkedin",
  hex: "0A66C2",
  source: "https://brand.linkedin.com",
  svg: "",
  path: "M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z",
} as SimpleIcon;
import { z } from "zod";

export type LinkCategory = "Social" | "Professional & tech" | "Creator & content" | "Messaging & contact" | "Business & actions" | "Work & resources" | "Community & gaming" | "Event & location" | "Custom";
export type LinkInputKind = "handle" | "username" | "url" | "email" | "phone";
export type LinkMode = "personal" | "event" | "business";
type Strategy = "handle" | "url" | "domain" | "email" | "phone" | "whatsapp" | "sms" | "telegram" | "discord" | "linkedin" | "spotify" | "youtube" | "mastodon";

export type LinkProvider = {
  id: string;
  name: string;
  category: LinkCategory;
  inputKind: LinkInputKind;
  placeholder: string;
  defaultLabel: string;
  keywords: string[];
  suggestions: LinkMode[];
  instructions?: string;
  strategy: Strategy;
  icon?: SimpleIcon;
  hostname?: string;
  aliases?: string[];
  pathPrefix?: string;
  handlePrefix?: string;
  pathPattern?: RegExp;
};

const providerList = [
  // Social
  { id: "instagram", name: "Instagram", category: "Social", inputKind: "handle", placeholder: "@username", defaultLabel: "Instagram", keywords: ["photo", "social"], suggestions: ["personal", "event"], strategy: "handle", hostname: "instagram.com", aliases: ["www.instagram.com"], icon: siInstagram },
  { id: "tiktok", name: "TikTok", category: "Social", inputKind: "handle", placeholder: "@username", defaultLabel: "TikTok", keywords: ["video", "social"], suggestions: ["personal"], strategy: "handle", hostname: "tiktok.com", aliases: ["www.tiktok.com"], pathPrefix: "@", handlePrefix: "@", icon: siTiktok },
  { id: "x", name: "X", category: "Social", inputKind: "handle", placeholder: "@username", defaultLabel: "X", keywords: ["twitter", "social"], suggestions: ["personal", "event"], strategy: "handle", hostname: "x.com", aliases: ["www.x.com", "twitter.com", "www.twitter.com"], icon: siX },
  { id: "threads", name: "Threads", category: "Social", inputKind: "handle", placeholder: "@username", defaultLabel: "Threads", keywords: ["instagram", "social"], suggestions: ["personal"], strategy: "handle", hostname: "threads.net", aliases: ["www.threads.net"], icon: siThreads },
  { id: "facebook", name: "Facebook", category: "Social", inputKind: "handle", placeholder: "username or page name", defaultLabel: "Facebook", keywords: ["meta", "social"], suggestions: ["personal"], strategy: "handle", hostname: "facebook.com", aliases: ["www.facebook.com"], icon: siFacebook },
  { id: "snapchat", name: "Snapchat", category: "Social", inputKind: "username", placeholder: "username", defaultLabel: "Snapchat", keywords: ["social"], suggestions: ["personal"], strategy: "handle", hostname: "www.snapchat.com", aliases: ["snapchat.com"], pathPrefix: "/add/", icon: siSnapchat },
  { id: "pinterest", name: "Pinterest", category: "Social", inputKind: "handle", placeholder: "username", defaultLabel: "Pinterest", keywords: ["pins", "social"], suggestions: ["personal"], strategy: "handle", hostname: "pinterest.com", aliases: ["www.pinterest.com"], icon: siPinterest },
  { id: "bluesky", name: "Bluesky", category: "Social", inputKind: "handle", placeholder: "name.bsky.social", defaultLabel: "Bluesky", keywords: ["social"], suggestions: ["personal"], strategy: "handle", hostname: "bsky.app", aliases: ["www.bsky.app"], pathPrefix: "/profile/", icon: siBluesky },
  { id: "mastodon", name: "Mastodon", category: "Social", inputKind: "url", placeholder: "https://mastodon.social/@username", defaultLabel: "Mastodon", keywords: ["fediverse", "social"], suggestions: ["personal"], strategy: "mastodon", icon: siMastodon },
  // Professional and technology
  { id: "linkedin", name: "LinkedIn", category: "Professional & tech", inputKind: "url", placeholder: "https://linkedin.com/in/your-name", defaultLabel: "LinkedIn", keywords: ["work", "professional"], suggestions: ["event", "business"], strategy: "linkedin", hostname: "linkedin.com", aliases: ["www.linkedin.com"], pathPattern: /^\/(in|company|school|pub)\/[A-Za-z0-9_%.-]+(?:\/.*)?$/i, icon: linkedinIcon },
  { id: "github", name: "GitHub", category: "Professional & tech", inputKind: "handle", placeholder: "username", defaultLabel: "GitHub", keywords: ["code", "developer"], suggestions: ["business"], strategy: "handle", hostname: "github.com", aliases: ["www.github.com"], icon: siGithub },
  { id: "gitlab", name: "GitLab", category: "Professional & tech", inputKind: "handle", placeholder: "username", defaultLabel: "GitLab", keywords: ["code", "developer"], suggestions: [], strategy: "handle", hostname: "gitlab.com", aliases: ["www.gitlab.com"], icon: siGitlab },
  { id: "behance", name: "Behance", category: "Professional & tech", inputKind: "handle", placeholder: "username", defaultLabel: "Behance", keywords: ["design", "creative"], suggestions: [], strategy: "handle", hostname: "behance.net", aliases: ["www.behance.net"], icon: siBehance },
  { id: "dribbble", name: "Dribbble", category: "Professional & tech", inputKind: "handle", placeholder: "username", defaultLabel: "Dribbble", keywords: ["design", "creative"], suggestions: [], strategy: "handle", hostname: "dribbble.com", aliases: ["www.dribbble.com"], icon: siDribbble },
  { id: "product_hunt", name: "Product Hunt", category: "Professional & tech", inputKind: "url", placeholder: "Product or maker profile URL", defaultLabel: "Product Hunt", keywords: ["startup", "launch"], suggestions: ["business"], strategy: "url", hostname: "producthunt.com", aliases: ["www.producthunt.com"], pathPattern: /^\/(?:@[A-Za-z0-9_-]+|products\/[A-Za-z0-9_-]+)(?:\/.*)?$/i, icon: siProducthunt },
  { id: "wellfound", name: "Wellfound", category: "Professional & tech", inputKind: "url", placeholder: "https://wellfound.com/...", defaultLabel: "Wellfound", keywords: ["angel list", "startup", "jobs"], suggestions: ["business"], strategy: "url", hostname: "wellfound.com", aliases: ["www.wellfound.com"], icon: undefined },
  // Creator and content
  { id: "youtube", name: "YouTube", category: "Creator & content", inputKind: "url", placeholder: "@channel or channel URL", defaultLabel: "YouTube", keywords: ["video", "creator"], suggestions: ["personal"], strategy: "youtube", hostname: "youtube.com", aliases: ["www.youtube.com", "m.youtube.com", "youtu.be"], icon: siYoutube },
  { id: "twitch", name: "Twitch", category: "Creator & content", inputKind: "handle", placeholder: "username", defaultLabel: "Twitch", keywords: ["stream", "gaming"], suggestions: ["personal"], strategy: "handle", hostname: "twitch.tv", aliases: ["www.twitch.tv"], icon: siTwitch },
  { id: "kick", name: "Kick", category: "Creator & content", inputKind: "handle", placeholder: "username", defaultLabel: "Kick", keywords: ["stream", "gaming"], suggestions: ["personal"], strategy: "handle", hostname: "kick.com", aliases: ["www.kick.com"], icon: siKick },
  { id: "spotify", name: "Spotify", category: "Creator & content", inputKind: "url", placeholder: "Spotify profile, artist, or playlist URL", defaultLabel: "Spotify", keywords: ["music", "audio"], suggestions: ["personal"], strategy: "spotify", hostname: "open.spotify.com", icon: siSpotify },
  { id: "apple_music", name: "Apple Music", category: "Creator & content", inputKind: "url", placeholder: "Apple Music profile or playlist URL", defaultLabel: "Apple Music", keywords: ["music", "audio"], suggestions: ["personal"], strategy: "url", hostname: "music.apple.com", icon: siApplemusic },
  { id: "soundcloud", name: "SoundCloud", category: "Creator & content", inputKind: "handle", placeholder: "username", defaultLabel: "SoundCloud", keywords: ["music", "audio"], suggestions: ["personal"], strategy: "handle", hostname: "soundcloud.com", aliases: ["www.soundcloud.com"], icon: siSoundcloud },
  { id: "medium", name: "Medium", category: "Creator & content", inputKind: "handle", placeholder: "@username", defaultLabel: "Medium", keywords: ["writing", "blog"], suggestions: [], strategy: "handle", hostname: "medium.com", aliases: ["www.medium.com"], pathPrefix: "@", handlePrefix: "@", icon: siMedium },
  { id: "substack", name: "Substack", category: "Creator & content", inputKind: "url", placeholder: "Your publication URL", defaultLabel: "Substack", keywords: ["newsletter", "writing"], suggestions: [], strategy: "url", hostname: "substack.com", aliases: ["www.substack.com"], icon: siSubstack },
  { id: "patreon", name: "Patreon", category: "Creator & content", inputKind: "handle", placeholder: "creator name", defaultLabel: "Patreon", keywords: ["creator", "membership"], suggestions: [], strategy: "handle", hostname: "patreon.com", aliases: ["www.patreon.com"], icon: siPatreon },
  // Messaging and contact
  { id: "whatsapp", name: "WhatsApp", category: "Messaging & contact", inputKind: "phone", placeholder: "+31 6 12345678", defaultLabel: "WhatsApp", keywords: ["message", "chat", "phone"], suggestions: ["personal", "event"], instructions: "Use a full international number, including the + country code.", strategy: "whatsapp", hostname: "wa.me", icon: siWhatsapp },
  { id: "telegram", name: "Telegram", category: "Messaging & contact", inputKind: "handle", placeholder: "@username", defaultLabel: "Telegram", keywords: ["message", "chat"], suggestions: ["personal"], strategy: "telegram", hostname: "t.me", icon: siTelegram },
  { id: "discord", name: "Discord", category: "Messaging & contact", inputKind: "url", placeholder: "Discord invite URL", defaultLabel: "Discord", keywords: ["community", "chat"], suggestions: [], strategy: "discord", icon: siDiscord },
  { id: "messenger", name: "Messenger", category: "Messaging & contact", inputKind: "handle", placeholder: "username", defaultLabel: "Messenger", keywords: ["facebook", "chat"], suggestions: [], strategy: "handle", hostname: "m.me", aliases: ["www.m.me"], icon: siMessenger },
  { id: "signal", name: "Signal", category: "Messaging & contact", inputKind: "url", placeholder: "Signal profile or invite URL", defaultLabel: "Signal", keywords: ["message", "chat"], suggestions: [], strategy: "url", hostname: "signal.me", aliases: ["www.signal.me"], icon: siSignal },
  { id: "email", name: "Email", category: "Messaging & contact", inputKind: "email", placeholder: "hello@example.com", defaultLabel: "Email me", keywords: ["contact", "mail"], suggestions: ["business"], strategy: "email" },
  { id: "phone", name: "Phone", category: "Messaging & contact", inputKind: "phone", placeholder: "+31 20 123 4567", defaultLabel: "Call me", keywords: ["call", "contact"], suggestions: ["business"], strategy: "phone" },
  { id: "sms", name: "SMS", category: "Messaging & contact", inputKind: "phone", placeholder: "+31 6 12345678", defaultLabel: "Text me", keywords: ["message", "text", "contact"], suggestions: [], strategy: "sms" },
  // Business actions
  { id: "website", name: "Website", category: "Business & actions", inputKind: "url", placeholder: "example.com", defaultLabel: "Visit website", keywords: ["site", "web"], suggestions: ["personal"], strategy: "domain" },
  { id: "company_website", name: "Company Website", category: "Business & actions", inputKind: "url", placeholder: "company.com", defaultLabel: "Company website", keywords: ["work", "site", "web"], suggestions: ["business"], strategy: "domain" },
  { id: "calendly", name: "Calendly", category: "Business & actions", inputKind: "url", placeholder: "username or Calendly URL", defaultLabel: "Book a meeting", keywords: ["booking", "schedule", "meeting"], suggestions: ["business"], strategy: "url", hostname: "calendly.com", aliases: ["www.calendly.com"], pathPrefix: "/", icon: siCalendly },
  { id: "cal_com", name: "Cal.com", category: "Business & actions", inputKind: "url", placeholder: "username or Cal.com URL", defaultLabel: "Book a meeting", keywords: ["booking", "schedule", "meeting", "cal"], suggestions: ["business"], strategy: "url", hostname: "cal.com", aliases: ["www.cal.com"] },
  { id: "booking_link", name: "Booking Link", category: "Business & actions", inputKind: "url", placeholder: "https://…", defaultLabel: "Book a meeting", keywords: ["booking", "schedule", "meeting", "calendly", "cal.com"], suggestions: ["business"], strategy: "url" },
  { id: "demo_request", name: "Demo Request", category: "Business & actions", inputKind: "url", placeholder: "https://…", defaultLabel: "Request a demo", keywords: ["sales", "product"], suggestions: ["business"], strategy: "url" },
  { id: "contact_form", name: "Contact Form", category: "Business & actions", inputKind: "url", placeholder: "https://…", defaultLabel: "Contact", keywords: ["contact", "form"], suggestions: ["business"], strategy: "url" },
  { id: "shop", name: "Shop / Store", category: "Business & actions", inputKind: "url", placeholder: "https://…", defaultLabel: "Shop", keywords: ["store", "products"], suggestions: ["business"], strategy: "url" },
  { id: "pricing", name: "Pricing", category: "Business & actions", inputKind: "url", placeholder: "https://…", defaultLabel: "View pricing", keywords: ["plans", "rates"], suggestions: ["business"], strategy: "url" },
  { id: "menu", name: "Menu", category: "Business & actions", inputKind: "url", placeholder: "https://…", defaultLabel: "View menu", keywords: ["restaurant", "food"], suggestions: ["business"], strategy: "url" },
  // Work and resources
  { id: "portfolio", name: "Portfolio", category: "Work & resources", inputKind: "url", placeholder: "https://…", defaultLabel: "View portfolio", keywords: ["work", "creative"], suggestions: ["event", "business"], strategy: "url" },
  { id: "resume", name: "Resume / CV", category: "Work & resources", inputKind: "url", placeholder: "PDF or document URL", defaultLabel: "View my CV", keywords: ["resume", "cv", "work"], suggestions: ["business"], strategy: "url" },
  { id: "pitch_deck", name: "Pitch Deck", category: "Work & resources", inputKind: "url", placeholder: "https://…", defaultLabel: "View pitch deck", keywords: ["startup", "presentation"], suggestions: ["business"], strategy: "url" },
  { id: "media_kit", name: "Media Kit", category: "Work & resources", inputKind: "url", placeholder: "https://…", defaultLabel: "Media kit", keywords: ["press", "creator"], suggestions: ["business"], strategy: "url" },
  { id: "notion", name: "Notion", category: "Work & resources", inputKind: "url", placeholder: "Notion page URL", defaultLabel: "Open Notion", keywords: ["notes", "document"], suggestions: [], strategy: "url", hostname: "notion.site", aliases: ["www.notion.so", "notion.so"], icon: siNotion },
  { id: "google_drive", name: "Google Drive / Docs", category: "Work & resources", inputKind: "url", placeholder: "Google Drive or Docs URL", defaultLabel: "Open document", keywords: ["google", "docs", "file"], suggestions: [], strategy: "url", hostname: "drive.google.com", aliases: ["docs.google.com"], icon: siGoogledrive },
  { id: "dropbox", name: "Dropbox", category: "Work & resources", inputKind: "url", placeholder: "Dropbox share URL", defaultLabel: "Open Dropbox", keywords: ["file", "document"], suggestions: [], strategy: "url", hostname: "dropbox.com", aliases: ["www.dropbox.com", "dl.dropboxusercontent.com"], icon: siDropbox },
  { id: "document", name: "PDF / Document", category: "Work & resources", inputKind: "url", placeholder: "Document URL", defaultLabel: "Open document", keywords: ["file", "pdf", "resource"], suggestions: [], strategy: "url" },
  // Community and gaming
  { id: "steam", name: "Steam", category: "Community & gaming", inputKind: "url", placeholder: "https://steamcommunity.com/id/...", defaultLabel: "Steam", keywords: ["gaming", "community"], suggestions: [], strategy: "url", hostname: "steamcommunity.com", aliases: ["www.steamcommunity.com"], pathPattern: /^\/(?:id|profiles)\/[A-Za-z0-9_-]+(?:\/.*)?$/i, icon: siSteam },
  { id: "playstation", name: "PlayStation", category: "Community & gaming", inputKind: "url", placeholder: "PlayStation profile URL", defaultLabel: "PlayStation", keywords: ["gaming", "psn"], suggestions: [], strategy: "url", hostname: "playstation.com", aliases: ["www.playstation.com"], icon: siPlaystation },
  { id: "xbox", name: "Xbox", category: "Community & gaming", inputKind: "url", placeholder: "Xbox profile URL", defaultLabel: "Xbox", keywords: ["gaming", "gamertag"], suggestions: [], strategy: "url", hostname: "xbox.com", aliases: ["www.xbox.com"] },
  // Event and location
  { id: "google_maps", name: "Google Maps", category: "Event & location", inputKind: "url", placeholder: "Google Maps place URL", defaultLabel: "Open in Maps", keywords: ["location", "directions", "map"], suggestions: [], strategy: "url", hostname: "maps.google.com", aliases: ["www.google.com", "maps.app.goo.gl"], icon: undefined },
  { id: "event_page", name: "Event Page", category: "Event & location", inputKind: "url", placeholder: "https://…", defaultLabel: "Event details", keywords: ["conference", "meetup"], suggestions: ["event"], strategy: "url" },
  { id: "ticket_page", name: "Ticket Page", category: "Event & location", inputKind: "url", placeholder: "https://…", defaultLabel: "Get tickets", keywords: ["event", "tickets"], suggestions: ["event"], strategy: "url" },
  { id: "schedule", name: "Schedule", category: "Event & location", inputKind: "url", placeholder: "https://…", defaultLabel: "View schedule", keywords: ["event", "agenda", "program"], suggestions: ["event"], strategy: "url" },
  { id: "booth_location", name: "Booth / Location Page", category: "Event & location", inputKind: "url", placeholder: "https://…", defaultLabel: "Find me here", keywords: ["event", "map", "booth"], suggestions: ["event"], strategy: "url" },
  // Stable legacy aliases preserve links created by previous Setuvara versions.
  { id: "url", name: "Custom Link", category: "Custom", inputKind: "url", placeholder: "example.com", defaultLabel: "Custom link", keywords: ["website", "link", "custom"], suggestions: ["personal", "event", "business"], strategy: "domain" },
  { id: "calendar", name: "Calendar link", category: "Business & actions", inputKind: "url", placeholder: "https://…", defaultLabel: "Book a meeting", keywords: ["booking", "schedule", "legacy"], suggestions: [], strategy: "url" },
] as const satisfies readonly LinkProvider[];

export const LINK_PROVIDERS: readonly LinkProvider[] = providerList;
export const LINK_PROVIDER_IDS = LINK_PROVIDERS.map((provider) => provider.id) as [string, ...string[]];
export const linkProviderSchema = z.enum(LINK_PROVIDER_IDS);
export type LinkProviderId = (typeof providerList)[number]["id"];
export const linkProviderById = Object.fromEntries(LINK_PROVIDERS.map((provider) => [provider.id, provider])) as Record<LinkProviderId, LinkProvider>;
export const LINK_CATEGORIES: readonly LinkCategory[] = ["Social", "Professional & tech", "Creator & content", "Messaging & contact", "Business & actions", "Work & resources", "Community & gaming", "Event & location", "Custom"];
export const MODE_LINK_SUGGESTIONS: Record<LinkMode, readonly LinkProviderId[]> = {
  personal: ["instagram", "tiktok", "youtube", "spotify", "whatsapp", "snapchat", "x", "threads", "twitch", "kick", "url"],
  event: ["linkedin", "instagram", "x", "whatsapp", "website", "event_page", "schedule", "ticket_page", "portfolio"],
  business: ["linkedin", "company_website", "email", "phone", "calendly", "cal_com", "github", "portfolio", "pitch_deck", "media_kit", "demo_request"],
};

export const linkInputPayloadSchema = z.object({
  providerId: linkProviderSchema,
  value: z.string().trim().min(1, "Add a username, address, or link." ).max(2048, "That value is too long."),
}).superRefine(({ providerId, value }, context) => {
  const result = normalizeProviderValue(providerId, value);
  if (!result.ok) context.addIssue({ code: "custom", path: ["value"], message: result.message });
});

export type NormalizedProviderValue = { url: string; displayValue: string; canonicalValue: string };
export type NormalizeResult = { ok: true; data: NormalizedProviderValue } | { ok: false; message: string };

function normalizeInputUrl(value: string): URL | null {
  const trimmed = value.trim();
  if (!trimmed || /^(?:javascript|data|file|vbscript|mailto|tel|sms):/i.test(trimmed)) return null;
  let candidate = trimmed;
  if (!/^[a-z][a-z\d+.-]*:/i.test(candidate)) {
    if (!/^(?:www\.)?(?:[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?\.)+[a-z]{2,}(?::\d{1,5})?(?:[/?#][^\s]*)?$/i.test(candidate)) return null;
    candidate = `https://${candidate}`;
  }
  try {
    const url = new URL(candidate);
    if (!new Set(["http:", "https:"]).has(url.protocol) || url.username || url.password || !validHostname(url.hostname)) return null;
    url.hash = "";
    if (url.protocol === "http:" && !url.hostname.endsWith(".localhost")) url.protocol = "https:";
    return url;
  } catch {
    return null;
  }
}

function validHostname(hostname: string) {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  return host.length <= 253 && host.includes(".") && host.split(".").every((label) => label.length > 0 && label.length <= 63 && /^[a-z\d](?:[a-z\d-]*[a-z\d])?$/i.test(label)) && /\.[a-z]{2,}$/i.test(host);
}

function hostMatches(url: URL, provider: LinkProvider) {
  const allowed = [provider.hostname, ...(provider.aliases ?? [])].filter(Boolean).map((host) => host!.toLowerCase());
  return allowed.length === 0 || allowed.includes(url.hostname.toLowerCase());
}

function fromProviderUrl(provider: LinkProvider, value: string, requirePath?: RegExp): URL | null {
  const url = normalizeInputUrl(value);
  if (!url || !hostMatches(url, provider) || (requirePath && !requirePath.test(url.pathname)) || (provider.pathPattern && !provider.pathPattern.test(url.pathname))) return null;
  if (provider.id === "tiktok" && !/^\/@[A-Za-z0-9._]+(?:\/.*)?$/.test(url.pathname)) return null;
  return url;
}

function normalizeInternationalPhone(value: string) {
  let raw = value.trim().replace(/^(?:tel|sms):/i, "");
  if (raw.startsWith("00")) raw = `+${raw.slice(2)}`;
  if (!raw.startsWith("+")) return null;
  const digits = raw.slice(1).replace(/[\s().-]/g, "");
  return /^[1-9]\d{7,14}$/.test(digits) ? `+${digits}` : null;
}

function normalizeEmail(value: string) {
  const email = value.trim().replace(/^mailto:/i, "");
  if (email.length > 254 || !/^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?)+$/i.test(email)) return null;
  return email;
}

function normalizeHandle(provider: LinkProvider, value: string) {
  let handle = value.trim();
  if (/^[a-z][a-z\d+.-]*:/i.test(handle) || /(?:^|\s)(?:[a-z\d-]+\.)+[a-z]{2,}(?:[/:?#]|$)/i.test(handle)) {
    const url = fromProviderUrl(provider, handle);
    if (!url) return null;
    const pathSegments = url.pathname.split("/").filter(Boolean);
    if (provider.id === "bluesky") {
      if (pathSegments.length !== 2 || pathSegments[0] !== "profile") return null;
    } else if (provider.id === "snapchat") {
      if (pathSegments.length !== 2 || pathSegments[0] !== "add") return null;
    } else if (pathSegments.length !== 1) return null;
    try { handle = decodeURIComponent(url.pathname.split("/").filter(Boolean).at(-1) ?? ""); }
    catch { return null; }
  }
  if (provider.handlePrefix && handle.startsWith(provider.handlePrefix)) handle = handle.slice(provider.handlePrefix.length);
  if (handle.startsWith("@") && provider.id !== "bluesky") handle = handle.slice(1);
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/.test(handle)) return null;
  return handle;
}

export function normalizeProviderValue(providerId: string, rawValue: string): NormalizeResult {
  const provider = LINK_PROVIDERS.find((item) => item.id === providerId);
  if (!provider) return { ok: false, message: "Choose a supported link type." };
  const input = rawValue.trim();
  const fail = (): NormalizeResult => ({ ok: false, message: inputMessage(provider) });

  if (provider.strategy === "email") {
    const email = normalizeEmail(input);
    return email ? { ok: true, data: { url: `mailto:${email}`, canonicalValue: email, displayValue: email } } : fail();
  }
  if (provider.strategy === "phone" || provider.strategy === "sms" || provider.strategy === "whatsapp") {
    let phone = normalizeInternationalPhone(input);
    if (!phone && provider.strategy === "whatsapp" && /^https?:/i.test(input)) {
      const url = fromProviderUrl(provider, input);
      const digits = url?.pathname.replace(/^\//, "");
      if (digits && /^[1-9]\d{7,14}$/.test(digits)) phone = `+${digits}`;
    }
    if (!phone) return fail();
    const digits = phone.slice(1);
    const url = provider.strategy === "whatsapp" ? `https://wa.me/${digits}` : `${provider.strategy === "phone" ? "tel" : "sms"}:${phone}`;
    return { ok: true, data: { url, canonicalValue: phone, displayValue: phone } };
  }
  if (provider.strategy === "handle") {
    const handle = normalizeHandle(provider, input);
    if (!handle || !provider.hostname) return fail();
    const path = provider.pathPrefix
      ? `${provider.pathPrefix.startsWith("/") ? provider.pathPrefix : `/${provider.pathPrefix}`}${encodeURIComponent(handle)}`
      : `/${encodeURIComponent(handle)}`;
    const base = provider.id === "bluesky" ? "https://bsky.app/profile/" : `https://${provider.hostname}`;
    const canonical = provider.id === "bluesky" ? `${base}${encodeURIComponent(handle)}` : `${base}${path}`;
    const shown = provider.id === "tiktok" || provider.id === "threads" || provider.id === "x" ? `@${handle}` : handle;
    return { ok: true, data: { url: canonical, canonicalValue: shown, displayValue: shown } };
  }
  if (provider.strategy === "telegram") {
    let handle = input;
    if (/^[a-z][a-z\d+.-]*:/i.test(input) || /(?:^|\s)(?:[a-z\d-]+\.)+[a-z]{2,}(?:[/:?#]|$)/i.test(input)) {
      const url = fromProviderUrl(provider, input);
      if (!url || !/^\/[A-Za-z0-9_]{5,32}\/?$/.test(url.pathname)) return fail();
      handle = url.pathname.replace(/^\//, "").replace(/\/$/, "");
    }
    handle = handle.replace(/^@/, "");
    if (!/^[A-Za-z0-9_]{5,32}$/.test(handle)) return fail();
    return { ok: true, data: { url: `https://t.me/${handle}`, canonicalValue: `@${handle}`, displayValue: `@${handle}` } };
  }
  if (provider.strategy === "discord") {
    const url = fromProviderUrl({ ...provider, hostname: "discord.gg", aliases: ["discord.com", "www.discord.com"] }, input, /^\/(?:invite\/)?[A-Za-z0-9-]{2,}(?:\/)?$/i);
    if (!url) return fail();
    const code = url.pathname.split("/").filter(Boolean).at(-1);
    if (!code || ["invite"].includes(code.toLowerCase())) return fail();
    return { ok: true, data: { url: `https://discord.gg/${encodeURIComponent(code)}`, canonicalValue: `discord.gg/${code}`, displayValue: `discord.gg/${code}` } };
  }
  if (provider.strategy === "linkedin") {
    const url = fromProviderUrl(provider, input);
    if (!url) return fail();
    return { ok: true, data: { url: url.toString(), canonicalValue: url.toString(), displayValue: url.pathname.replace(/\/$/, "") } };
  }
  if (provider.strategy === "spotify") {
    const url = fromProviderUrl(provider, input, /^\/(?:user|artist|album|track|playlist|show|episode|genre|collection)(?:\/|$)/i);
    if (!url) return fail();
    return { ok: true, data: { url: url.toString(), canonicalValue: url.toString(), displayValue: url.pathname.split("/").filter(Boolean).slice(0, 2).join(" / ") } };
  }
  if (provider.strategy === "youtube") {
    if (/^@?[A-Za-z0-9._-]{3,30}$/.test(input) && !/[/:?#]/.test(input)) {
      const handle = input.replace(/^@/, "");
      return { ok: true, data: { url: `https://youtube.com/@${encodeURIComponent(handle)}`, canonicalValue: `@${handle}`, displayValue: `@${handle}` } };
    }
    const url = fromProviderUrl(provider, input);
    if (!url) return fail();
    if (url.hostname === "youtu.be") {
      if (!/^\/[A-Za-z0-9_-]{6,}$/.test(url.pathname)) return fail();
    } else if (!/^\/(?:@[^/]+|channel\/[^/]+|c\/[^/]+|user\/[^/]+)(?:\/.*)?$/i.test(url.pathname)) return fail();
    return { ok: true, data: { url: url.toString(), canonicalValue: url.pathname.replace(/\/$/, ""), displayValue: url.pathname.replace(/\/$/, "") } };
  }
  if (provider.strategy === "mastodon") {
    const url = normalizeInputUrl(input);
    if (!url || !/^\/@[A-Za-z0-9_.-]+(?:\/\d+)?\/?$/.test(url.pathname)) return fail();
    return { ok: true, data: { url: url.toString(), canonicalValue: url.toString(), displayValue: `${url.hostname}${url.pathname.replace(/\/$/, "")}` } };
  }

  if (provider.id === "google_maps") {
    const url = fromProviderUrl(provider, input);
    if (!url) return fail();
    if (url.hostname === "www.google.com" && !/^\/maps(?:\/|$)/i.test(url.pathname)) return fail();
    if (url.pathname === "/") return fail();
    return { ok: true, data: { url: url.toString(), canonicalValue: url.toString(), displayValue: `${url.hostname}${url.pathname}` } };
  }

  if ((provider.id === "calendly" || provider.id === "cal_com") && !/[./:?]/.test(input)) {
    const handle = input.replace(/^@/, "");
    if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/.test(handle)) return fail();
    const host = provider.id === "calendly" ? "calendly.com" : "cal.com";
    return { ok: true, data: { url: `https://${host}/${encodeURIComponent(handle)}`, canonicalValue: handle, displayValue: `${host}/${handle}` } };
  }

  const url = fromProviderUrl(provider, input);
  if (!url) return fail();
  return { ok: true, data: { url: url.toString(), canonicalValue: url.toString(), displayValue: `${url.hostname}${url.pathname === "/" ? "" : url.pathname}` } };
}

function inputMessage(provider: LinkProvider) {
  switch (provider.strategy) {
    case "handle": return `Enter a ${provider.name} username or profile URL.`;
    case "email": return "Enter a valid email address.";
    case "phone": case "sms": case "whatsapp": return "Use a complete international phone number, for example +31 6 12345678.";
    case "linkedin": return "Enter a LinkedIn profile or company URL.";
    case "telegram": return "Enter a Telegram username or t.me link.";
    case "discord": return "Enter a Discord invite URL.";
    case "spotify": return "Enter a Spotify profile, artist, or playlist URL.";
    case "youtube": return "Enter a YouTube channel handle or channel URL.";
    case "mastodon": return "Enter a Mastodon profile URL, including its server.";
    default: return `Enter a valid ${provider.name} URL or domain.`;
  }
}

export function normalizeLinkPayload(input: { providerId: string; value: string }) {
  const parsed = linkInputPayloadSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, message: parsed.error.issues[0]?.message ?? "Check this link and try again." };
  return normalizeProviderValue(parsed.data.providerId, parsed.data.value);
}

export function resolveStoredLink(providerId: string, url: string): NormalizedProviderValue | null {
  const provider = LINK_PROVIDERS.find((item) => item.id === providerId);
  if (!provider) return null;
  const result = normalizeProviderValue(provider.id, url);
  return result.ok ? result.data : null;
}

export function providerSearchText(provider: LinkProvider) {
  return [provider.name, provider.id.replaceAll("_", " "), ...provider.keywords].join(" ").toLocaleLowerCase();
}

export function providerForLink(providerId: string) {
  return LINK_PROVIDERS.find((provider) => provider.id === providerId) ?? linkProviderById.url;
}

/**
 * Best provider for a pasted value: email and phone by shape, otherwise the
 * provider whose domain matches and accepts the link. Unknown sites become
 * a Website link.
 */
export function detectProvider(rawValue: string): { provider: LinkProvider; value: string } | null {
  const value = rawValue.trim();
  if (!value) return null;
  if (/^(mailto:)?[^\s@/:]+@[^\s@/]+\.[^\s@/]+$/i.test(value)) return { provider: linkProviderById.email, value: value.replace(/^mailto:/i, "") };
  if (/^(tel:)?\+?[\d\s().-]{8,20}$/.test(value)) return { provider: linkProviderById.phone, value: value.replace(/^tel:/i, "") };
  let host: string;
  try {
    host = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`).hostname.toLowerCase();
  } catch {
    return null;
  }
  if (!host.includes(".")) return null;
  const match = LINK_PROVIDERS.find((provider) => {
    const hosts = [provider.hostname, ...(provider.aliases ?? [])].filter(Boolean) as string[];
    return hosts.some((candidate) => host === candidate || host === `www.${candidate}`) && normalizeProviderValue(provider.id, value).ok;
  });
  return { provider: match ?? linkProviderById.website, value };
}
