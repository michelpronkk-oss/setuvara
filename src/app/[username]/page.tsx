import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";

import { PublicProfilePage, publicProfileMetadata, publicProfileViewport, type PublicProfileTarget } from "@/components/profile/public-profile-page";
import { resolveModeHandle } from "@/lib/handles/mode-server";
import { redirectIfRenamed } from "@/lib/handles/renamed";
import { getPublishedPublicMode } from "@/lib/seo/public-profile";
import { DEFAULT_PUBLIC_MODE, getModeShareId } from "@/lib/share/mode-share";
import { isAllowedUsername, normalizeUsername } from "@/lib/usernames";

type UsernamePageProps = {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ source?: string }>;
};

// setuvara.com/<name> is one namespace, resolved in order:
//   1. a username: the default Mode only (a `?mode=` query is ignored on purpose)
//   2. a Business or Creator handle its owner made live
//   3. an old name its owner kept: 307 to where it lives now
//   4. 404
async function target(params: UsernamePageProps["params"]): Promise<PublicProfileTarget & { missing?: true } | null> {
  const name = normalizeUsername((await params).username);
  if (!isAllowedUsername(name)) return null;
  if (await getPublishedPublicMode(name, DEFAULT_PUBLIC_MODE)) return { username: name, slug: DEFAULT_PUBLIC_MODE };
  const handle = await resolveModeHandle(name);
  if (!handle) return { username: name, slug: DEFAULT_PUBLIC_MODE, missing: true };
  // Creator actions and products hang off the Mode's share id; mint it if the claim couldn't.
  let shareToken = handle.shareToken;
  if (!shareToken) {
    const record = await getPublishedPublicMode(handle.username, handle.slug);
    shareToken = record ? await getModeShareId(record.profile.id, handle.slug) : null;
  }
  return { username: handle.username, slug: handle.slug, handle: handle.handle, indexable: handle.indexable, ...(shareToken ? { shareToken } : {}) };
}

export async function generateViewport({ params }: UsernamePageProps): Promise<Viewport> {
  const resolved = await target(params);
  return publicProfileViewport(resolved && !resolved.missing ? resolved : null);
}

export async function generateMetadata({ params, searchParams }: UsernamePageProps): Promise<Metadata> {
  const resolved = await target(params);
  if (!resolved) notFound();
  if (resolved.missing) await redirectIfRenamed(resolved.username, (await searchParams).source);
  return publicProfileMetadata(resolved);
}

export default async function UsernamePage({ params, searchParams }: UsernamePageProps) {
  const [resolved, query] = await Promise.all([target(params), searchParams]);
  if (!resolved) notFound();
  if (resolved.missing) await redirectIfRenamed(resolved.username, query.source);
  return <PublicProfilePage source={query.source} target={resolved} />;
}
