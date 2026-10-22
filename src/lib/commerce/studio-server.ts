import "server-only";

import { currentNext, rememberNext } from "@/lib/app/login-next";
import { cache } from "react";

import { loadCreatorStudio } from "@/lib/creator/studio-server";
import { ORDER_COLUMNS, type CommerceOrder, type DayStat, type RefundRow, type SellerStatus } from "./model";
import type { Balance } from "./provider";
import { commerceEnabled, commerceProvider, createCommerceServiceClient, sellerAccountFor } from "./server";

export type CommerceProduct = {
  id: string;
  kind: "one_time" | "membership";
  offer_type: "digital" | "booking" | "physical" | "service" | "external";
  title: string;
  description: string;
  currency: string;
  unit_amount_minor: number;
  status: "draft" | "active" | "paused" | "archived";
  external_url: string | null;
  sort_order: number;
  cover_path: string | null;
  gallery_paths: string[];
  delivery_note: string;
  quantity_limit: number | null;
  download_days: number | null;
  download_limit: number;
  created_at: string;
  coverUrl: string | null;
  galleryUrls: string[];
  files: { id: string; file_name: string; size_bytes: number; content_type: string; storage_path: string }[];
};

export type Payout = { id: string; amount_minor: number; currency: string; status: string; arrival_date: string | null; created_at: string };
export type Dispute = { order_id: string; amount_minor: number; currency: string; status: string; reason: string | null; evidence_due_by: string | null };

const EMPTY_STATUS: SellerStatus = { terms_accepted: false, suspended: false, can_sell: false, plan: "free", fees: [], account: null };

/** Everything the Commerce workspace reads, for the signed-in creator only (RLS), plus the live Stripe balance. */
const loadCommerceData = cache(async () => {
  const studio = await loadCreatorStudio(currentNext());
  if (!studio.mode) return { studio, ready: false } as const;
  const { supabase, userId } = studio;
  const since = new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10);
  const [status, offers, files, orders, refunds, disputes, stats, payouts] = await Promise.all([
    supabase.rpc("commerce_seller_status"),
    supabase.from("creator_offers").select("id, kind, offer_type, title, description, currency, unit_amount_minor, status, external_url, sort_order, cover_path, gallery_paths, delivery_note, quantity_limit, download_days, download_limit, created_at").eq("creator_user_id", userId).neq("status", "archived").order("sort_order").order("created_at", { ascending: false }),
    supabase.from("creator_offer_files").select("id, offer_id, file_name, size_bytes, content_type, storage_path, sort_order").eq("creator_user_id", userId).order("sort_order").order("created_at"),
    supabase.from("creator_orders").select(ORDER_COLUMNS).eq("creator_user_id", userId).order("created_at", { ascending: false }).limit(2000),
    supabase.from("creator_refunds").select("order_id, amount_minor, currency, status, platform_fee_refunded_minor, created_at").eq("creator_user_id", userId),
    supabase.from("creator_disputes").select("order_id, amount_minor, currency, status, reason, evidence_due_by").eq("creator_user_id", userId),
    supabase.from("creator_offer_daily_stats").select("offer_id, day, views, checkout_starts").eq("creator_user_id", userId).gte("day", since),
    supabase.from("creator_payouts").select("id, amount_minor, currency, status, arrival_date, created_at").eq("creator_user_id", userId).order("created_at", { ascending: false }).limit(20),
  ]);
  // Before the Commerce migration reaches a database these tables are missing; the workspace reads as empty.
  const ready = !status.error && !files.error;
  const rows = (offers.error ? [] : offers.data ?? []) as Omit<CommerceProduct, "coverUrl" | "galleryUrls" | "files">[];
  const paths = rows.flatMap((row) => [row.cover_path, ...(row.gallery_paths ?? [])]).filter((path): path is string => Boolean(path));
  const { data: signed } = paths.length ? await supabase.storage.from("creator-commerce").createSignedUrls(paths, 3600) : { data: [] };
  const url = new Map((signed ?? []).map((item) => [item.path, item.signedUrl]));
  const fileRows = (files.data ?? []) as (CommerceProduct["files"][number] & { offer_id: string })[];
  const products: CommerceProduct[] = rows.map((row) => ({
    ...row,
    gallery_paths: row.gallery_paths ?? [],
    coverUrl: row.cover_path ? url.get(row.cover_path) ?? null : null,
    galleryUrls: (row.gallery_paths ?? []).map((path) => url.get(path)).filter((value): value is string => Boolean(value)),
    files: fileRows.filter((file) => file.offer_id === row.id),
  }));

  const seller = (status.data as SellerStatus | null) ?? EMPTY_STATUS;
  const provider = commerceProvider();
  let balance: Balance | null = null;
  if (provider && seller.account && !seller.account.disconnected_at && seller.account.details_submitted) {
    try {
      const row = await sellerAccountFor(createCommerceServiceClient(), userId, provider.code);
      if (row) balance = await provider.balance(row.provider_account_id);
    } catch { balance = null; }
  }

  return {
    studio,
    ready,
    enabled: commerceEnabled(),
    providerReady: provider !== null,
    testMode: provider ? !provider.livemode : true,
    seller,
    products,
    orders: (orders.error ? [] : orders.data ?? []) as unknown as CommerceOrder[],
    refunds: (refunds.data ?? []) as RefundRow[],
    disputes: (disputes.data ?? []) as Dispute[],
    stats: (stats.data ?? []) as DayStat[],
    payouts: (payouts.data ?? []) as Payout[],
    balance,
  } as const;
});

/** loadCommerce for this request; `next` is where sign-in returns to. */
export function loadCommerce(next: string) {
  rememberNext(next);
  return loadCommerceData();
}

export type CommerceWorkspace = Extract<Awaited<ReturnType<typeof loadCommerce>>, { ready: boolean; seller: SellerStatus }>;
