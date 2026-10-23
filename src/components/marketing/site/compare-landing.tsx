import { nameFontClasses } from "@/components/profile/name-fonts";
import { JsonLd } from "@/components/seo/json-ld";
import { COMPARE_PAGES } from "@/lib/marketing/compare-content";
import { SETUVARA_ORIGIN } from "@/lib/marketing/metadata";

import { MeetMark } from "../brand";
import { CastPhone } from "../home/mode-phone";
import { STAGE_PALETTES } from "../home/phone-stage";
import { Label, Shell } from "../home/primitives";
import { ButtonLink, CtaBand, FaqSection, PageHero, RAIL, RAIL_ITEM, SectionHead, Stage } from "./kit";
import { LinkCards, RelatedLinks } from "./link-cards";

const FAN = [
  { slug: "personal", left: "0%", rotate: -8, top: "17%" },
  { slug: "event", left: "24%", rotate: -2.5, top: "11%" },
  { slug: "business", left: "48%", rotate: 2.5, top: "11%" },
  { slug: "creator", left: "72%", rotate: 8, top: "17%" },
] as const;

const MODES = [
  { name: "Personal", slug: "personal" },
  { name: "Event", slug: "event" },
  { name: "Business", slug: "business" },
  { name: "Creator", slug: "creator" },
] as const;

/** What the other product is, drawn as a plain schematic, never as their real design. */
const SCHEMATIC: Record<string, { label: string; rows: number; card?: boolean }> = {
  linktree: { label: "A classic link page", rows: 5 },
  beacons: { label: "A creator link page", rows: 4 },
  popl: { label: "A digital business card", rows: 3, card: true },
  carrd: { label: "A one-page site builder", rows: 3 },
};

function Check({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" focusable="false" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.4" viewBox="0 0 16 16"><path d="m3.5 8.5 3 3 6-7" /></svg>
  );
}

/** The other product as a wireframe: an avatar, a name line and rows of links. */
function Wireframe({ slug, className = "" }: { slug: string; className?: string }) {
  const schematic = SCHEMATIC[slug] ?? SCHEMATIC.linktree;
  return (
    <div aria-hidden="true" className={`flex flex-col items-center rounded-[30px] bg-white/80 px-[10%] pt-8 shadow-[0_0_0_7px_rgba(255,255,255,.45),0_40px_60px_-40px_rgba(13,13,13,.35)] backdrop-blur-sm ${schematic.card ? "pb-8" : "pb-10"} ${className}`}>
      <span className="size-12 rounded-full bg-[#DCD8CF]" />
      <span className="mt-4 h-2 w-1/2 rounded-full bg-[#DCD8CF]" />
      {Array.from({ length: schematic.rows }, (_, index) => <span className="mt-2.5 h-7 w-full rounded-[9px] bg-[#EEECE6] first:mt-6" key={index} />)}
    </div>
  );
}

/** One stage: the four Modes fanned out, a quiet "vs", and the other product as a wireframe. */
function Hero({ slug, name }: { slug: string; name: string }) {
  const schematic = SCHEMATIC[slug] ?? SCHEMATIC.linktree;
  return (
    <div className="grid gap-2.5 sm:gap-4">
      <Stage className={`${nameFontClasses} h-[300px] sm:h-[500px] lg:h-[580px]`} slug="personal">
        <Label className="absolute left-6 top-6 z-10 text-ink/70 max-sm:text-[10px] sm:left-8 sm:top-8">Setuvara · One account, four Modes</Label>
        <div className="absolute inset-y-0 left-[5%] max-sm:top-9 right-[12%] sm:left-[4%] sm:right-[4%] lg:right-[37%]">
          {FAN.map((phone) => (
            <div aria-hidden="true" className="absolute origin-top max-sm:origin-top-left scale-[.34] min-[400px]:scale-[.38] sm:scale-[.62] lg:scale-[.7]" inert key={phone.slug} style={{ left: phone.left, top: phone.top, transform: `rotate(${phone.rotate}deg)` }}>
              <div className="rounded-[46px] shadow-[0_50px_70px_-30px_rgba(13,13,13,.55)]"><CastPhone slug={phone.slug} /></div>
            </div>
          ))}
        </div>
        {/* The other side, on desktop: a frosted panel at the stage's right edge. */}
        <div className="absolute inset-y-4 right-4 hidden w-[30%] flex-col rounded-[24px] bg-white/35 p-7 shadow-[inset_0_0_0_1px_rgba(255,255,255,.55)] backdrop-blur-xl lg:flex">
          <Label className="text-ink/55">{name} · {schematic.label}</Label>
          <div className="flex flex-1 items-center justify-center py-6"><Wireframe className="w-[70%] max-w-[220px]" slug={slug} /></div>
          <p className="text-[12px] text-ink/50">Illustrative. Not their actual design.</p>
        </div>
        <span aria-hidden="true" className="absolute right-[calc(30%+16px)] top-1/2 z-10 hidden size-14 translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-ink font-display text-[18px] font-extrabold tracking-[-0.04em] text-paper shadow-[0_20px_40px_-16px_rgba(13,13,13,.6)] lg:grid">vs</span>
      </Stage>
      {/* Phones and tablets: the other side as a slim card under the stage. */}
      <div className="flex items-center gap-4 rounded-[22px] bg-[#EAE7E0] p-3 pr-5 lg:hidden">
        <div className="h-[104px] w-[60px] flex-none overflow-hidden rounded-[14px]"><Wireframe className="w-[150px] origin-top-left scale-[.4]" slug={slug} /></div>
        <div>
          <Label className="text-ink/55">vs {name}</Label>
          <p className="mt-1.5 text-[15px] font-semibold leading-snug">{schematic.label}</p>
          <p className="mt-1 text-[12px] text-ink/50">Illustrative. Not their actual design.</p>
        </div>
      </div>
    </div>
  );
}

/** One comparison: summary, side-by-side table, an honest "pick which when", FAQ. */
export function CompareLanding({ slug }: { slug: string }) {
  const page = COMPARE_PAGES[slug];
  const path = `/compare/${page.slug}`;
  const theirPricing = <a className="inline-flex min-h-11 items-center gap-1.5 text-[14px] font-semibold underline decoration-ink/25 underline-offset-4 hover:decoration-coral focus-visible:outline-2 focus-visible:outline-coral" href={page.pricingUrl} rel="noopener nofollow" target="_blank">{page.name} pricing ↗</a>;
  return (
    <>
      <JsonLd data={{ "@context": "https://schema.org", "@type": "WebPage", name: page.title, url: `${SETUVARA_ORIGIN}${path}`, description: page.metaDescription, about: [{ "@type": "SoftwareApplication", name: "Setuvara", applicationCategory: "BusinessApplication" }, { "@type": "SoftwareApplication", name: page.name }] }} />
      <PageHero
        below={<Hero name={page.name} slug={page.slug} />}
        crumbs={[{ name: "Compare", path: "/compare" }, { name: page.name, path }]}
        eyebrow="Compare"
        layout="wide"
        lede={page.lede}
        ledeShort={page.ledeShort}
        meta={<p className="inline-flex max-w-full items-center gap-2.5 rounded-full bg-white/70 py-2 pl-3 pr-4 text-[13px] leading-tight text-ink/55 shadow-[inset_0_0_0_1px_rgba(13,13,13,.07)]"><span aria-hidden="true" className="relative flex size-2 shrink-0"><span className="absolute inset-0 rounded-full bg-[#2BB673] opacity-30 [animation:ping_2.4s_ease-out_infinite]" /><span className="relative size-2 rounded-full bg-[#2BB673]" /></span><span><span className="font-semibold text-ink">Updated Oct 2026</span> · From {page.name}’s public pages</span></p>}
        title={<>Setuvara<br /><span className="text-ink/30">vs</span> {page.name}</>}
      />

      <section aria-labelledby="summary-title" className="bg-white">
        <Shell className="py-14 sm:py-24 lg:py-32">
          <SectionHead eyebrow="The short version" id="summary" title="Two different jobs." />
          <div className="mt-8 grid gap-3 sm:mt-12 sm:gap-4 md:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:mt-[72px] lg:gap-6">
            <div className="relative isolate flex flex-col overflow-hidden rounded-[26px] bg-ink p-6 text-paper sm:min-h-[340px] sm:rounded-[32px] sm:p-11">
              <span aria-hidden="true" className="absolute -right-[10%] -top-[30%] -z-10 size-[70%] rounded-full bg-coral opacity-[.22] blur-[90px]" />
              <span aria-hidden="true" className="absolute -bottom-[35%] left-[10%] -z-10 size-[60%] rounded-full bg-[#72a7e7] opacity-[.16] blur-[90px]" />
              <MeetMark className="absolute -bottom-[18%] -right-[6%] -z-10 w-[46%] text-paper opacity-[.04]" />
              <p className="flex items-center gap-2.5 font-display text-[24px] font-extrabold tracking-[-0.05em] sm:gap-3 sm:text-[30px]"><MeetMark className="size-6 text-coral sm:size-8" />Setuvara</p>
              <p className="mt-5 max-w-[34rem] text-[16px] leading-[1.55] text-paper/85 sm:mt-10 sm:text-[22px] sm:leading-[1.5]">{page.summary.setuvara}</p>
              <ul aria-label="The four Modes" className="mt-auto flex flex-wrap gap-1.5 pt-6 sm:gap-2 sm:pt-10">
                {MODES.map((mode) => (
                  <li className="flex items-center gap-2 rounded-full bg-white/[0.08] px-3 py-1.5 text-[12px] font-semibold text-paper/90 sm:px-3.5 sm:py-2 sm:text-[13px] shadow-[inset_0_0_0_1px_rgba(255,255,255,.08)]" key={mode.slug}><span aria-hidden="true" className="size-2 rounded-full" style={{ background: STAGE_PALETTES[mode.slug].a }} />{mode.name}</li>
                ))}
              </ul>
            </div>
            <div className="flex flex-col rounded-[26px] bg-paper p-6 shadow-[inset_0_0_0_1px_rgba(13,13,13,.06)] sm:min-h-[340px] sm:rounded-[32px] sm:p-11">
              <p className="font-display text-[24px] font-extrabold tracking-[-0.05em] sm:text-[30px]">{page.name}</p>
              <p className="mt-5 max-w-[30rem] text-[16px] leading-[1.55] text-ink/70 sm:mt-10 sm:text-[22px] sm:leading-[1.5]">{page.summary.them}</p>
              <div className="mt-auto pt-5 sm:pt-10">{theirPricing}</div>
            </div>
          </div>
        </Shell>
      </section>

      <section aria-labelledby="table-title" className="bg-paper">
        <Shell className="py-14 sm:py-24 lg:py-32">
          <SectionHead eyebrow="Side by side" id="table" lede={<>Setuvara’s side is our own plan sheet. For {page.name}’s current prices and fees, see <a className="font-semibold text-ink underline underline-offset-4" href={page.pricingUrl} rel="noopener nofollow" target="_blank">their pricing page</a>.</>} title="Line by line." />
          {/* From md: one table with Setuvara's column lifted out of the sheet as a dark card. */}
          <div className="relative mt-12 hidden rounded-[32px] bg-white px-3 shadow-[0_50px_100px_-70px_rgba(13,13,13,.55)] md:block lg:mt-[80px]">
            <span aria-hidden="true" className="pointer-events-none absolute -bottom-5 -top-5 left-[calc(12px+(100%-24px)*.24)] w-[calc((100%-24px)*.42)] overflow-hidden rounded-[28px] bg-ink shadow-[0_40px_70px_-40px_rgba(13,13,13,.55)]">
              <span className="absolute -top-24 left-1/2 size-56 -translate-x-1/2 rounded-full bg-coral opacity-[.28] blur-[70px]" />
            </span>
            <table className="relative w-full table-fixed border-separate border-spacing-0 text-left text-[16px]">
              <caption className="sr-only">Setuvara compared with {page.name}</caption>
              <colgroup><col className="w-[24%]" /><col className="w-[42%]" /><col className="w-[34%]" /></colgroup>
              <thead>
                <tr>
                  <th className="px-6 pb-6 pt-8 font-label text-[11px] font-normal uppercase tracking-[0.16em] text-ink/45" scope="col">Topic</th>
                  <th className="px-7 pb-6 pt-8 text-[19px] font-semibold text-paper" scope="col"><span className="flex items-center gap-2.5 font-display font-extrabold tracking-[-0.04em]"><MeetMark className="size-6 text-coral" />Setuvara</span></th>
                  <th className="px-7 pb-6 pt-8 font-display text-[19px] font-extrabold tracking-[-0.04em]" scope="col">{page.name}</th>
                </tr>
              </thead>
              <tbody>
                {page.rows.map((row) => (
                  <tr className="align-top" key={row.topic}>
                    <th className="border-t border-ink/[0.07] px-6 py-6 text-[15px] font-semibold" scope="row">{row.topic}</th>
                    <td className="border-t border-paper/[0.09] px-7 py-6 leading-[1.5] text-paper"><span className="flex gap-3"><span className="mt-0.5 grid size-5 flex-none place-items-center rounded-full bg-coral text-ink"><Check className="size-3" /></span><span>{row.setuvara}</span></span></td>
                    <td className="border-t border-ink/[0.07] px-7 py-6 leading-[1.5] text-ink/60">{row.them}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="h-5" />
          </div>
          {/* Phones: one swipeable card per topic, Setuvara's answer on ink above theirs. */}
          <ol className={`mt-8 md:hidden max-md:items-start ${RAIL}`}>
            {page.rows.map((row) => (
              <li className={`rounded-[22px] bg-white p-1.5 shadow-[0_24px_50px_-40px_rgba(13,13,13,.45),inset_0_0_0_1px_rgba(13,13,13,.05)] ${RAIL_ITEM}`} key={row.topic}>
                <Label className="px-3.5 pb-2.5 pt-3 text-ink/50">{row.topic}</Label>
                <div className="relative overflow-hidden rounded-[17px] bg-ink px-4 py-3.5 text-paper">
                  <p className="flex items-center gap-2 text-[12px] font-semibold text-paper/60"><MeetMark className="size-3.5 text-coral" />Setuvara</p>
                  <p className="mt-1 text-[15px] leading-[1.45]">{row.setuvara}</p>
                </div>
                <div className="px-4 pb-3 pt-3.5">
                  <p className="text-[12px] font-semibold text-ink/45">{page.name}</p>
                  <p className="mt-1 text-[14px] leading-[1.45] text-ink/60">{row.them}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-1 flex items-center gap-2 font-label text-[11px] uppercase tracking-[0.14em] text-ink/45 md:hidden">Swipe to compare all {page.rows.length} <span aria-hidden="true">→</span></p>
        </Shell>
      </section>

      <section aria-labelledby="which-title" className="bg-paper">
        <Shell className="pb-14 sm:pb-24 lg:pb-32">
          <SectionHead eyebrow="Which one" id="which" title="Pick the one that fits." />
          <div className="mt-8 grid gap-3 sm:mt-12 sm:gap-4 md:grid-cols-2 lg:mt-[72px] lg:gap-6">
            <div className="relative isolate flex flex-col overflow-hidden rounded-[26px] bg-coral p-6 sm:rounded-[32px] sm:p-11">
              <MeetMark className="absolute -right-[12%] -top-[14%] -z-10 w-[58%] text-ink opacity-[.07]" />
              <h3 className="font-display text-[clamp(26px,3vw,44px)] font-extrabold leading-none tracking-[-0.055em]">Pick Setuvara if…</h3>
              <ul className="mt-6 grid gap-3.5 sm:mt-9 sm:gap-5">
                {page.pickSetuvara.map((item) => (
                  <li className="flex gap-3 text-[16px] font-medium leading-[1.45] sm:gap-4 sm:text-[18px]" key={item}><span className="mt-px grid size-6 flex-none place-items-center rounded-full sm:mt-0.5 sm:size-7 bg-ink text-coral"><Check className="size-3.5" /></span>{item}</li>
                ))}
              </ul>
              <div className="mt-auto flex flex-wrap items-center gap-x-5 gap-y-3 pt-7 sm:pt-10"><ButtonLink href="/signup">Create your Setuvara</ButtonLink><span className="font-label text-[11px] uppercase tracking-[0.16em] text-ink/70">Free to start</span></div>
            </div>
            <div className="flex flex-col rounded-[26px] bg-white p-6 shadow-[0_40px_80px_-60px_rgba(13,13,13,.45),inset_0_0_0_1px_rgba(13,13,13,.05)] sm:rounded-[32px] sm:p-11">
              <h3 className="font-display text-[clamp(26px,3vw,44px)] font-extrabold leading-none tracking-[-0.055em]">Pick {page.name} if…</h3>
              <ul className="mt-6 grid gap-3.5 sm:mt-9 sm:gap-5">
                {page.pickThem.map((item) => (
                  <li className="flex gap-3 text-[16px] leading-[1.45] text-ink/70 sm:gap-4 sm:text-[18px]" key={item}><span className="mt-px grid size-6 flex-none place-items-center rounded-full sm:mt-0.5 sm:size-7 text-ink/45 shadow-[inset_0_0_0_1.5px_rgba(13,13,13,.14)]"><Check className="size-3.5" /></span>{item}</li>
                ))}
              </ul>
              <div className="mt-auto pt-5 sm:pt-10">{theirPricing}</div>
            </div>
          </div>
        </Shell>
      </section>

      <FaqSection items={page.faq} title="Questions, answered." />
      <RelatedLinks items={page.related} />
      <CtaBand claimId={`compare-${page.slug}-cta`} line="Free to start, with all four Modes. Bring your links over in minutes." secondary={{ href: "/pricing", label: "See pricing" }} title="Try Setuvara free." />
    </>
  );
}

/** The index of comparisons, for /compare and related lists. */
export function CompareList() {
  return <LinkCards columns={2} items={Object.values(COMPARE_PAGES).map((page) => ({ href: `/compare/${page.slug}`, title: <>Setuvara <span className="text-ink/30">vs</span> {page.name}</>, line: page.ledeShort ?? page.summary.them, name: page.name }))} />;
}
