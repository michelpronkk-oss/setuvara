import Link from "next/link";

import { JsonLd } from "@/components/seo/json-ld";
import { COMPARE_PAGES } from "@/lib/marketing/compare-content";
import { SETUVARA_ORIGIN } from "@/lib/marketing/metadata";

import { CtaBand, FaqSection, PageHero, RelatedLinks, Section } from "./kit";

/** One comparison: summary, side-by-side table, an honest "pick which when", FAQ. */
export function CompareLanding({ slug }: { slug: string }) {
  const page = COMPARE_PAGES[slug];
  const path = `/compare/${page.slug}`;
  return (
    <>
      <JsonLd data={{ "@context": "https://schema.org", "@type": "WebPage", name: page.title, url: `${SETUVARA_ORIGIN}${path}`, description: page.metaDescription, about: [{ "@type": "SoftwareApplication", name: "Setuvara", applicationCategory: "BusinessApplication" }, { "@type": "SoftwareApplication", name: page.name }] }} />
      <PageHero claimId={`compare-${page.slug}-claim`} crumbs={[{ name: "Compare", path: "/compare" }, { name: `vs ${page.name}`, path }]} eyebrow="Compare" lede={page.lede} title={page.title} />

      <Section eyebrow="In short" id="summary" title="Two different ideas." tone="white">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-[24px] bg-ink p-6 text-paper sm:p-8"><p className="font-label text-[11px] uppercase tracking-[0.16em] text-coral">Setuvara</p><p className="mt-4 text-[18px] leading-[1.5]">{page.summary.setuvara}</p></div>
          <div className="rounded-[24px] bg-paper p-6 sm:p-8"><p className="font-label text-[11px] uppercase tracking-[0.16em] text-ink/55">{page.name}</p><p className="mt-4 text-[18px] leading-[1.5] text-ink/80">{page.summary.them}</p></div>
        </div>
      </Section>

      <Section eyebrow="Side by side" id="table" lede={<>Setuvara’s side is our own plan sheet. For {page.name}’s current prices and fees, see <a className="font-semibold underline underline-offset-4" href={page.pricingUrl} rel="noopener nofollow" target="_blank">their pricing page</a>.</>} title={`Setuvara and ${page.name}, line by line.`}>
        <div className="overflow-hidden rounded-[24px] bg-white shadow-[inset_0_0_0_1px_rgba(13,13,13,.08)]">
          <table className="w-full border-collapse text-left text-[15px]">
            <caption className="sr-only">Setuvara compared with {page.name}</caption>
            <thead><tr className="border-b border-ink/10"><th className="w-[24%] p-4 font-label text-[11px] font-normal uppercase tracking-[0.14em] text-ink/50 sm:p-5" scope="col"><span className="sr-only">Topic</span></th><th className="p-4 font-display text-[18px] font-bold tracking-[-0.03em] sm:p-5" scope="col">Setuvara</th><th className="p-4 font-display text-[18px] font-bold tracking-[-0.03em] text-ink/60 sm:p-5" scope="col">{page.name}</th></tr></thead>
            <tbody>
              {page.rows.map((row) => (
                <tr className="border-b border-ink/10 align-top last:border-0" key={row.topic}>
                  <th className="p-4 text-[13px] font-semibold sm:p-5 sm:text-[15px]" scope="row">{row.topic}</th>
                  <td className="p-4 text-[13.5px] leading-[1.5] sm:p-5 sm:text-[15px]">{row.setuvara}</td>
                  <td className="p-4 text-[13.5px] leading-[1.5] text-ink/65 sm:p-5 sm:text-[15px]">{row.them}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section eyebrow="Which one" id="which" title="Pick the one that fits." tone="white">
        <div className="grid gap-4 md:grid-cols-2">
          {[{ name: "Setuvara", items: page.pickSetuvara, dark: true }, { name: page.name, items: page.pickThem, dark: false }].map((side) => (
            <div className={`rounded-[24px] p-6 sm:p-8 ${side.dark ? "bg-ink text-paper" : "bg-paper"}`} key={side.name}>
              <h3 className="font-display text-[26px] font-bold tracking-[-0.04em]">Pick {side.name} if…</h3>
              <ul className="mt-5 flex flex-col gap-3">{side.items.map((item) => <li className="flex gap-3 text-[16px] leading-[1.5]" key={item}><span aria-hidden="true" className="mt-[9px] size-1.5 shrink-0 rounded-full bg-coral" />{item}</li>)}</ul>
            </div>
          ))}
        </div>
      </Section>

      <FaqSection items={page.faq} title={`Setuvara vs ${page.name}, answered.`} />
      <RelatedLinks items={page.related} />
      <CtaBand claimId={`compare-${page.slug}-cta`} line="Free to start, with all four Modes. Bring your links over in minutes." secondary={{ href: "/pricing", label: "See pricing" }} title="Try Setuvara free." />
    </>
  );
}

/** The index of comparisons, for /compare and related lists. */
export function CompareList() {
  return (
    <ul className="grid gap-4 md:grid-cols-2">
      {Object.values(COMPARE_PAGES).map((page) => (
        <li key={page.slug}>
          <Link className="group flex h-full flex-col rounded-[24px] bg-white p-6 shadow-[inset_0_0_0_1px_rgba(13,13,13,.08)] transition-shadow hover:shadow-[inset_0_0_0_1.5px_#0D0D0D] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral sm:p-8" href={`/compare/${page.slug}`}>
            <span className="font-display text-[28px] font-bold tracking-[-0.045em]">{page.title}</span>
            <span className="mt-3 text-[16px] leading-[1.5] text-ink/65">{page.summary.them}</span>
            <span className="mt-auto pt-5 text-[15px] font-semibold">Compare →</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
