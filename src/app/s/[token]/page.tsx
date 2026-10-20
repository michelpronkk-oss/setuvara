import type { Metadata, Viewport } from "next";
import { notFound, redirect } from "next/navigation";

import { PublicProfilePage, publicProfileMetadata, publicProfileViewport } from "@/components/profile/public-profile-page";
import { DEFAULT_PUBLIC_MODE } from "@/lib/share/mode-share";
import { resolveModeShare } from "./resolve";

type ModeSharePageProps = {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ source?: string }>;
};

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
