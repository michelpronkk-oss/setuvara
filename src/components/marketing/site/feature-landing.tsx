import { FEATURE_PAGES, planRowsFor, type FeatureSlug } from "@/lib/marketing/features-content";

import { Shell } from "../home/primitives";
import { CtaBand, FaqSection, FeatureGrid, PageHero, RelatedLinks, Section } from "./kit";

/** A plan table for one group of limits, straight from lib/marketing/facts.ts. */
export function PlanTable({ group }: { group: string }) {
  const table = planRowsFor(group);
  if (!table) return null;
  const cell = "px-4 py-3.5 text-[15px] tabular-nums";
  return (
    <div className="overflow-x-auto rounded-[22px] bg-white shadow-[inset_0_0_0_1px_rgba(13,13,13,.08)]">
      <table className="w-full min-w-[520px] border-collapse text-left">
        <caption className="sr-only">{group} by plan</caption>
        <thead>
          <tr className="font-label text-[11px] uppercase tracking-[0.14em] text-ink/55">
            <th className={`${cell} font-normal`} scope="col">{group}</th>
            <th className={`${cell} font-normal`} scope="col">Free</th>
            <th className={`${cell} font-normal`} scope="col">Plus</th>
            <th className={`${cell} font-normal`} scope="col">Pro</th>
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row) => (
            <tr className="border-t border-ink/[0.08]" key={row.label}>
              <th className={`${cell} font-semibold`} scope="row">{row.label}</th>
              <td className={`${cell} text-ink/70`}>{row.free}</td>
              <td className={`${cell} text-ink/70`}>{row.plus}</td>
              <td className={`${cell} text-ink/70`}>{row.pro}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function FeatureLanding({ slug }: { slug: FeatureSlug }) {
  const page = FEATURE_PAGES[slug];
  return (
    <>
      <PageHero
        claimId={`${slug}-hero-claim`}
        crumbs={[{ name: "Features", path: "/features" }, { name: page.name, path: `/features/${slug}` }]}
        eyebrow={page.status === "coming" ? `${page.eyebrow} · Coming soon` : page.eyebrow}
        lede={page.lede}
        title={page.title}
      />
      <section aria-label="How it works" className="border-y border-ink/10 bg-white">
        <Shell className="py-14 sm:py-20">
          <ol className="grid gap-10 md:grid-cols-3 md:gap-8">
            {page.steps.map((step, index) => (
              <li className="border-t-2 border-ink pt-5" key={step.title}>
                <span className="font-label text-[11px] tracking-[0.14em] text-coral">0{index + 1}</span>
                <h2 className="mt-3 font-display text-[26px] font-bold leading-[1.05] tracking-[-0.04em]">{step.title}</h2>
                <p className="mt-3 text-[16px] leading-[1.55] text-ink/65">{step.body}</p>
              </li>
            ))}
          </ol>
        </Shell>
      </section>
      <Section eyebrow={page.name} id={`${slug}-what`} title="What's in it.">
        <FeatureGrid items={page.capabilities} />
      </Section>
      {page.planGroup ? (
        <Section eyebrow="By plan" id={`${slug}-plans`} lede="Free to start. Plus and Pro raise the limits." title="What each plan gets." tone="sand">
          <PlanTable group={page.planGroup} />
        </Section>
      ) : null}
      <FaqSection items={page.faq} title={`${page.name}, answered.`} />
      <RelatedLinks items={page.related} />
      <CtaBand claimId={`${slug}-cta-claim`} line="Claim your name and set up your first Mode in a few minutes. Free, with every Mode included." secondary={{ href: "/pricing", label: "Compare plans" }} title="Start with your name." />
    </>
  );
}
