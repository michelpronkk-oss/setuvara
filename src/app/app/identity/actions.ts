"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { isAllowedUsername, normalizeUsername } from "@/lib/usernames";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

async function getAuthenticatedClient() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;

  if (error || !userId) {
    redirect("/login?next=/app/identity");
  }

  return { supabase, userId };
}

function identityError(code: string): never {
  redirect(`/app/identity?error=${encodeURIComponent(code)}`);
}

export async function saveIdentity(formData: FormData) {
  const { supabase, userId } = await getAuthenticatedClient();
  const username = normalizeUsername(getText(formData, "username"));
  const displayName = getText(formData, "displayName");
  const bio = getText(formData, "bio");

  if (!isAllowedUsername(username)) identityError("invalid_username");
  if (!displayName || displayName.length > 80 || bio.length > 280) {
    identityError("invalid_identity");
  }

  const { data: currentProfile, error: profileError } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", userId)
    .maybeSingle();

  if (profileError || !currentProfile) identityError("save_failed");

  if (currentProfile.username !== username) {
    const { data: available, error: availabilityError } = await supabase.rpc(
      "is_username_available",
      { candidate_username: username },
    );

    if (availabilityError) identityError("save_failed");
    if (!available) identityError("username_taken");
  }

  const { error } = await supabase
    .from("profiles")
    .update({ username, display_name: displayName, bio })
    .eq("id", userId);

  if (error) identityError("save_failed");

  revalidatePath("/app/identity");
  revalidatePath(`/${currentProfile.username}`);
  revalidatePath(`/${username}`);
  redirect("/app/identity?saved=identity");
}

export async function addLink(formData: FormData) {
  const { supabase, userId } = await getAuthenticatedClient();
  const modeId = getText(formData, "modeId");
  const title = getText(formData, "title");
  const url = getText(formData, "url");

  if (!uuidPattern.test(modeId) || !title || title.length > 60) identityError("invalid_link");

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    identityError("invalid_link");
  }

  if (
    !["http:", "https:"].includes(parsedUrl.protocol) ||
    parsedUrl.username.length > 0 ||
    parsedUrl.password.length > 0
  ) {
    identityError("invalid_link");
  }

  const { data: mode, error: modeError } = await supabase
    .from("profile_modes")
    .select("id")
    .eq("id", modeId)
    .eq("profile_id", userId)
    .maybeSingle();

  if (modeError || !mode) identityError("invalid_link");

  const { data: lastLink } = await supabase
    .from("profile_links")
    .select("sort_order")
    .eq("profile_id", userId)
    .eq("mode_id", modeId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("profile_links").insert({
    profile_id: userId,
    mode_id: mode.id,
    title,
    url: parsedUrl.toString(),
    sort_order: (lastLink?.sort_order ?? 0) + 1,
  });

  if (error) identityError("link_failed");

  revalidatePath("/app/identity");
  redirect("/app/identity?saved=link");
}

export async function deleteLink(formData: FormData) {
  const { supabase, userId } = await getAuthenticatedClient();
  const linkId = getText(formData, "linkId");

  if (!uuidPattern.test(linkId)) identityError("link_failed");

  const { error } = await supabase
    .from("profile_links")
    .delete()
    .eq("id", linkId)
    .eq("profile_id", userId);

  if (error) identityError("link_failed");

  revalidatePath("/app/identity");
  redirect("/app/identity?saved=link_removed");
}

export async function setLinkVisibility(formData: FormData) {
  const { supabase, userId } = await getAuthenticatedClient();
  const linkId = getText(formData, "linkId");
  const isVisibleValue = formData.get("isVisible");

  if (!uuidPattern.test(linkId) || (isVisibleValue !== "true" && isVisibleValue !== "false")) {
    identityError("link_failed");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", userId)
    .maybeSingle();

  if (profileError || !profile) identityError("link_failed");

  const { error } = await supabase
    .from("profile_links")
    .update({ is_visible: isVisibleValue === "true" })
    .eq("id", linkId)
    .eq("profile_id", userId);

  if (error) identityError("link_failed");

  revalidatePath("/app/identity");
  revalidatePath(`/${profile.username}`);
  redirect("/app/identity?saved=link_visibility");
}

export async function setPublished(formData: FormData) {
  const { supabase, userId } = await getAuthenticatedClient();
  const published = formData.get("published") === "on";

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", userId)
    .maybeSingle();

  if (profileError || !profile) identityError("publish_failed");

  const { error } = await supabase
    .from("profiles")
    .update({ is_published: published })
    .eq("id", userId);

  if (error) identityError("publish_failed");

  revalidatePath("/app/identity");
  revalidatePath(`/${profile.username}`);
  redirect(`/app/identity?saved=${published ? "published" : "unpublished"}`);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
