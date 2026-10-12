import type { Metadata, Viewport } from "next";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";

import { PublicProfilePage, publicProfileMetadata, publicProfileViewport } from "@/components/profile/public-profile-page";
import { DEFAULT_PUBLIC_MODE, modeShareTokenPattern, parseResolvedModeShare } from "@/lib/share/mode-share";
import { createClient } from "@/lib/supabase/server";

type ModeSharePageProps = {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ source?: string }>;
};

// The opaque token resolves server-side to one published profile and one
// enabled Mode. It is a pointer only: Connection Access is still decided by
// the profile page for that exact profile and Mode.
const resolveModeShare = cache(async (token: string) => {
  if (!modeShareTokenPattern.test(token)) return null;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("resolve_mode_share", { p_token: token });
    const resolved = error ? null : parseResolvedModeShare(data);
    return resolved ? { username: resolved.username, slug: resolved.mode, shareToken: token } : null;
  } catch {
    return null;
  }
});

export async function generateViewport({ params }: ModeSharePageProps): Promise<Viewport> {
  return publicProfileViewport(await resolveModeShare((await params).token));
}

export async function generateMetadata({ params }: ModeSharePageProps): Promise<Metadata> {
  const target = await resolveModeShare((await params).token);
  if (!target) notFound();
  return publicProfileMetadata(target);
}

export default async function ModeSharePage({ params, searchParams }: ModeSharePageProps) {
  const [{ token }, query] = await Promise.all([params, searchParams]);
  const target = await resolveModeShare(token);
  if (!target) notFound();
  if (target.slug === DEFAULT_PUBLIC_MODE) redirect(`/${target.username}`);
  return <PublicProfilePage source={query.source} target={target} />;
}
