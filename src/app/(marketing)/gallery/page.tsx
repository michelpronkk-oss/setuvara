import type { Metadata } from "next";
import Link from "next/link";

import { CastPhone } from "@/components/marketing/home/mode-phone";
import { PhoneStage } from "@/components/marketing/home/phone-stage";
import { CtaBand, PageHero, Section } from "@/components/marketing/site/kit";
import { JsonLd } from "@/components/seo/json-ld";
import { nameFontClasses } from "@/components/profile/name-fonts";
import { ProfileImage } from "@/components/profile/profile-image";
import { APPEARANCE_NAMES } from "@/components/profile/appearance";
import type { AppearanceId, ModeSlug } from "@/components/profile/types";
import { loadGallery, type GalleryEntry } from "@/lib/marketing/gallery";
import { marketingMetadata, SETUVARA_ORIGIN } from "@/lib/marketing/metadata";
import { MODE_ORDER, MODE_PAGES } from "@/lib/marketing/modes-content";

export const revalidate = 300;

/** Only Modes with a public address can be listed: Event pages live on private links. */
const MODE_FILTERS = ["personal", "business", "creator"] as const satisfies readonly ModeSlug[];
const LOOKS = Object.keys(APPEARANCE_NAMES) as AppearanceId[];

type Params = { mode?: string | string[]; look?: string | string[] };

function readFilters(params: Params) {
  const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? "";
  const mode = (MODE_FILTERS as readonly string[]).includes(one(params.mode)) ? (one(params.mode) as ModeSlug) : null;
  const look = (LOOKS as string[]).includes(one(params.look)) ? (one(params.look) as AppearanceId) : null;
  return { mode, look };
}

const base = marketingMetadata({
  title: "Gallery: real Setuvara pages | Setuvara",
  description: "Real Setuvara pages from members who chose to be listed, by Mode and by Look. Open any page to see it live, then make your own.",
  path: "/gallery",
});

export async function generateMetadata({ searchParams }: { searchParams: Promise<Params> }): Promise<Metadata> {
  const { mode, look } = readFilters(await searchParams);
  // Filtered views are the same gallery: one canonical URL, and only that one gets indexed.
  return mode || look ? { ...base, robots: { index: false, follow: true } } : base;
}

function href(mode: ModeSlug | null, look: AppearanceId | null) {
  const query = new URLSearchParams();
  if (mode) query.set("mode", mode);
  if (look) query.set("look", look);
  const text = query.toString();
  return text ? `/gallery?${text}#pages` : "/gallery#pages";
}

function Chip({ active, href: to, children }: { active: boolean; href: string; children: React.ReactNode }) {
  return (
    <Link aria-current={active ? "page" : undefined} className={`inline-flex min-h-10 shrink-0 items-center rounded-full px-4 text-[14px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral ${active ? "bg-ink text-paper" : "bg-white text-ink/75 shadow-[inset_0_0_0_1px_rgba(13,13,13,.12)] hover:text-ink hover:shadow-[inset_0_0_0_1px_rgba(13,13,13,.4)]"}`} href={to} scroll={false}>
      {children}
    </Link>
  );
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => Array.from(part)[0]?.toUpperCase() ?? "").join("");
}

function GalleryCard({ entry, eager }: { entry: GalleryEntry; eager: boolean }) {
  return (
    <li>
      <Link className="group block rounded-[24px] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-coral" href={`/${entry.path}`}>
        <div className="relative aspect-[4/5] overflow-hidden rounded-[24px] bg-ink" style={entry.photo ? undefined : { background: entry.accent }}>
          {entry.photo
            ? <ProfileImage alt="" priority={eager} className="absolute inset-0 size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" fill sizes="(min-width: 1280px) 22vw, (min-width: 640px) 45vw, 92vw" src={entry.photo} style={{ objectPosition: `${entry.focus.x}% ${entry.focus.y}%` }} />
            : <span aria-hidden="true" className="absolute inset-0 grid place-items-center font-display text-[72px] font-extrabold tracking-[-0.06em] text-ink/80">{initials(entry.name)}</span>}
          <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/70 to-transparent" />
          <span className="absolute left-3 top-3 rounded-full bg-black/45 px-2.5 py-1 font-label text-[10px] uppercase tracking-[0.14em] text-white backdrop-blur-sm">{MODE_PAGES[entry.mode].name} · {entry.lookName}</span>
          <span className="absolute inset-x-4 bottom-4 text-white">
            <span className="block truncate font-display text-[24px] font-bold leading-tight tracking-[-0.04em]">{entry.name}</span>
            {entry.line && <span className="mt-0.5 block truncate text-[13px] text-white/75">{entry.line}</span>}
          </span>
        </div>
        <p className="mt-2.5 flex items-center justify-between px-1 text-[13px] text-ink/55"><span className="truncate font-label">setuvara.com/{entry.path}</span><span aria-hidden="true" className="text-ink transition-transform group-hover:translate-x-0.5">→</span></p>
      </Link>
    </li>
  );
}

export default async function GalleryPage({ searchParams }: { searchParams: Promise<Params> }) {
  const { mode, look } = readFilters(await searchParams);
  const all = await loadGallery();
  const pages = all.filter((entry) => (!mode || entry.mode === mode) && (!look || entry.look === look));
  const filtered = Boolean(mode || look);

  return (
    <>
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: "Setuvara gallery",
        url: `${SETUVARA_ORIGIN}/gallery`,
        description: "Real Setuvara pages from members who chose to be listed.",
        mainEntity: { "@type": "ItemList", numberOfItems: all.length, itemListElement: all.slice(0, 50).map((entry, index) => ({ "@type": "ListItem", position: index + 1, url: `${SETUVARA_ORIGIN}/${entry.path}`, name: entry.name })) },
      }} />
      <PageHero claimId="gallery-claim" crumbs={[{ name: "Gallery", path: "/gallery" }]} eyebrow="Gallery" lede="Pages from members who chose to be listed. Filter by Mode or Look, open any of them to see it live, then make yours." title={<>Real pages.<br />Real people.</>} />

      <section aria-labelledby="pages-title" className="scroll-mt-16" id="pages">
        <div className="mx-auto w-full max-w-[1440px] px-5 pb-16 sm:px-8 sm:pb-24 lg:px-14">
          <h2 className="sr-only" id="pages-title">Pages</h2>
          <div className="flex flex-col gap-3 border-y border-ink/10 py-5">
            <nav aria-label="Filter by Mode" className="-mx-5 flex gap-2 overflow-x-auto px-5 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
              <span className="mr-1 inline-flex min-h-10 shrink-0 items-center font-label text-[11px] uppercase tracking-[0.16em] text-ink/50">Mode</span>
              <Chip active={!mode} href={href(null, look)}>All</Chip>
              {MODE_FILTERS.map((slug) => <Chip active={mode === slug} href={href(slug, look)} key={slug}>{MODE_PAGES[slug].name}</Chip>)}
            </nav>
            <nav aria-label="Filter by Look" className="-mx-5 flex gap-2 overflow-x-auto px-5 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
              <span className="mr-1 inline-flex min-h-10 shrink-0 items-center font-label text-[11px] uppercase tracking-[0.16em] text-ink/50">Look</span>
              <Chip active={!look} href={href(mode, null)}>All</Chip>
              {LOOKS.map((id) => <Chip active={look === id} href={href(mode, id)} key={id}>{APPEARANCE_NAMES[id]}</Chip>)}
            </nav>
          </div>

          <p aria-live="polite" className="mt-5 text-[14px] text-ink/55">{pages.length === 1 ? "1 page" : `${pages.length} pages`}{filtered && <> · <Link className="font-semibold text-ink underline decoration-ink/25 underline-offset-4 hover:decoration-ink" href="/gallery#pages" scroll={false}>Clear filters</Link></>}</p>

          {pages.length > 0
            ? <ul className="mt-6 grid gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{pages.map((entry, index) => <GalleryCard eager={index < 4} entry={entry} key={`${entry.mode}:${entry.path}`} />)}</ul>
            : (
              <div className="mt-6 rounded-[28px] bg-white px-6 py-12 text-center shadow-[inset_0_0_0_1px_rgba(13,13,13,.08)] sm:py-16">
                <p className="font-display text-[clamp(28px,3vw,40px)] font-bold leading-tight tracking-[-0.045em]">{filtered ? "No pages here yet." : "The first pages are on their way."}</p>
                <p className="mx-auto mt-3 max-w-[30rem] text-[16px] leading-[1.5] text-ink/60">{filtered ? "Nobody has listed a page with this combination yet. Yours could be the first." : "Members choose to be listed, one Mode at a time. Until then, the example pages below show what each Mode looks like."}</p>
                <div className="mt-6 flex flex-wrap justify-center gap-3">
                  {filtered && <Link className="inline-flex min-h-12 items-center rounded-full px-5 text-[15px] font-semibold shadow-[inset_0_0_0_1.5px_rgba(13,13,13,.2)] hover:shadow-[inset_0_0_0_1.5px_#0D0D0D]" href="/gallery#pages" scroll={false}>See all pages</Link>}
                  <Link className="inline-flex min-h-12 items-center rounded-full bg-ink px-6 text-[15px] font-semibold text-paper hover:bg-[#262626]" href="/signup">Make your page</Link>
                </div>
              </div>
            )}
        </div>
      </section>

      <Section eyebrow="Examples" id="examples" lede="Made by the Setuvara team to show each Mode. The people are illustrations, not members." title="Example pages, one per Mode." tone="white">
        <ul className={`${nameFontClasses} grid gap-5 sm:grid-cols-2 xl:grid-cols-4`}>
          {MODE_ORDER.map((slug) => (
            <li className="flex flex-col gap-3" key={slug}>
              <PhoneStage className="rounded-[2rem] px-4 py-7" slug={slug}><div className="relative h-[476px] w-[230px]"><div className="absolute left-0 top-0 origin-top-left scale-[.82]"><CastPhone slug={slug} /></div></div></PhoneStage>
              <p className="flex items-center justify-between text-[14px]"><span className="font-label text-[11px] uppercase tracking-[0.16em] text-ink/50">Example · {MODE_PAGES[slug].name}</span><Link className="font-semibold underline decoration-ink/25 underline-offset-4 hover:decoration-coral" href={MODE_PAGES[slug].path}>{MODE_PAGES[slug].name} Mode →</Link></p>
            </li>
          ))}
        </ul>
      </Section>

      <Section eyebrow="Get listed" id="get-listed" lede="Listing is off until you turn it on, Mode by Mode, and you can turn it off any time." title="Put your page in the gallery.">
        <ol className="grid gap-4 md:grid-cols-3">
          {[
            ["Publish your page", "Personal Mode lists at setuvara.com/yourname once your Setuvara is public."],
            ["Business or Creator? Turn on its link", "Those Modes list at their own public link. Event pages stay private and never list."],
            ["Mode Settings › Show in the gallery", "One switch per Mode. Your page drops out the moment it stops being public."],
          ].map(([title, body], index) => (
            <li className="rounded-[24px] bg-white p-6 shadow-[inset_0_0_0_1px_rgba(13,13,13,.08)]" key={title}>
              <span className="font-label text-[11px] tracking-[0.16em] text-coral">0{index + 1}</span>
              <p className="mt-4 font-display text-[22px] font-bold leading-tight tracking-[-0.04em]">{title}</p>
              <p className="mt-2 text-[15px] leading-[1.55] text-ink/65">{body}</p>
            </li>
          ))}
        </ol>
      </Section>

      <CtaBand claimId="gallery-cta" line="Free to start. Two Looks on Free, all ten on Plus." secondary={{ href: "/templates", label: "Browse templates" }} title="Make a page worth listing." />
    </>
  );
}
