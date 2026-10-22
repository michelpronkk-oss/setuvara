import Link from "next/link";

import { nameFontClasses } from "@/components/profile/name-fonts";
import { JsonLd } from "@/components/seo/json-ld";
import { SETUVARA_ORIGIN } from "@/lib/marketing/metadata";
import { MODE_PAGES } from "@/lib/marketing/modes-content";
import { USE_CASES } from "@/lib/marketing/use-cases-content";

import { CastPhone } from "../home/mode-phone";
import { PhoneStage } from "../home/phone-stage";
import { CtaBand, FaqSection, FeatureGrid, PageHero, RelatedLinks, Section } from "./kit";

/** One use case: the problem, four steps, the tools that do it, FAQ. */
export function UseCaseLanding({ slug }: { slug: string }) {
  const page = USE_CASES[slug];
  const path = `/use-cases/${page.slug}`;
  const mode = MODE_PAGES[page.mode];
  return (
    <>
      <JsonLd data={{ "@context": "https://schema.org", "@type": "WebPage", name: page.metaTitle.replace(/ \| Setuvara$/, ""), url: `${SETUVARA_ORIGIN}${path}`, description: page.metaDescription }} />
      <PageHero
        claimId={`use-${page.slug}-claim`}
        crumbs={[{ name: "Use cases", path: "/use-cases" }, { name: page.name, path }]}
        eyebrow={page.eyebrow}
        lede={page.lede}
        title={page.title}
        visual={<div className={nameFontClasses}><PhoneStage className="mx-auto w-full max-w-[420px] rounded-[2.5rem] px-6 py-10" slug={page.mode}><div className="relative h-[476px] w-[230px]"><div className="absolute left-0 top-0 origin-top-left scale-[.82]"><CastPhone slug={page.mode} /></div></div></PhoneStage></div>}
      />

      <Section eyebrow="The problem" id="problem" lede={page.problem.body} title={page.problem.title} tone="white" />

      <Section eyebrow="How it works" id="how" title="Four steps.">
        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {page.steps.map((step, index) => (
            <li className="rounded-[24px] bg-white p-6 shadow-[inset_0_0_0_1px_rgba(13,13,13,.08)]" key={step.title}>
              <span className="font-label text-[11px] tracking-[0.16em] text-coral">0{index + 1}</span>
              <h3 className="mt-4 font-display text-[22px] font-bold leading-tight tracking-[-0.04em]">{step.title}</h3>
              <p className="mt-2 text-[15px] leading-[1.55] text-ink/65">{step.body}</p>
            </li>
          ))}
        </ol>
        <p className="mt-6 text-[15px] text-ink/60">Built on <Link className="font-semibold text-ink underline decoration-ink/25 underline-offset-4 hover:decoration-ink" href={mode.path}>{mode.name} Mode</Link>.</p>
      </Section>

      <Section eyebrow="What you get" id="tools" title="The tools that do it." tone="white">
        <FeatureGrid items={page.features} />
      </Section>

      <FaqSection items={page.faq} />
      <RelatedLinks items={page.related} />
      <CtaBand claimId={`use-${page.slug}-cta`} line="Free to start, with all four Modes." secondary={{ href: mode.path, label: `See ${mode.name} Mode` }} title="Start with your name." />
    </>
  );
}
