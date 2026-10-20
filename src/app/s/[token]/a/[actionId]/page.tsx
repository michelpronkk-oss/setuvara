import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { marketingFontClasses } from "@/app/(marketing)/fonts";
import { shortDate } from "@/components/actions/action-card";
import { ActionForm } from "@/components/actions/action-form";
import { actionWindow, ACTION_KIND_NAME, type PublicAction } from "@/lib/actions/model";
import { getPublicActions } from "@/lib/actions/public";
import { getPublishedPublicMode } from "@/lib/seo/public-profile";
import { createClient } from "@/lib/supabase/server";
import { resolveModeShare } from "../../resolve";

type Props = { params: Promise<{ token: string; actionId: string }> };

async function load(token: string, actionId: string) {
  const target = await resolveModeShare(token);
  if (!target || target.slug !== "creator") return null;
  const [record, actions] = await Promise.all([getPublishedPublicMode(target.username, target.slug), getPublicActions(target.username, target.slug)]);
  const found = actions.find((item) => item.action.id === actionId);
  return record && found ? { record, ...found } : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token, actionId } = await params;
  const page = await load(token, actionId);
  if (!page) notFound();
  return { title: `${page.action.title} · ${page.record.profile.display_name}`, robots: { index: false, follow: false } };
}

function fullDate(iso: string) {
  return new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC", timeZoneName: "short" });
}

/** One Action's page behind the Mode's share link: what it is, the terms, and the form. */
export default async function ActionPage({ params }: Props) {
  const { token, actionId } = await params;
  const page = await load(token, actionId);
  if (!page) notFound();
  const { record, action, coverUrl } = page;
  const name = record.profile.display_name;
  const firstName = name.split(/\s+/)[0] || name;
  const back = `/s/${token}`;
  const when = actionWindow(action);

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = typeof claims?.claims?.sub === "string" ? claims.claims.sub : null;
  const { data: viewer } = userId ? await supabase.from("profiles").select("display_name").eq("id", userId).maybeSingle() : { data: null };
  const own = userId === record.profile.id;

  return (
    <main className={`${marketingFontClasses} min-h-dvh bg-[#F5F4EF] font-brand text-[#0D0D0D]`}>
      <div className="mx-auto flex min-h-dvh w-full max-w-[600px] flex-col px-5 pb-[calc(24px+env(safe-area-inset-bottom))] pt-[calc(16px+env(safe-area-inset-top))]">
        <header className="grid grid-cols-[44px_1fr_44px] items-center">
          <Link aria-label={`Back to ${name}`} className="grid size-11 place-items-center rounded-full text-[22px] hover:bg-black/[0.05] focus-visible:outline-2" href={back}>←</Link>
          <p className="truncate text-center text-[16px] font-semibold">{name}</p>
        </header>
        {coverUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- public profile media
          <img alt="" className="mt-5 aspect-[16/9] w-full rounded-[22px] object-cover" src={coverUrl} />
        )}
        <p className="mt-6 font-label text-[11px] uppercase tracking-[0.16em] text-black/55">{ACTION_KIND_NAME[action.kind]}</p>
        <h1 className="mt-2 font-display text-[40px] font-bold leading-[0.95] tracking-[-0.06em] md:text-[52px]">{action.title}</h1>
        {action.intro && <p className="mt-3 whitespace-pre-line text-[16px] leading-[1.5] text-black/70">{action.intro}</p>}
        <Terms action={action} />

        {when !== "open" ? (
          <div className="mt-8 rounded-[22px] bg-white p-6">
            <p className="text-[17px] font-semibold">{when === "ended" ? "This has closed." : `This opens ${action.starts_at ? shortDate(action.starts_at) : "soon"}.`}</p>
            <Link className="mt-4 inline-flex min-h-11 items-center rounded-full bg-[#0D0D0D] px-[18px] text-[15px] font-semibold text-[#F5F4EF]" href={back}>Back to the page</Link>
          </div>
        ) : own ? (
          <div className="mt-8 rounded-[22px] bg-white p-6">
            <p className="text-[17px] font-semibold">This is your own Action.</p>
            <p className="mt-2 text-[15px] text-black/65">Responses land in your Creator studio.</p>
            <Link className="mt-4 inline-flex min-h-11 items-center rounded-full bg-[#0D0D0D] px-[18px] text-[15px] font-semibold text-[#F5F4EF]" href={`/app/identity/creator/actions/${action.id}`}>Open responses</Link>
          </div>
        ) : (
          <ActionForm action={action} backHref={back} firstName={firstName} signedInName={viewer?.display_name ?? ""} />
        )}
      </div>
    </main>
  );
}

function Terms({ action }: { action: PublicAction }) {
  const { config } = action;
  if (action.kind === "booking" && (config.details || config.priceNote)) {
    return (
      <div className="mt-5 flex flex-col gap-2 border-y border-black/10 py-4">
        {config.details && <p className="whitespace-pre-line text-[15px] leading-[1.55]">{config.details}</p>}
        {config.priceNote && <p className="text-[15px] font-semibold">{config.priceNote}</p>}
      </div>
    );
  }
  if (action.kind !== "giveaway") return null;
  const facts = [
    ["Prize", config.prize],
    ["Ends", action.ends_at ? fullDate(action.ends_at) : null],
    ["Who can enter", [config.minAge ? `${config.minAge}+` : null, config.eligibility].filter(Boolean).join(" · ") || null],
    ["Run by", config.sponsor],
  ].filter((row): row is [string, string] => Boolean(row[1]));
  return (
    <div className="mt-5">
      <dl className="grid gap-3 border-y border-black/10 py-4 sm:grid-cols-2">
        {facts.map(([key, value]) => <div key={key}><dt className="font-label text-[10.5px] uppercase tracking-[0.16em] text-black/55">{key}</dt><dd className="mt-1 text-[15px] font-semibold">{value}</dd></div>)}
      </dl>
      <details className="mt-3 rounded-[18px] bg-white p-4 open:pb-5">
        <summary className="cursor-pointer text-[15px] font-semibold">Official rules</summary>
        <p className="mt-3 whitespace-pre-line text-[14px] leading-[1.6] text-black/75">{config.rules || "No purchase necessary. One entry per person, confirmed by email. The winner is chosen after the end date and contacted by email."}</p>
        <p className="mt-3 text-[13px] text-black/55">Setuvara hosts this page and is not the sponsor of this giveaway.</p>
      </details>
    </div>
  );
}
