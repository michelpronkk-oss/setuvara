import { z } from "zod";

import type { BlockKind, ModeSlug, ProfileBlock, ProfileMode } from "@/components/profile/types";
import { parseMusic, parseVideo } from "./media";

/**
 * Mode content blocks. The database bounds kind and size; this registry is
 * the source of truth for each kind's shape, labels and Mode suggestions.
 */

export type { BlockKind, ProfileBlock };

const text = (max: number) => z.string().trim().max(max);
const httpsImage = z.string().trim().max(1000).regex(/^https:\/\//i).nullable().optional();

export const blockSchemas = {
  video: z.object({
    url: z.string().trim().max(500).refine((value) => Boolean(parseVideo(value)), "Paste a YouTube, Vimeo, TikTok, Loom or Instagram video link."),
    title: text(120).optional(),
    caption: text(160).optional(),
    thumbnail: httpsImage,
  }),
  music: z.object({
    url: z.string().trim().max(500).refine((value) => Boolean(parseMusic(value)), "Paste a Spotify, YouTube Music, SoundCloud, Apple Music or Deezer link."),
    title: text(120).optional(),
    image: httpsImage,
  }),
  feature: z.object({
    url: z.string().trim().max(1000).regex(/^https?:\/\//i, "Paste a full link starting with https://"),
    title: text(120).min(1, "Give this a title."),
    description: text(240).optional(),
    image: httpsImage,
    image_path: z.string().trim().max(100).regex(/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp)$/i).nullable().optional(),
    siteName: text(80).optional(),
    cta: text(30).optional(),
  }),
  image: z.object({
    image_path: z.string().trim().max(100).regex(/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp)$/i, "Upload a JPEG, PNG or WebP image."),
    alt: text(180).min(1, "Describe the image for visitors."),
    caption: text(240).optional(),
  }),
  services: z.object({
    heading: text(60).optional(),
    items: z.array(z.object({ name: text(60).min(1, "Name each service."), detail: text(140).optional(), price: text(30).optional() })).min(1, "Add at least one service.").max(6),
  }),
  highlights: z.object({
    items: z.array(z.object({ value: text(12).min(1, "Add a number or short value."), label: text(40).min(1, "Add a label.") })).min(1, "Add at least one highlight.").max(3),
  }),
  testimonial: z.object({
    quote: text(320).min(1, "Add the quote."),
    author: text(60).min(1, "Add who said it."),
    role: text(80).optional(),
  }),
} satisfies Record<BlockKind, z.ZodType>;

export type BlockData<K extends BlockKind = BlockKind> = z.infer<(typeof blockSchemas)[K]>;

export type BlockMeta = { kind: BlockKind; name: string; hint: string; icon: string };

export const BLOCKS: Record<BlockKind, BlockMeta> = {
  video: { kind: "video", name: "Video", hint: "YouTube, TikTok, Vimeo, Loom, Reels", icon: "M8 5.5v13l10.5-6.5L8 5.5Z" },
  music: { kind: "music", name: "Music", hint: "Spotify, YouTube Music, SoundCloud, Apple Music", icon: "M9 18.5a2.5 2.5 0 1 1-2.5-2.5c.4 0 .8.1 1 .2V5.8l11-2.3v11.9a2.5 2.5 0 1 1-2.5-2.4c.4 0 .7.1 1 .2V7.1L9 8.8v9.7Z" },
  feature: { kind: "feature", name: "Featured link", hint: "Big card with image, from any link", icon: "M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5v-13Zm2 .5v7h12V6H6Zm0 9v1.5h8V15H6Z" },
  image: { kind: "image", name: "Image", hint: "Add a photo or visual to this Mode", icon: "M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5v-13ZM6 16.5l3.7-4.5 2.6 3.1 1.8-2.1 3.9 4.5V6H6v10.5ZM9.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" },
  services: { kind: "services", name: "Services", hint: "What you offer, with optional prices", icon: "M4 6h16v2H4V6Zm0 5h16v2H4v-2Zm0 5h10v2H4v-2Z" },
  highlights: { kind: "highlights", name: "Highlights", hint: "Up to 3 numbers that prove it", icon: "M5 19V11h3v8H5Zm5.5 0V5h3v14h-3Zm5.5 0v-6h3v6h-3Z" },
  testimonial: { kind: "testimonial", name: "Testimonial", hint: "A quote from a client or partner", icon: "M5 17.5c0-4.3 1.9-7.5 5.2-9.5l1 1.6c-1.8 1.3-2.8 2.7-3 4.4H11V19H5v-1.5Zm8 0c0-4.3 1.9-7.5 5.2-9.5l1 1.6c-1.8 1.3-2.8 2.7-3 4.4H19V19h-6v-1.5Z" },
};

/** Which blocks each Mode offers first; the rest stay available under "More". */
export const MODE_BLOCKS: Record<ModeSlug, BlockKind[]> = {
  personal: ["video", "music", "feature"],
  event: ["feature", "video", "highlights"],
  business: ["services", "highlights", "testimonial", "video", "feature"],
};

export const BLOCK_LIMIT = 12;

/**
 * Loads blocks with their soundtrack status. Before the soundtrack migration
 * reaches a database the column is missing; blocks then load without it.
 */
export async function selectBlocks<T>(columns: string, query: (columns: string) => PromiseLike<{ data: T | null; error: { code?: string } | null }>) {
  const result = await query(`${columns}, is_soundtrack`);
  return result.error?.code === "42703" ? query(columns) : result;
}

export function emptyBlock(kind: BlockKind): Record<string, unknown> {
  switch (kind) {
    case "services": return { heading: "Services", items: [{ name: "", detail: "", price: "" }] };
    case "highlights": return { items: [{ value: "", label: "" }, { value: "", label: "" }] };
    case "testimonial": return { quote: "", author: "", role: "" };
    case "feature": return { url: "", title: "", description: "", image: null, image_path: null, image_url: null, siteName: "", cta: "" };
    case "image": return { image_path: null, image_url: null, alt: "", caption: "" };
    case "music": return { url: "", title: "", image: null };
    default: return { url: "", title: "" };
  }
}

/** Validates and normalises block data. Returns the first readable error otherwise. */
export function validateBlock(kind: BlockKind, data: unknown): { ok: true; data: Record<string, unknown> } | { ok: false; message: string } {
  const result = blockSchemas[kind].safeParse(data);
  if (!result.success) return { ok: false, message: result.error.issues[0]?.message ?? "Check this block." };
  const clean = JSON.parse(JSON.stringify(result.data, (_key, value) => (value === "" ? undefined : value))) as Record<string, unknown>;
  if (kind === "video") {
    const media = parseVideo(String(clean.url));
    if (media) clean.url = media.url;
  }
  if (kind === "music") {
    const media = parseMusic(String(clean.url));
    if (media) clean.url = media.url;
  }
  return { ok: true, data: clean };
}

/** Narrows stored rows to the kinds this build understands, dropping invalid data. */
export function readableBlocks(rows: unknown[] | null | undefined): ProfileBlock[] {
  return (rows ?? []).flatMap((row) => {
    const block = row as ProfileBlock;
    if (!block || !(block.kind in blockSchemas)) return [];
    return blockSchemas[block.kind].safeParse(block.data).success ? [block] : [];
  });
}

/** The block that is this Mode's soundtrack, if it can actually play as one. */
export function soundtrackBlock(mode: Pick<ProfileMode, "blocks">): ProfileBlock | null {
  const block = mode.blocks?.find((item) => item.is_soundtrack && item.is_visible && item.kind === "music");
  return block && parseMusic(typeof block.data.url === "string" ? block.data.url : "")?.soundtrack ? block : null;
}

export function blockSummary(block: Pick<ProfileBlock, "kind" | "data">): string {
  const data = block.data as Record<string, unknown>;
  const str = (value: unknown) => (typeof value === "string" ? value : "");
  switch (block.kind) {
    case "video": {
      const media = parseVideo(str(data.url));
      return str(data.title) || (media ? `${media.provider === "youtube" ? "YouTube" : media.provider[0].toUpperCase() + media.provider.slice(1)} video` : "Video");
    }
    case "music": return str(data.title) || "Music";
    case "feature": return str(data.title) || "Featured link";
    case "image": return str(data.caption) || "Image";
    case "services": return `${(data.items as unknown[] | undefined)?.length ?? 0} services`;
    case "highlights": return ((data.items as { value: string; label: string }[] | undefined) ?? []).map((item) => `${item.value} ${item.label}`).join(" · ") || "Highlights";
    case "testimonial": return str(data.author) ? `“${str(data.quote).slice(0, 40)}${str(data.quote).length > 40 ? "…" : ""}” · ${str(data.author)}` : "Testimonial";
  }
}
