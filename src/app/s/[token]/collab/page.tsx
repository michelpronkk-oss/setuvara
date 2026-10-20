import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { marketingFontClasses } from "@/app/(marketing)/fonts";
import { CollabForm } from "@/components/creator/collab-form";
import type { ModeSlug } from "@/components/profile/types";
import { readCreatorSettings } from "@/lib/creator/studio";
import { getPublishedPublicMode } from "@/lib/seo/public-profile";
import { createClient } from "@/lib/supabase/server";
import { resolveModeShare } from "../resolve";

type Props = { params: Promise<{ token: string }> };

const MODE_NAMES: Record<ModeSlug, string> = { personal: "Personal", event: "Event", business: "Business", creator: "Creator" };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const target = await resolveModeShare((await params).token);
  const record = target?.slug === "creator" ? await getPublishedPublicMode(target.username, "creator") : null;
  if (!record) notFound();
  const firstName = record.profile.display_name.split(/\s+/)[0] || record.profile.display_name;
  return { title: `Work with ${firstName} · Setuvara`, robots: { index: false, follow: false } };
}

/** Work with me: a short brief from a signed-in member, sent as one of their own Modes. */
export default async function CollabPage({ params }: Props) {
  const { token } = await params;
  const target = await resolveModeShare(token);
  if (!target || target.slug !== "creator") notFound();
  const record = await getPublishedPublicMode(target.username, "creator");
  if (!record) notFound();
  const settings = readCreatorSettings(record.mode.settings);
  const name = record.profile.display_name;
  const firstName = name.split(/\s+/)[0] || name;
  const back = `/s/${token}`;

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = typeof claims?.claims?.sub === "string" ? claims.claims.sub : null;
  const [{ data: viewer }, { data: modes }] = userId ? await Promise.all([
    supabase.from("profiles").select("display_name").eq("id", userId).maybeSingle(),
    supabase.from("profile_modes").select("slug").eq("profile_id", userId).eq("is_enabled", true).order("sort_order"),
  ]) : [{ data: null }, { data: null }];
  const senderModes = (modes ?? []).map((row) => row.slug as ModeSlug).filter((slug) => slug in MODE_NAMES).map((slug) => ({ slug, name: MODE_NAMES[slug] }));
  const own = userId === record.profile.id;

  return (
    <main className={`${marketingFontClasses} min-h-dvh bg-[#F5F4EF] font-brand text-[#0D0D0D]`}>
      <div className="mx-auto flex min-h-dvh w-full max-w-[560px] flex-col px-5 pb-[calc(24px+env(safe-area-inset-bottom))] pt-[calc(16px+env(safe-area-inset-top))]">
        <header className="grid grid-cols-[44px_1fr_44px] items-center">
          <Link aria-label={`Back to ${name}`} className="grid size-11 place-items-center rounded-full text-[22px] hover:bg-black/[0.05] focus-visible:outline-2" href={back}>←</Link>
          <p className="truncate text-center text-[16px] font-semibold">{name}</p>
        </header>
        <h1 className="mt-6 font-display text-[44px] font-bold leading-[0.95] tracking-[-0.06em] md:text-[56px]">Work with {firstName}</h1>
        {(settings.collabsNote || settings.collabsPitch) && <p className="mt-3 text-[16px] leading-[1.5] text-black/70">{settings.collabsNote || settings.collabsPitch}</p>}
        {!settings.collabsOpen ? (
          <div className="mt-8 rounded-[22px] bg-white p-6">
            <p className="text-[17px] font-semibold">{firstName} is not taking new projects right now.</p>
            <Link className="mt-4 inline-flex min-h-11 items-center rounded-full bg-[#0D0D0D] px-[18px] text-[15px] font-semibold text-[#F5F4EF]" href={back}>Back to the page</Link>
          </div>
        ) : own ? (
          <div className="mt-8 rounded-[22px] bg-white p-6">
            <p className="text-[17px] font-semibold">This is your own Work with me page.</p>
            <p className="mt-2 text-[15px] text-black/65">Inquiries land in Collabs.</p>
            <Link className="mt-4 inline-flex min-h-11 items-center rounded-full bg-[#0D0D0D] px-[18px] text-[15px] font-semibold text-[#F5F4EF]" href="/app/identity/creator/collabs">Open Collabs</Link>
          </div>
        ) : (
          <CollabForm
            creatorUsername={record.profile.username}
            firstName={firstName}
            loginHref={`/login?next=${encodeURIComponent(`/s/${token}/collab`)}`}
            backHref={back}
            sender={userId && viewer ? { name: viewer.display_name, modes: senderModes } : null}
          />
        )}
      </div>
    </main>
  );
}
