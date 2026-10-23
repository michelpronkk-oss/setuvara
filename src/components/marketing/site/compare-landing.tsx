import Link from "next/link";

import { nameFontClasses } from "@/components/profile/name-fonts";
import { JsonLd } from "@/components/seo/json-ld";
import { COMPARE_PAGES } from "@/lib/marketing/compare-content";
import { SETUVARA_ORIGIN } from "@/lib/marketing/metadata";

import { MeetMark } from "../brand";
import { CastPhone } from "../home/mode-phone";
import { Label, Shell } from "../home/primitives";
import { ButtonLink, CtaBand, FaqSection, PageHero, RelatedLinks, SectionHead, Stage } from "./kit";

const FAN = [
  { slug: "personal", left: "2%", rotate: -7, top: "16%" },
  { slug: "event", left: "26%", rotate: -2, top: "12%" },
  { slug: "business", left: "50%", rotate: 2, top: "12%" },
  { slug: "creator", left: "74%", rotate: 7, top: "16%" },
] as const;

/** What the other product is, drawn as a plain schematic, never as their real design. */
const SCHEMATIC: Record<string, { label: string; rows: number; card?: boolean }> = {
  linktree: { label: "A classic link page", rows: 5 },
  beacons: { label: "A creator link page", rows: 4 },
  popl: { label: "A digital business card", rows: 3, card: true },
  carrd: { label: "A one-page site builder", rows: 3 },
};

function Hero({ slug }: { slug: string }) {
  const schematic = SCHEMATIC[slug] ?? SCHEMATIC.linktree;
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
      <Stage className={`${nameFontClasses} h-[340px] sm:h-[460px] lg:h-[520px]`} slug="personal">
        <Label className="absolute left-6 top-6 z-10 sm:left-8 sm:top-8">Setuvara · One account, four Modes</Label>
        {FAN.map((phone) => (
          <div aria-hidden="true" className="absolute origin-top scale-[.42] sm:scale-[.6] lg:scale-[.66]" inert key={phone.slug} style={{ left: phone.left, top: phone.top, transform: `rotate(${phone.rotate}deg)` }}>
            <div className="rounded-[46px] shadow-[0_40px_60px_-30px_rgba(13,13,13,.6)]"><CastPhone slug={phone.slug} /></div>
          </div>
        ))}
      </Stage>
      <div className="relative flex h-[340px] flex-col overflow-hidden rounded-[28px] bg-[#E9E6DF] p-6 sm:h-[460px] sm:p-8 lg:h-[520px]">
        <Label className="text-ink/50">{schematic.label}</Label>
        <div aria-hidden="true" className={`mx-auto mb-10 mt-8 flex w-[56%] flex-1 flex-col overflow-hidden items-center rounded-t-[30px] bg-white px-[8%] pt-8 shadow-[0_0_0_8px_#D9D5CC] ${schematic.card ? "max-h-[200px] rounded-b-[30px] pb-8" : ""}`}>
          <span className="size-14 rounded-full bg-[#D9D5CC]" />
          <span className="mt-4 h-2 w-1/2 rounded-full bg-[#D9D5CC]" />
          {Array.from({ length: schematic.rows }, (_, index) => <span className="mt-3 h-8 w-full rounded-[10px] bg-[#EFEDE7] first:mt-6" key={index} />)}
        </div>
        <p className="absolute bottom-5 left-6 text-[13px] text-ink/55 sm:left-8">Illustrative. Not their actual design.</p>
      </div>
    </div>
  );
}

/** One comparison: summary, side-by-side table, an honest "pick which when", FAQ. */
export function CompareLanding({ slug }: { slug: string }) {
  const page = COMPARE_PAGES[slug];
  const path = `/compare/${page.slug}`;
  return (
    <>
      <JsonLd data={{ "@context": "https://schema.org", "@type": "WebPage", name: page.title, url: `${SETUVARA_ORIGIN}${path}`, description: page.metaDescription, about: [{ "@type": "SoftwareApplication", name: "Setuvara", applicationCategory: "BusinessApplication" }, { "@type": "SoftwareApplication", name: page.name }] }} />
      <PageHero
        below={<Hero slug={page.slug} />}
        crumbs={[{ name: "Compare", path: "/compare" }, { name: page.name, path }]}
        eyebrow="Compare"
        layout="wide"
        lede={page.lede}
        ledeShort={page.ledeShort}
        meta={<Label className="text-ink/45">Updated Oct 2026 · {page.name} details from its public pages</Label>}
        title={<>Setuvara<br /><span className="text-ink/30">vs</span> {page.name}</>}
      />

      <section aria-labelledby="summary-title" className="bg-white">
        <Shell className="py-20 sm:py-24 lg:py-32">
          <SectionHead eyebrow="The short version" id="summary" title="Two different jobs." />
          <div className="mt-12 grid gap-6 md:grid-cols-2 lg:mt-[72px]">
            <div className="flex min-h-[280px] flex-col rounded-[28px] bg-ink p-8 text-paper sm:p-11">
              <p className="flex items-center gap-3 font-display text-[30px] font-extrabold tracking-[-0.05em]"><MeetMark className="size-8 text-coral" />Setuvara</p>
              <p className="mt-auto pt-10 text-[19px] leading-[1.6] text-paper/80">{page.summary.setuvara}</p>
            </div>
            <div className="flex min-h-[280px] flex-col rounded-[28px] bg-paper p-8 sm:p-11">
              <p className="font-display text-[30px] font-extrabold tracking-[-0.05em]">{page.name}</p>
              <p className="mt-auto pt-10 text-[19px] leading-[1.6] text-ink/70">{page.summary.them}</p>
            </div>
          </div>
        </Shell>
      </section>

      <section aria-labelledby="table-title" className="bg-paper">
        <Shell className="py-20 sm:py-24 lg:py-32">
          <SectionHead eyebrow="Side by side" id="table" lede={<>Setuvara’s side is our own plan sheet. For {page.name}’s current prices and fees, see <a className="font-semibold text-ink underline underline-offset-4" href={page.pricingUrl} rel="noopener nofollow" target="_blank">their pricing page</a>.</>} title="Line by line." />
          <div className="mt-12 overflow-x-auto rounded-[24px] bg-white p-3 shadow-[0_40px_80px_-60px_rgba(13,13,13,.5)] sm:rounded-[28px] lg:mt-[72px]">
            <table className="w-full min-w-[640px] border-separate border-spacing-0 text-left text-[15px]">
              <caption className="sr-only">Setuvara compared with {page.name}</caption>
              <thead>
                <tr>
                  <th className="w-[24%] p-5 font-label text-[10px] font-normal uppercase tracking-[0.16em] text-ink/45" scope="col">Topic</th>
                  <th className="rounded-t-[20px] bg-ink p-5 text-[17px] font-semibold text-paper" scope="col"><span className="flex items-center gap-2.5"><MeetMark className="size-5 text-coral" />Setuvara</span></th>
                  <th className="p-5 text-[17px] font-semibold" scope="col">{page.name}</th>
                </tr>
              </thead>
              <tbody>
                {page.rows.map((row, index) => {
                  const last = index === page.rows.length - 1;
                  return (
                    <tr className="align-top" key={row.topic}>
                      <th className="border-t border-ink/[0.08] p-5 font-semibold" scope="row">{row.topic}</th>
                      <td className={`border-t border-paper/10 bg-ink p-5 leading-[1.5] text-paper/90 ${last ? "rounded-b-[20px]" : ""}`}>{row.setuvara}</td>
                      <td className="border-t border-ink/[0.08] p-5 leading-[1.5] text-ink/62">{row.them}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Shell>
      </section>

      <section aria-labelledby="which-title" className="bg-paper">
        <Shell className="pb-20 sm:pb-24 lg:pb-32">
          <SectionHead eyebrow="Which one" id="which" title="Pick the one that fits." />
          <div className="mt-12 grid gap-6 md:grid-cols-2 lg:mt-[72px]">
            {[{ name: "Setuvara", items: page.pickSetuvara, coral: true }, { name: page.name, items: page.pickThem, coral: false }].map((side) => (
              <div className={`flex flex-col rounded-[28px] p-8 sm:p-11 ${side.coral ? "bg-coral" : "bg-white shadow-[0_40px_80px_-60px_rgba(13,13,13,.5)]"}`} key={side.name}>
                <h3 className="font-display text-[clamp(32px,3vw,44px)] font-extrabold leading-none tracking-[-0.055em]">Pick {side.name} if…</h3>
                <ol className="mt-8 border-t border-ink/15">
                  {side.items.map((item, index) => (
                    <li className="flex gap-6 border-b border-ink/15 py-5 text-[17px] leading-[1.5]" key={item}><span className={`mt-1 font-label text-[11px] ${side.coral ? "" : "text-ink/45"}`}>0{index + 1}</span><span className={side.coral ? "" : "text-ink/75"}>{item}</span></li>
                  ))}
                </ol>
                {side.coral ? <div className="mt-8"><ButtonLink href="/signup">Create your Setuvara</ButtonLink></div> : null}
              </div>
            ))}
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
  return (
    <ul className="grid gap-6 md:grid-cols-2">
      {Object.values(COMPARE_PAGES).map((page) => (
        <li key={page.slug}>
          <Link className="group flex h-full flex-col rounded-[28px] bg-white p-8 transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral sm:p-10" href={`/compare/${page.slug}`}>
            <span className="font-display text-[clamp(32px,3vw,44px)] font-extrabold leading-none tracking-[-0.055em]">Setuvara <span className="text-ink/30">vs</span> {page.name}</span>
            <span className="mt-4 text-[16px] leading-[1.6] text-ink/62">{page.summary.them}</span>
            <span className="mt-auto pt-6 text-[15px] font-semibold">Compare <span aria-hidden="true" className="inline-block transition-transform group-hover:translate-x-1">→</span></span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
