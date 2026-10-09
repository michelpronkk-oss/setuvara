import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ProfileRenderer } from "@/components/profile/profile-renderer";
import type { ModeSlug, ProfileIdentity, ProfileLink, ProfileMode } from "@/components/profile/types";
import { createClient } from "@/lib/supabase/server";
import { isAllowedUsername, normalizeUsername } from "@/lib/usernames";

type PublicProfilePageProps = {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ mode?: string }>;
};

export async function generateMetadata({ params }: PublicProfilePageProps): Promise<Metadata> {
  const { username: rawUsername } = await params;
  const username = normalizeUsername(rawUsername);
  if (!isAllowedUsername(username)) notFound();
  return {
    title: `@${username} · Setuvara`,
    alternates: { canonical: `https://setuvara.com/${encodeURIComponent(username)}` },
  };
}

export default async function PublicProfilePage({ params, searchParams }: PublicProfilePageProps) {
  const [{ username: rawUsername }, query] = await Promise.all([params, searchParams]);
  const username = normalizeUsername(rawUsername);
  if (!isAllowedUsername(username)) notFound();
  const slug = (query.mode ?? "personal") as ModeSlug;
  if (!["personal", "event", "business"].includes(slug)) notFound();

  const supabase = await createClient();
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, username, display_name, bio, is_published")
    .eq("username", username)
    .eq("is_published", true)
    .maybeSingle();
  if (profileError || !profile) notFound();

  const { data: rawMode, error: modeError } = await supabase
    .from("profile_modes")
    .select("id, slug, label, is_enabled, settings, appearance, image_path")
    .eq("profile_id", profile.id)
    .eq("slug", slug)
    .eq("is_enabled", true)
    .maybeSingle();
  if (modeError || !rawMode) notFound();

  const { data: links, error: linksError } = await supabase
    .from("profile_links")
    .select("id, title, url, link_type, is_visible, sort_order")
    .eq("profile_id", profile.id)
    .eq("mode_id", rawMode.id)
    .eq("is_visible", true)
    .order("sort_order");
  if (linksError) notFound();

  let imageUrl: string | null = null;
  if (rawMode.image_path) {
    const { data: image } = await supabase.storage.from("profile-media").createSignedUrl(rawMode.image_path, 3600);
    imageUrl = image?.signedUrl ?? null;
  }

  const { data: claims } = await supabase.auth.getClaims();
  const owner = claims?.claims?.sub === profile.id;
  const identity = profile as ProfileIdentity;
  const mode: ProfileMode = {
    ...rawMode,
    slug: rawMode.slug as ModeSlug,
    settings: rawMode.settings as Record<string, string | boolean>,
    appearance: rawMode.appearance as ProfileMode["appearance"],
    image_url: imageUrl,
    links: (links ?? []) as ProfileLink[],
  };

  return (
    <main className="min-h-screen bg-[#f5f4ef] px-4 py-6 text-[#0d0d0d] sm:px-6 sm:py-10">
      <div className="mx-auto w-full max-w-lg">
        <header className="mb-5 flex items-center justify-between px-1">
          <Link className="inline-flex min-h-11 items-center text-xs font-bold lowercase tracking-[0.22em]" href="/">setuvara</Link>
          {owner && <span className="rounded-full border border-black/10 px-3 py-2 text-[10px] font-semibold tracking-wide">YOUR PROFILE</span>}
        </header>
        <ProfileRenderer profile={identity} mode={mode} viewerState={owner ? "owner" : "visitor"} />
        <p className="mt-5 text-center text-[10px] font-medium tracking-wide text-black/40">Your identity, your context. Shared with Setuvara.</p>
      </div>
    </main>
  );
}
