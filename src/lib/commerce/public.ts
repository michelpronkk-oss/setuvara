import "server-only";

import { cache } from "react";

import type { StoreOffer } from "@/lib/creator/studio";
import { createClient } from "@/lib/supabase/server";
import { commerceEnabled, commerceProvider, createCommerceServiceClient } from "./server";

export type PublicProduct = Pick<StoreOffer, "id" | "title" | "description" | "currency" | "unit_amount_minor" | "offer_type" | "external_url"> & {
  coverUrl: string | null;
  galleryUrls: string[];
  fileCount: number;
  downloadDays: number | null;
  /** Bought on Setuvara (checkout or free claim) rather than a link out. */
  sellsHere: boolean;
  soldOut: boolean;
};

const BUCKET = "creator-commerce";

/** Where buyers are sent back to: the preview deployment while testing there, else the public site. */
export function commerceOrigin(requestHeaders: Headers) {
  const override = process.env.COMMERCE_SITE_ORIGIN?.trim();
  if (override && /^https?:\/\/[^/]+$/.test(override)) return override;
  if (process.env.VERCEL_ENV === "preview" && process.env.VERCEL_BRANCH_URL) return `https://${process.env.VERCEL_BRANCH_URL}`;
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "setuvara.com";
  return /^(localhost|127\.0\.0\.1):\d+$/.test(host) ? `http://${host}` : "https://setuvara.com";
}

/**
 * A Creator page's products as visitors see them. While commerce is off only
 * external shop links show, exactly as before; paid products also need a
 * configured provider and a seller who can take payments (the database checks that).
 */
export const getPublicStore = cache(async (username: string): Promise<PublicProduct[]> => {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_creator_public_summary", { p_username: username });
  const listed = ((data as { offers?: unknown } | null)?.offers ?? []) as Pick<StoreOffer, "id" | "title" | "description" | "currency" | "unit_amount_minor" | "offer_type" | "external_url">[];
  if (!Array.isArray(listed) || !listed.length) return [];
  const open = commerceEnabled();
  const paidOpen = open && commerceProvider() !== null;
  const shown = listed.filter((offer) => offer.offer_type === "external" || (open && (offer.unit_amount_minor === 0 || paidOpen)));
  const hosted = shown.filter((offer) => offer.offer_type !== "external");
  if (!hosted.length) return shown.map((offer) => ({ ...offer, coverUrl: null, galleryUrls: [], fileCount: 0, downloadDays: null, sellsHere: false, soldOut: false }));

  const plain = (offer: (typeof shown)[number]): PublicProduct => ({ ...offer, coverUrl: null, galleryUrls: [], fileCount: 0, downloadDays: null, sellsHere: false, soldOut: false });
  let service;
  try { service = createCommerceServiceClient(); } catch { return shown.filter((offer) => offer.offer_type === "external").map(plain); }
  const ids = hosted.map((offer) => offer.id);
  const [{ data: details }, { data: files }, { data: taken }] = await Promise.all([
    service.from("creator_offers").select("id, cover_path, gallery_paths, download_days, quantity_limit").in("id", ids),
    service.from("creator_offer_files").select("offer_id").in("offer_id", ids),
    service.from("creator_orders").select("offer_id, status, expires_at").in("offer_id", ids).in("status", ["paid", "processing", "partially_refunded", "disputed", "pending"]),
  ]);
  const byId = new Map((details ?? []).map((row) => [row.id as string, row]));
  const paths = (details ?? []).flatMap((row) => [row.cover_path, ...(row.gallery_paths ?? [])]).filter((path): path is string => typeof path === "string");
  const { data: signed } = paths.length ? await service.storage.from(BUCKET).createSignedUrls(paths, 3600) : { data: [] };
  const url = new Map((signed ?? []).map((item) => [item.path, item.signedUrl]));
  const now = Date.now();
  return shown.map((offer) => {
    const row = byId.get(offer.id);
    if (!row) return { ...offer, coverUrl: null, galleryUrls: [], fileCount: 0, downloadDays: null, sellsHere: false, soldOut: false };
    const held = (taken ?? []).filter((order) => order.offer_id === offer.id && (order.status !== "pending" || (order.expires_at && Date.parse(order.expires_at) > now))).length;
    return {
      ...offer,
      coverUrl: row.cover_path ? url.get(row.cover_path) ?? null : null,
      galleryUrls: (row.gallery_paths ?? []).map((path: string) => url.get(path)).filter((value: string | undefined): value is string => Boolean(value)),
      fileCount: (files ?? []).filter((file) => file.offer_id === offer.id).length,
      downloadDays: row.download_days ?? null,
      sellsHere: true,
      soldOut: row.quantity_limit !== null && held >= row.quantity_limit,
    };
  });
});
