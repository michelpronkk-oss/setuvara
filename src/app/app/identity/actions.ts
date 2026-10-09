"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAllowedUsername, normalizeUsername } from "@/lib/usernames";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const modes = ["personal", "event", "business"] as const;
const layouts = { personal: ["full-bleed", "portrait-editorial"], event: ["event-poster", "conference-card"], business: ["structured", "editorial-business"] } as const;
const settingFields: Record<(typeof modes)[number], string[]> = {
  personal: ["note", "location", "pronouns"],
  event: ["eventName", "city", "countryCode", "dateLabel", "role", "hereToMeet"],
  business: ["role", "company", "city", "description"],
};

function getText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

async function getAuthenticatedClient() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (error || !userId) redirect("/login?next=/app/identity");
  return { supabase, userId };
}

function editorError(code: string): never {
  redirect(`/app/identity?error=${encodeURIComponent(code)}`);
}

export async function saveIdentity(formData: FormData) {
  const { supabase, userId } = await getAuthenticatedClient();
  const username = normalizeUsername(getText(formData, "username"));
  const displayName = getText(formData, "displayName");
  const bio = getText(formData, "bio");
  if (!isAllowedUsername(username)) editorError("invalid_username");
  if (!displayName || displayName.length > 80 || bio.length > 280) editorError("invalid_identity");
  const { data: currentProfile, error: profileError } = await supabase.from("profiles").select("username").eq("id", userId).maybeSingle();
  if (profileError || !currentProfile) editorError("save_failed");
  if (currentProfile.username !== username) {
    const { data: available, error } = await supabase.rpc("is_username_available", { candidate_username: username });
    if (error) editorError("save_failed");
    if (!available) editorError("username_taken");
  }
  const { error } = await supabase.from("profiles").update({ username, display_name: displayName, bio }).eq("id", userId);
  if (error) editorError("save_failed");
  revalidatePath("/app/identity");
  revalidatePath(`/${currentProfile.username}`);
  revalidatePath(`/${username}`);
  redirect("/app/identity?saved=identity");
}

export async function saveModeSettings(formData: FormData) {
  const { supabase, userId } = await getAuthenticatedClient();
  const modeId = getText(formData, "modeId");
  const slug = getText(formData, "slug") as (typeof modes)[number];
  if (!uuidPattern.test(modeId) || !modes.includes(slug)) editorError("mode_failed");
  let settings: Record<string, string | boolean>;
  let appearance: Record<string, string>;
  try {
    const parsedSettings: unknown = JSON.parse(getText(formData, "settings"));
    const parsedAppearance: unknown = JSON.parse(getText(formData, "appearance"));
    if (!parsedSettings || typeof parsedSettings !== "object" || Array.isArray(parsedSettings)) editorError("mode_failed");
    if (!parsedAppearance || typeof parsedAppearance !== "object" || Array.isArray(parsedAppearance)) editorError("mode_failed");
    settings = parsedSettings as Record<string, string | boolean>;
    appearance = parsedAppearance as Record<string, string>;
  } catch {
    editorError("mode_failed");
  }
  if (Object.keys(settings).some((key) => !settingFields[slug].includes(key))) editorError("mode_failed");
  if (Object.values(settings).some((value) => typeof value === "string" && value.length > 280)) editorError("mode_failed");
  if (slug === "event" && typeof settings.countryCode === "string" && settings.countryCode !== "" && !/^[A-Z]{2}$/.test(settings.countryCode)) editorError("mode_failed");
  if (!["light", "dark", "editorial"].includes(appearance.theme ?? "")) editorError("mode_failed");
  if (!/^#[0-9a-f]{6}$/i.test(appearance.accent ?? "")) editorError("mode_failed");
  if (!(layouts[slug] as readonly string[]).includes(appearance.layout ?? "")) editorError("mode_failed");
  if (!["full-bleed", "portrait", "compact"].includes(appearance.imageTreatment ?? "")) editorError("mode_failed");
  const { error } = await supabase.from("profile_modes").update({ settings, appearance }).eq("id", modeId).eq("profile_id", userId).eq("slug", slug);
  if (error) editorError("mode_failed");
  revalidatePath("/app/identity");
  const { data: profile } = await supabase.from("profiles").select("username").eq("id", userId).maybeSingle();
  if (profile) revalidatePath(`/${profile.username}`);
  redirect(`/app/identity?mode=${slug}&saved=mode`);
}

export async function addLink(formData: FormData) {
  const { supabase, userId } = await getAuthenticatedClient();
  const modeId = getText(formData, "modeId");
  const title = getText(formData, "title");
  const url = getText(formData, "url");
  const linkType = getText(formData, "linkType");
  if (!uuidPattern.test(modeId) || !title || title.length > 60) editorError("invalid_link");
  let parsedUrl: URL;
  try { parsedUrl = new URL(url); } catch { editorError("invalid_link"); }
  if (!["http:", "https:"].includes(parsedUrl.protocol) || parsedUrl.username || parsedUrl.password) editorError("invalid_link");
  if (!["url", "instagram", "linkedin", "spotify", "whatsapp", "email", "calendar", "document"].includes(linkType)) editorError("invalid_link");
  const { data: mode, error: modeError } = await supabase.from("profile_modes").select("id").eq("id", modeId).eq("profile_id", userId).maybeSingle();
  if (modeError || !mode) editorError("invalid_link");
  const { data: lastLink } = await supabase.from("profile_links").select("sort_order").eq("profile_id", userId).eq("mode_id", modeId).order("sort_order", { ascending: false }).limit(1).maybeSingle();
  const { error } = await supabase.from("profile_links").insert({ profile_id: userId, mode_id: modeId, title, url: parsedUrl.toString(), link_type: linkType, sort_order: (lastLink?.sort_order ?? 0) + 1 });
  if (error) editorError("link_failed");
  revalidatePath("/app/identity");
  redirect(`/app/identity?mode=${getText(formData, "slug")}&section=links&saved=link`);
}

export async function deleteLink(formData: FormData) {
  const { supabase, userId } = await getAuthenticatedClient();
  const linkId = getText(formData, "linkId");
  if (!uuidPattern.test(linkId)) editorError("link_failed");
  const { error } = await supabase.from("profile_links").delete().eq("id", linkId).eq("profile_id", userId);
  if (error) editorError("link_failed");
  revalidatePath("/app/identity");
  redirect("/app/identity?section=links&saved=link_removed");
}

export async function setLinkVisibility(formData: FormData) {
  const { supabase, userId } = await getAuthenticatedClient();
  const linkId = getText(formData, "linkId");
  const visible = formData.get("isVisible");
  if (!uuidPattern.test(linkId) || (visible !== "true" && visible !== "false")) editorError("link_failed");
  const { error } = await supabase.from("profile_links").update({ is_visible: visible === "true" }).eq("id", linkId).eq("profile_id", userId);
  if (error) editorError("link_failed");
  revalidatePath("/app/identity");
  const { data: profile } = await supabase.from("profiles").select("username").eq("id", userId).maybeSingle();
  if (profile) revalidatePath(`/${profile.username}`);
  redirect("/app/identity?saved=link_visibility");
}

export async function reorderLinks(formData: FormData) {
  const { supabase, userId } = await getAuthenticatedClient();
  const modeId = getText(formData, "modeId");
  let ids: unknown;
  try { ids = JSON.parse(getText(formData, "ids")); } catch { editorError("link_failed"); }
  if (!uuidPattern.test(modeId) || !Array.isArray(ids) || ids.length > 100 || ids.some((id) => typeof id !== "string" || !uuidPattern.test(id))) editorError("link_failed");
  const { data: ownedLinks, error: selectError } = await supabase.from("profile_links").select("id").eq("profile_id", userId).eq("mode_id", modeId).in("id", ids);
  if (selectError || ownedLinks?.length !== ids.length) editorError("link_failed");
  for (const [sortOrder, id] of ids.entries()) {
    const { error } = await supabase.from("profile_links").update({ sort_order: sortOrder }).eq("id", id).eq("profile_id", userId).eq("mode_id", modeId);
    if (error) editorError("link_failed");
  }
  revalidatePath("/app/identity");
  redirect("/app/identity?section=links&saved=links_ordered");
}

export async function setPublished(formData: FormData) {
  const { supabase, userId } = await getAuthenticatedClient();
  const published = formData.get("published") === "on";
  const { data: profile, error: profileError } = await supabase.from("profiles").select("username").eq("id", userId).maybeSingle();
  if (profileError || !profile) editorError("publish_failed");
  const { error } = await supabase.from("profiles").update({ is_published: published }).eq("id", userId);
  if (error) editorError("publish_failed");
  revalidatePath("/app/identity");
  revalidatePath(`/${profile.username}`);
  redirect(`/app/identity?saved=${published ? "published" : "unpublished"}`);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
