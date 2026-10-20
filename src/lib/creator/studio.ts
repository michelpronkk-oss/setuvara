import type { ProfileBlock, ProfileLink } from "@/components/profile/types";
import { parseVideo } from "@/lib/blocks/media";
import type { CreatorOffer } from "./types";

/** Creator page sections, in their default order. A section left out of settings.sections is hidden. */
export const CREATOR_SECTIONS = ["featured", "work", "store", "collabs"] as const;
export type CreatorSection = (typeof CREATOR_SECTIONS)[number];
export const SECTION_NAMES: Record<CreatorSection, string> = { featured: "Featured", work: "Work", store: "Store", collabs: "Collabs" };

export type CreatorSettings = {
  tagline: string;
  category: string;
  city: string;
  /** Visible sections, in order. */
  sections: CreatorSection[];
  collabsOpen: boolean;
  collabsNote: string;
  collabsPitch: string;
};

/** Mirrors the profile_modes settings check for slug = 'creator'. */
export const CREATOR_SETTING_LIMITS = { tagline: 280, category: 80, city: 80, collabsNote: 120, collabsPitch: 280 } as const;

export function readCreatorSettings(settings: Record<string, unknown> | null | undefined): CreatorSettings {
  const s = settings ?? {};
  const str = (key: string) => (typeof s[key] === "string" ? (s[key] as string) : "");
  const listed = typeof s.sections === "string"
    ? s.sections.split(",").filter((item): item is CreatorSection => (CREATOR_SECTIONS as readonly string[]).includes(item))
    : [...CREATOR_SECTIONS];
  return {
    tagline: str("tagline"),
    category: str("category"),
    city: str("city"),
    sections: [...new Set(listed)],
    collabsOpen: s.collabsOpen === true,
    collabsNote: str("collabsNote"),
    collabsPitch: str("collabsPitch"),
  };
}

/** The settings object to store, keeping every Creator key the database accepts. */
export function writeCreatorSettings(next: CreatorSettings): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = { sections: next.sections.join(","), collabsOpen: next.collabsOpen };
  for (const key of ["tagline", "category", "city", "collabsNote", "collabsPitch"] as const) {
    const value = next[key].trim().slice(0, CREATOR_SETTING_LIMITS[key]);
    if (value) out[key] = value;
  }
  return out;
}

// ------------------------------------------------------------------ Work

/** Work is Creator Mode's image and video blocks. Other blocks keep rendering as page content. */
export const WORK_KINDS = ["image", "video"] as const;
export const isWorkBlock = (block: Pick<ProfileBlock, "kind">) => (WORK_KINDS as readonly string[]).includes(block.kind);

export type WorkItem = {
  id: string;
  kind: "image" | "video";
  title: string;
  credit: string;
  collection: string;
  featured: boolean;
  visible: boolean;
  /** A playable or viewable image for the card, when there is one. */
  imageUrl: string | null;
  /** Provider link for provider videos. */
  url: string | null;
  videoUrl: string | null;
};

export function workItem(block: ProfileBlock): WorkItem {
  const data = block.data as Record<string, unknown>;
  const str = (key: string) => (typeof data[key] === "string" ? (data[key] as string) : "");
  const kind = block.kind === "video" ? "video" : "image";
  return {
    id: block.id,
    kind,
    title: str("title") || (kind === "image" ? str("caption") : "") || (kind === "video" ? "Untitled film" : "Untitled"),
    credit: str("credit"),
    collection: str("collection"),
    featured: data.featured === true,
    visible: block.is_visible,
    imageUrl: str("image_url") || str("thumbnail") || (kind === "video" ? parseVideo(str("url"))?.thumbnail ?? null : null),
    url: str("url") || null,
    videoUrl: str("video_url") || null,
  };
}

export function collectionsOf(items: WorkItem[]) {
  const counts = new Map<string, number>();
  for (const item of items) if (item.collection) counts.set(item.collection, (counts.get(item.collection) ?? 0) + 1);
  return [...counts.entries()].map(([name, count]) => ({ name, count }));
}

// ------------------------------------------------------------------ Store

export const OFFER_TYPES = ["digital", "booking", "physical", "service", "external"] as const;
export type OfferType = (typeof OFFER_TYPES)[number];
export const OFFER_TYPE_LABEL: Record<OfferType, string> = { digital: "Digital", booking: "Booking", physical: "Physical", service: "Service", external: "External ↗" };
export const OFFER_TYPE_TINT: Record<OfferType, string> = { digital: "#E8E2D4", booking: "#E6DCFF", physical: "#DCEBFF", service: "#E6E4DC", external: "#FFE7B8" };

export type StoreOffer = Pick<CreatorOffer, "id" | "kind" | "title" | "description" | "currency" | "unit_amount_minor" | "status"> & {
  offer_type: OfferType;
  external_url: string | null;
  sort_order: number;
};

export function formatMoney(amountMinor: number, currency: string, options: { compact?: boolean } = {}) {
  try {
    return new Intl.NumberFormat("en-IE", { style: "currency", currency, maximumFractionDigits: amountMinor % 100 === 0 || options.compact ? 0 : 2 }).format(amountMinor / 100);
  } catch {
    return `${(amountMinor / 100).toFixed(2)} ${currency}`;
  }
}

/** Euro-first: the creator types a price, we store minor units. */
export function parseMoney(value: string): number | null {
  const clean = value.replace(/[^\d.,]/g, "").replace(/,(?=\d{3}\b)/g, "").replace(",", ".");
  if (!clean) return null;
  const amount = Math.round(Number(clean) * 100);
  return Number.isSafeInteger(amount) && amount > 0 && amount <= 100_000_000_000 ? amount : null;
}

// ------------------------------------------------------------------ Collabs

export const INQUIRY_KINDS = ["campaign", "commission", "licensing", "speaking"] as const;
export type InquiryKind = (typeof INQUIRY_KINDS)[number];
export const INQUIRY_KIND_LABEL: Record<InquiryKind, string> = { campaign: "Campaign", commission: "Commission", licensing: "Licensing", speaking: "Speaking" };

export const INQUIRY_BUDGETS = ["under_2k", "2k_5k", "5k_10k", "10k_plus", "unsure"] as const;
export type InquiryBudget = (typeof INQUIRY_BUDGETS)[number];
export const INQUIRY_BUDGET_LABEL: Record<InquiryBudget, string> = { under_2k: "< €2K", "2k_5k": "€2–5K", "5k_10k": "€5–10K", "10k_plus": "€10K+", unsure: "Not sure" };

export const INQUIRY_STATUSES = ["new", "in_talks", "booked", "delivered", "declined"] as const;
export type InquiryStatus = (typeof INQUIRY_STATUSES)[number];
export const INQUIRY_STATUS_LABEL: Record<InquiryStatus, string> = { new: "New", in_talks: "In talks", booked: "Booked", delivered: "Delivered", declined: "Declined" };
/** Pill colours from the design: coral new, lilac in talks, ink booked. */
export const INQUIRY_STATUS_TONE: Record<InquiryStatus, { bg: string; fg: string }> = {
  new: { bg: "#FF5A4F", fg: "#0D0D0D" },
  in_talks: { bg: "#B79CFF", fg: "#0D0D0D" },
  booked: { bg: "#0D0D0D", fg: "#F5F4EF" },
  delivered: { bg: "#C7FF4A", fg: "#0D0D0D" },
  declined: { bg: "#E6E4DC", fg: "#0D0D0D" },
};

export type Inquiry = {
  id: string;
  sender_user_id: string;
  sender_mode_slug: "personal" | "event" | "business" | "creator";
  sender_display_name: string;
  kind: InquiryKind;
  budget: InquiryBudget;
  brand: string;
  message: string;
  status: InquiryStatus;
  created_at: string;
};

// ------------------------------------------------------------------ Platforms

/** Platforms the Creator design shows with audience numbers once platform sign-in ships. */
export const CREATOR_PLATFORMS = ["instagram", "tiktok", "youtube", "twitch", "x"] as const;
export type CreatorPlatform = (typeof CREATOR_PLATFORMS)[number];
export const PLATFORM_NAME: Record<CreatorPlatform, string> = { instagram: "Instagram", tiktok: "TikTok", youtube: "YouTube", twitch: "Twitch", x: "X" };
export const PLATFORM_BG: Record<CreatorPlatform, string> = { instagram: "linear-gradient(45deg,#F9CE34,#EE2A7B 50%,#6228D7)", tiktok: "#000000", youtube: "#FF0000", twitch: "#9146FF", x: "#000000" };

export type PlatformAccount = { platform: CreatorPlatform; link: ProfileLink | null; handle: string };

/** Each platform with the Creator link that points at it, if any. Handles come from the link itself. */
export function platformAccounts(links: ProfileLink[]): PlatformAccount[] {
  return CREATOR_PLATFORMS.map((platform) => {
    const link = links.find((item) => item.link_type === platform) ?? null;
    return { platform, link, handle: link ? handleFromUrl(link.url) || link.title : "" };
  });
}

export function handleFromUrl(url: string) {
  try {
    const parsed = new URL(url);
    const first = parsed.pathname.split("/").filter(Boolean)[0] ?? "";
    if (!first) return "";
    return first.startsWith("@") ? first : `@${first}`;
  } catch {
    return "";
  }
}

// ------------------------------------------------------------------ Media kit

export type KitRate = { label: string; amount_minor: number; currency: string };
export type MediaKit = {
  languages: string;
  partners: string[];
  rates: KitRate[];
  contact_email: string | null;
  show_platforms: boolean;
  show_partners: boolean;
  show_rates: boolean;
  show_contact: boolean;
  updated_at?: string;
};
export const EMPTY_KIT: MediaKit = { languages: "", partners: [], rates: [], contact_email: null, show_platforms: true, show_partners: true, show_rates: true, show_contact: false };

export function relativeTime(iso: string, now = Date.now()) {
  const seconds = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} d ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return parts.length === 1 ? parts[0].slice(0, 2) : `${parts[0][0]}${parts[1][0]}`;
}
