import type { Metadata } from "next";
import Link from "next/link";

import { EXAMPLES, ExampleGrid } from "@/components/marketing/site/gallery-grid";
import { CtaBand, PageHero, Section } from "@/components/marketing/site/kit";
import { JsonLd } from "@/components/seo/json-ld";
import { ProfileImage } from "@/components/profile/profile-image";
import { APPEARANCE_NAMES } from "@/components/profile/appearance";
import type { AppearanceId, ModeSlug } from "@/components/profile/types";
import { loadGallery, type GalleryEntry } from "@/lib/marketing/gallery";
import { marketingMetadata, SETUVARA_ORIGIN } from "@/lib/marketing/metadata";
import { MODE_PAGES } from "@/lib/marketing/modes-content";

export const revalidate = 300;

/** Real listings never include Event pages (they live on private links); the examples do. */
const MODE_FILTERS = ["personal", "event", "business", "creator"] as const satisfies readonly ModeSlug[];
const DOTS: Record<ModeSlug, string> = { personal: "#FF5A4F", event: "#C7FF4A", business: "#AFCBFF", creator: "#E8A6FF" };
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
    <Link aria-current={active ? "page" : undefined} className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full px-4 text-[14px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral ${active ? "bg-ink text-paper" : "bg-white text-ink shadow-[inset_0_0_0_1px_rgba(13,13,13,.1)] hover:shadow-[inset_0_0_0_1px_rgba(13,13,13,.4)]"}`} href={to} scroll={false}>
      {children}
    </Link>
  );
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => Array.from(part)[0]?.toUpperCase() ?? "").join("");
}

/** A member's listed page: their photo on a card, captioned like the examples. */
function GalleryCard({ entry, eager }: { entry: GalleryEntry; eager: boolean }) {
  return (
    <li className="group relative">
      <div className="relative h-[420px] overflow-hidden rounded-[28px] bg-ink lg:h-[480px]" style={entry.photo ? undefined : { background: entry.accent }}>
        {entry.photo
          ? <ProfileImage alt="" priority={eager} className="absolute inset-0 size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" fill sizes="(min-width: 1024px) 24vw, (min-width: 640px) 45vw, 92vw" src={entry.photo} style={{ objectPosition: `${entry.focus.x}% ${entry.focus.y}%` }} />
          : <span aria-hidden="true" className="absolute inset-0 grid place-items-center font-display text-[80px] font-extrabold tracking-[-0.06em] text-ink/80">{initials(entry.name)}</span>}
        <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/60 to-transparent" />
        {entry.line ? <span className="absolute inset-x-5 bottom-5 truncate text-[14px] text-white/85">{entry.line}</span> : null}
      </div>
      <p className="mt-4 flex items-baseline justify-between gap-3">
        <Link className="truncate text-[16px] font-semibold after:absolute after:inset-0 after:rounded-[28px] focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-4 focus-visible:after:outline-coral" href={`/${entry.path}`}>{entry.name}</Link>
        <span className="shrink-0 font-label text-[10px] uppercase tracking-[0.16em] text-ink/50">{MODE_PAGES[entry.mode].name} · {entry.lookName}</span>
      </p>
    </li>
  );
}

export default async function GalleryPage({ searchParams }: { searchParams: Promise<Params> }) {
  const { mode, look } = readFilters(await searchParams);
  const all = await loadGallery();
  const pages = all.filter((entry) => (!mode || entry.mode === mode) && (!look || entry.look === look));
  const examples = EXAMPLES.filter((example) => (!mode || example.mode === mode) && (!look || example.look === look));
  const filtered = Boolean(mode || look);

  return (
    <>
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: "Setuvara gallery",
        url: `${SETUVARA_ORIGIN}/gallery`,
        description: "Real Setuvara pages from members who chose to be listed, and example pages for every Look.",
        mainEntity: { "@type": "ItemList", numberOfItems: all.length, itemListElement: all.slice(0, 50).map((entry, index) => ({ "@type": "ListItem", position: index + 1, url: `${SETUVARA_ORIGIN}/${entry.path}`, name: entry.name })) },
      }} />
      <PageHero crumbs={[{ name: "Gallery", path: "/gallery" }]} eyebrow="Gallery and templates" lede="Ten Looks, each with its own phone and desktop composition. Pick one, make it yours in a minute, change it whenever you like." title={<>Real pages.<br />Real people.</>} />

      <section aria-labelledby="pages-title" className="scroll-mt-16 bg-paper" id="pages">
        <div className="mx-auto w-full max-w-[1440px] px-5 pb-20 sm:px-8 sm:pb-24 lg:px-14 lg:pb-32">
          <h2 className="sr-only" id="pages-title">Pages</h2>
          <div className="flex flex-col gap-3 border-y border-ink/10 py-5 xl:flex-row xl:items-center xl:gap-4">
            <nav aria-label="Filter by Mode" className="-mx-5 flex gap-2 overflow-x-auto px-5 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
              <span className="mr-2 inline-flex min-h-10 shrink-0 items-center font-label text-[11px] uppercase tracking-[0.16em] text-ink/50">Mode</span>
              <Chip active={!mode} href={href(null, look)}>All</Chip>
              {MODE_FILTERS.map((slug) => <Chip active={mode === slug} href={href(slug, look)} key={slug}><span aria-hidden="true" className="size-2 rounded-full" style={{ background: DOTS[slug] }} />{MODE_PAGES[slug].name}</Chip>)}
            </nav>
            <span aria-hidden="true" className="hidden h-6 w-px bg-ink/15 xl:block" />
            <nav aria-label="Filter by Look" className="-mx-5 flex gap-2 overflow-x-auto px-5 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
              <span className="mr-2 inline-flex min-h-10 shrink-0 items-center font-label text-[11px] uppercase tracking-[0.16em] text-ink/50">Look</span>
              {LOOKS.map((id) => <Chip active={look === id} href={href(mode, look === id ? null : id)} key={id}>{APPEARANCE_NAMES[id]}</Chip>)}
            </nav>
            <p aria-live="polite" className="font-label text-[11px] uppercase tracking-[0.16em] text-ink/50 xl:ml-auto xl:shrink-0">{pages.length} member {pages.length === 1 ? "page" : "pages"} · {examples.length} {examples.length === 1 ? "example" : "examples"}{filtered && <> · <Link className="text-ink underline underline-offset-4" href="/gallery#pages" scroll={false}>Clear</Link></>}</p>
          </div>

          {pages.length > 0 ? (
            <ul className="mt-12 grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">{pages.map((entry, index) => <GalleryCard eager={index < 4} entry={entry} key={`${entry.mode}:${entry.path}`} />)}</ul>
          ) : (
            <p className="mt-10 max-w-[40rem] text-[16px] leading-[1.6] text-ink/60">{filtered ? "No member has listed a page with this combination yet. Yours could be the first." : "Members choose to be listed, one Mode at a time; the first pages are on their way."} Below, example pages from the Setuvara team.</p>
          )}

          {examples.length > 0 ? (
            <div className="mt-14">
              <p className="mb-8 font-label text-[11px] uppercase tracking-[0.16em] text-ink/45">Examples · the people shown are illustrations</p>
              <ExampleGrid items={examples} />
            </div>
          ) : null}
        </div>
      </section>

      <Section eyebrow="Get listed" id="get-listed" lede="Listing is off until you turn it on, Mode by Mode, and you can turn it off any time." title="Put your page in the gallery." tone="white">
        <ol className="grid gap-6 md:grid-cols-3">
          {[
            ["Publish your page", "Personal Mode lists at setuvara.com/yourname once your Setuvara is public."],
            ["Business or Creator? Turn on its link", "Those Modes list at their own public link. Event pages stay private and never list."],
            ["Mode Settings › Show in the gallery", "One switch per Mode. Your page drops out the moment it stops being public."],
          ].map(([title, body], index) => (
            <li className="border-t-[1.5px] border-ink pt-6" key={title}>
              <span className="font-label text-[11px] tracking-[0.16em] text-coral">0{index + 1}</span>
              <p className="mt-3 font-display text-[28px] font-extrabold leading-[1] tracking-[-0.05em]">{title}</p>
              <p className="mt-3 text-[16px] leading-[1.6] text-ink/62">{body}</p>
            </li>
          ))}
        </ol>
      </Section>

      <CtaBand claimId="gallery-cta" line="Free to start. Two Looks on Free, all ten on Plus." secondary={{ href: "/templates", label: "Browse templates" }} title="Make a page worth listing." />
    </>
  );
}
