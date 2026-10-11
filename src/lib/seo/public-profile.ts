import { cache } from "react";

import type { ModeSlug } from "@/components/profile/types";
import { createClient } from "@/lib/supabase/server";
import { isAllowedUsername } from "@/lib/usernames";

export type SeoPublicProfile = {
  id: string;
  username: string;
  display_name: string;
  bio: string | null;
  is_published: boolean;
  updated_at: string | null;
};

export type SeoPublicMode = {
  id: string;
  slug: ModeSlug;
  label: string;
  is_enabled: boolean;
  settings: Record<string, unknown>;
  appearance: unknown;
  image_path: string | null;
  image_focus_x: number | null;
  image_focus_y: number | null;
  updated_at: string | null;
};

export type SeoPublicProfileRecord = { profile: SeoPublicProfile; mode: SeoPublicMode };

const MODE_SLUGS = new Set<ModeSlug>(["personal", "event", "business"]);

/** Only published identities and enabled Modes are ever eligible for public SEO. */
export const getPublishedPublicMode = cache(async (username: string, slug: ModeSlug): Promise<SeoPublicProfileRecord | null> => {
  if (!isAllowedUsername(username) || !MODE_SLUGS.has(slug)) return null;

  try {
    const supabase = await createClient();
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, username, display_name, bio, is_published, updated_at")
      .eq("username", username)
      .eq("is_published", true)
      .maybeSingle();
    if (profileError || !profile || profile.is_published !== true) return null;

    const { data: mode, error: modeError } = await supabase
      .from("profile_modes")
      .select("id, slug, label, is_enabled, settings, appearance, image_path, image_focus_x, image_focus_y, updated_at")
      .eq("profile_id", profile.id)
      .eq("slug", slug)
      .eq("is_enabled", true)
      .maybeSingle();
    if (modeError || !mode || mode.is_enabled !== true || !MODE_SLUGS.has(mode.slug as ModeSlug)) return null;

    const settings = mode.settings && typeof mode.settings === "object" && !Array.isArray(mode.settings)
      ? mode.settings as Record<string, unknown>
      : {};

    return {
      profile: profile as SeoPublicProfile,
      mode: { ...mode, slug: mode.slug as ModeSlug, settings } as SeoPublicMode,
    };
  } catch {
    return null;
  }
});

export function publicSetting(mode: { settings: Record<string, unknown> }, key: string, limit = 280): string | null {
  const value = mode.settings[key];
  if (typeof value !== "string") return null;
  const text = value.replace(/\s+/g, " ").trim();
  return text ? Array.from(text).slice(0, limit).join("") : null;
}

export function publicProfileTitle(profile: SeoPublicProfile): string {
  const name = profile.display_name.replace(/\s+/g, " ").trim();
  return name || `@${profile.username}`;
}

export function publicProfileDescription(record: SeoPublicProfileRecord): string {
  const { profile, mode } = record;
  const location = publicSetting(mode, "location", 80);
  const context = mode.slug === "personal"
    ? profile.bio?.trim() || (location ? `Based in ${location} on Setuvara.` : null)
    : mode.slug === "event"
      ? [publicSetting(mode, "eventName", 100), publicSetting(mode, "city", 80), publicSetting(mode, "dateLabel", 80), publicSetting(mode, "role", 80), publicSetting(mode, "hereToMeet", 180)].filter(Boolean).join(" · ")
      : [publicSetting(mode, "role", 80), publicSetting(mode, "company", 100), publicSetting(mode, "city", 80), publicSetting(mode, "description", 180)].filter(Boolean).join(" · ");

  const description = context || `Meet ${publicProfileTitle(profile)} on Setuvara.`;
  return Array.from(description.replace(/\s+/g, " ").trim()).slice(0, 180).join("");
}

export function safePublicHttpUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.toString();
  } catch {
    return null;
  }
}
