import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { marketingFontClasses } from "@/app/(marketing)/fonts";
import { MediaKitDocument, type KitDocument } from "@/components/creator/media-kit-document";
import type { KitRate } from "@/lib/creator/studio";
import { getPublishedPublicMode } from "@/lib/seo/public-profile";
import { createPublicProfileImageUrl } from "@/lib/supabase/public-profile-image-url";
import { createClient } from "@/lib/supabase/server";
import { resolveModeShare } from "../resolve";

type Props = { params: Promise<{ token: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const target = await resolveModeShare((await params).token);
  const record = target?.slug === "creator" ? await getPublishedPublicMode(target.username, "creator") : null;
  if (!record) notFound();
  return { title: `${record.profile.display_name} · Media kit`, robots: { index: false, follow: false } };
}

/** The live media kit behind the Creator share link. Only the parts the creator includes are returned. */
export default async function MediaKitPage({ params }: Props) {
  const { token } = await params;
  const target = await resolveModeShare(token);
  if (!target || target.slug !== "creator") notFound();
  const record = await getPublishedPublicMode(target.username, "creator");
  if (!record) notFound();
  const supabase = await createClient();
  const [{ data, error }, imageUrl] = await Promise.all([
    supabase.rpc("get_creator_media_kit", { p_username: target.username }),
    record.mode.image_path ? createPublicProfileImageUrl(supabase, record.mode.image_path) : Promise.resolve(null),
  ]);
  if (error || !data || typeof data !== "object") notFound();
  const kit = data as Record<string, unknown>;
  const text = (key: string) => (typeof kit[key] === "string" ? (kit[key] as string) : "");
  const doc: KitDocument = {
    displayName: text("display_name") || record.profile.display_name,
    tagline: text("tagline"),
    category: text("category"),
    city: text("city"),
    languages: text("languages"),
    imageUrl,
    platforms: Array.isArray(kit.platforms) ? (kit.platforms as { type: string; url: string }[]) : [],
    partners: Array.isArray(kit.partners) ? (kit.partners as string[]) : [],
    rates: Array.isArray(kit.rates) ? (kit.rates as KitRate[]) : [],
    contactEmail: text("contact_email") || null,
    kitUrl: null,
    updatedAt: text("updated_at") || null,
  };
  return (
    <main className={`${marketingFontClasses} min-h-dvh bg-[#E6E4DC] px-3.5 py-6 font-brand text-[#0D0D0D] md:px-8 md:py-10 print:bg-white print:p-0`}>
      <div className="mx-auto max-w-[920px]"><MediaKitDocument doc={doc} /></div>
    </main>
  );
}
