import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";

import { PublicProfilePage, publicProfileMetadata, publicProfileViewport } from "@/components/profile/public-profile-page";
import { DEFAULT_PUBLIC_MODE } from "@/lib/share/mode-share";
import { isAllowedUsername, normalizeUsername } from "@/lib/usernames";

type UsernamePageProps = {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ source?: string }>;
};

// The canonical username URL only ever shows the default Mode. A `?mode=` query
// is ignored on purpose: Event and Business open only through /s/<token>.
async function target(params: UsernamePageProps["params"]) {
  const username = normalizeUsername((await params).username);
  return isAllowedUsername(username) ? { username, slug: DEFAULT_PUBLIC_MODE } : null;
}

export async function generateViewport({ params }: UsernamePageProps): Promise<Viewport> {
  return publicProfileViewport(await target(params));
}

export async function generateMetadata({ params }: UsernamePageProps): Promise<Metadata> {
  const resolved = await target(params);
  if (!resolved) notFound();
  return publicProfileMetadata(resolved);
}

export default async function UsernamePage({ params, searchParams }: UsernamePageProps) {
  const [resolved, query] = await Promise.all([target(params), searchParams]);
  if (!resolved) notFound();
  return <PublicProfilePage source={query.source} target={resolved} />;
}
