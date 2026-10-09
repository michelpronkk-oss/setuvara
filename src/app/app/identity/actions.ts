"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { normalizeLinkPayload } from "@/lib/links/providers";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const modes = ["personal", "event", "business"] as const;

async function getAuthenticatedClient() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (error || !userId) redirect("/login?next=/app/identity");
  return { supabase, userId };
}

const providerLinkPayload = z.object({
  modeId: z.string().regex(uuidPattern),
  slug: z.enum(modes),
  providerId: z.string().min(1).max(40),
  title: z.string().trim().min(1).max(60),
  value: z.string().trim().min(1).max(2048),
});

export async function createProviderLink(payload: unknown) {
  const parsed = providerLinkPayload.safeParse(payload);
  if (!parsed.success) return { ok: false as const, message: "Choose a provider and check its details." };
  const { supabase, userId } = await getAuthenticatedClient();
  const normalized = normalizeLinkPayload({ providerId: parsed.data.providerId, value: parsed.data.value });
  if (!normalized.ok) return { ok: false as const, message: normalized.message };
  const { data: mode, error: modeError } = await supabase.from("profile_modes").select("id").eq("id", parsed.data.modeId).eq("profile_id", userId).eq("slug", parsed.data.slug).maybeSingle();
  if (modeError || !mode) return { ok: false as const, message: "This Mode could not be found." };
  // New links go to the end of the Mode, matching where the editor shows them.
  const { data: last } = await supabase.from("profile_links").select("sort_order").eq("profile_id", userId).eq("mode_id", mode.id).order("sort_order", { ascending: false }).limit(1).maybeSingle();
  const { data: link, error } = await supabase.from("profile_links").insert({
    profile_id: userId,
    mode_id: mode.id,
    sort_order: (last?.sort_order ?? -1) + 1,
    title: parsed.data.title,
    url: normalized.data.url,
    link_type: parsed.data.providerId,
    is_visible: true,
  }).select("id, title, url, link_type, is_visible, sort_order").single();
  if (error || !link) return { ok: false as const, message: "This link could not be saved. Check the details and try again." };
  revalidatePath("/app/identity");
  const { data: profile } = await supabase.from("profiles").select("username").eq("id", userId).maybeSingle();
  if (profile) revalidatePath(`/${profile.username}`);
  return { ok: true as const, link };
}

export async function updateProviderLink(payload: unknown) {
  const parsed = providerLinkPayload.extend({ linkId: z.string().regex(uuidPattern) }).safeParse(payload);
  if (!parsed.success) return { ok: false as const, message: "Check the link details and try again." };
  const { supabase, userId } = await getAuthenticatedClient();
  const normalized = normalizeLinkPayload({ providerId: parsed.data.providerId, value: parsed.data.value });
  if (!normalized.ok) return { ok: false as const, message: normalized.message };
  const { data: mode, error: modeError } = await supabase.from("profile_modes").select("id").eq("id", parsed.data.modeId).eq("profile_id", userId).eq("slug", parsed.data.slug).maybeSingle();
  if (modeError || !mode) return { ok: false as const, message: "This Mode could not be found." };
  const { data: link, error } = await supabase.from("profile_links").update({
    title: parsed.data.title,
    url: normalized.data.url,
    link_type: parsed.data.providerId,
  }).eq("id", parsed.data.linkId).eq("profile_id", userId).eq("mode_id", mode.id)
    .select("id, title, url, link_type, is_visible, sort_order").maybeSingle();
  if (error || !link) return { ok: false as const, message: "This link could not be saved. Check the details and try again." };
  revalidatePath("/app/identity");
  const { data: profile } = await supabase.from("profiles").select("username").eq("id", userId).maybeSingle();
  if (profile) revalidatePath(`/${profile.username}`);
  return { ok: true as const, link };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
