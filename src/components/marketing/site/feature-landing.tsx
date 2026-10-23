import { PRICES } from "@/lib/marketing/facts";
import { FEATURE_PAGES, planRowsFor, type FeatureSlug } from "@/lib/marketing/features-content";

import { Shell } from "../home/primitives";
import { ButtonLink, CtaBand, FaqSection, FeatureGrid, PageHero, RelatedLinks, Section, SectionHead } from "./kit";
import { FeatureVisual } from "./visuals";

const COLUMNS = [
  { code: "free", name: "Free", price: "$0", note: "For good", cta: { href: "/signup", label: "Start free", tone: "ink" as const } },
  { code: "plus", name: "Plus", price: PRICES.plus.monthly, note: `a month, or ${PRICES.plus.yearly} a year`, cta: { href: "/pricing", label: "See Plus", tone: "coral" as const } },
  { code: "pro", name: "Pro", price: PRICES.pro.monthly, note: `a month, or ${PRICES.pro.yearly} a year`, cta: { href: "/pricing", label: "See Pro", tone: "paper" as const } },
] as const;

const mark = (value: string) => (value === "Yes" ? "✓" : value === "—" ? "—" : value);

/** One group of limits from facts.ts as a priced table: Plus tinted coral, Pro in ink. */
export function PlanTable({ group }: { group: string }) {
  const table = planRowsFor(group);
  if (!table) return null;
  const tint = { free: "", plus: "bg-[#FFF1EF]", pro: "bg-ink text-paper" } as const;
  return (
    <div className="overflow-x-auto rounded-[24px] bg-white p-3 shadow-[0_40px_80px_-60px_rgba(13,13,13,.5)] sm:rounded-[28px] sm:p-4">
      <table className="w-full min-w-[620px] border-separate border-spacing-0 text-left text-[15px]">
        <caption className="px-5 pb-2 pt-4 text-left font-label text-[10px] uppercase tracking-[0.16em] text-ink/50">{group} limits by plan · prices in USD</caption>
        <thead>
          <tr>
            <th className="w-[38%] p-5" scope="col"><span className="sr-only">{group}</span></th>
            {COLUMNS.map((column) => (
              <th className={`p-5 align-bottom font-normal ${tint[column.code]} ${column.code === "plus" ? "rounded-t-[18px] shadow-[inset_0_2px_0_#FF5A4F]" : column.code === "pro" ? "rounded-t-[18px]" : ""}`} key={column.code} scope="col">
                <span className={`font-label text-[10px] uppercase tracking-[0.16em] ${column.code === "plus" ? "text-coral" : column.code === "pro" ? "text-paper/55" : "text-ink/50"}`}>{column.name}</span>
                <span className="mt-2 block font-display text-[clamp(30px,3.4vw,44px)] font-extrabold leading-none tracking-[-0.055em]">{column.price}</span>
                <span className={`mt-1.5 block text-[12.5px] ${column.code === "pro" ? "text-paper/55" : "text-ink/50"}`}>{column.note}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row) => (
            <tr key={row.label}>
              <th className="border-t border-ink/[0.08] px-5 py-4 font-medium" scope="row">{row.label}</th>
              {COLUMNS.map((column) => {
                const value = row[column.code];
                return <td className={`px-5 py-4 tabular-nums ${tint[column.code]} ${column.code === "free" ? "border-t border-ink/[0.08]" : ""} ${value === "—" ? (column.code === "pro" ? "text-paper/35" : "text-ink/35") : "font-semibold"}`} key={column.code}>{mark(value)}</td>;
              })}
            </tr>
          ))}
          <tr>
            <td className="p-5" />
            {COLUMNS.map((column) => (
              <td className={`px-5 pb-5 pt-3 ${tint[column.code]} ${column.code === "free" ? "" : "rounded-b-[18px]"}`} key={column.code}><ButtonLink className="w-full !min-h-11" href={column.cta.href} tone={column.cta.tone}>{column.cta.label}</ButtonLink></td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export function FeatureLanding({ slug }: { slug: FeatureSlug }) {
  const page = FEATURE_PAGES[slug];
  const steps = [...page.steps, { title: "Share the page", body: "By link, QR or a tap. It travels with you, on every Mode that shows it." }].slice(0, 4);
  return (
    <>
      <PageHero
        actions={<><ButtonLink href="/signup">Create your Setuvara</ButtonLink>{page.planGroup ? <ButtonLink href={`#${slug}-plans`} tone="outline">See the limits ↓</ButtonLink> : null}</>}
        below={
          <div>
            <FeatureVisual name={slug} />
            {page.worksWith ? (
              <p className="mt-10 flex flex-wrap items-center justify-center gap-x-7 gap-y-3 text-[15px] font-semibold">
                <span className="font-label text-[11px] font-medium uppercase tracking-[0.16em] text-ink/45">{slug === "builder" ? "Works with" : slug === "actions" ? "Action types" : "Share by"}</span>
                {page.worksWith.map((name) => <span key={name}>{name}</span>)}
              </p>
            ) : null}
          </div>
        }
        crumbs={[{ name: "Features", path: "/features" }, { name: page.name, path: `/features/${slug}` }]}
        eyebrow={page.status === "coming" ? `${page.eyebrow} · Coming soon` : page.eyebrow}
        layout="center"
        lede={page.lede}
        title={page.title}
      />

      <section aria-labelledby={`${slug}-how-title`} className="bg-ink text-paper">
        <Shell className="py-20 sm:py-24 lg:py-32">
          <SectionHead eyebrow="How it works" id={`${slug}-how`} lede={page.status === "coming" ? "Quick QR and Tap do this job today; the pass will make it one swipe." : "From a card on your page to something people use, in a few minutes."} title={page.stepsTitle ?? "Four steps."} tone="ink" />
          <ol className="mt-12 grid gap-4 sm:grid-cols-2 lg:mt-[72px] lg:grid-cols-4 lg:gap-6">
            {steps.map((step, index) => {
              const last = index === steps.length - 1;
              return (
                <li className={`flex min-h-[220px] flex-col rounded-[24px] p-7 lg:min-h-[300px] ${last ? "bg-coral text-ink" : "bg-[#1B1B1B]"}`} key={step.title}>
                  <span className={`font-label text-[11px] tracking-[0.16em] ${last ? "" : "text-coral"}`}>0{index + 1}</span>
                  <h3 className="mt-4 font-display text-[30px] font-extrabold leading-[0.95] tracking-[-0.05em]">{step.title}</h3>
                  <p className={`mt-3 text-[15px] leading-[1.55] ${last ? "text-ink/75" : "text-paper/60"}`}>{step.body}</p>
                </li>
              );
            })}
          </ol>
        </Shell>
      </section>

      <Section eyebrow={page.name} id={`${slug}-what`} lede={page.status === "coming" ? "What the pass will do. Until then, Quick QR and Tap cover it." : "Every line here is live in the app, with the plan it needs."} title="What’s in it." tone="paper">
        <FeatureGrid items={page.capabilities} />
      </Section>

      {page.planGroup ? (
        <section aria-labelledby={`${slug}-plans-title`} className="scroll-mt-16 bg-paper" id={`${slug}-plans`}>
          <Shell className="pb-20 sm:pb-24 lg:pb-32">
            <div className="border-t-[1.5px] border-ink pt-16 lg:pt-24">
              <SectionHead eyebrow="Plans" id={`${slug}-plans`} lede={`${page.name} is on every plan. Plus and Pro raise the limits.`} title="Free to start. More on Plus." />
            </div>
            <div className="mt-12 lg:mt-[72px]"><PlanTable group={page.planGroup} /></div>
          </Shell>
        </section>
      ) : null}

      <FaqSection items={page.faq} title={`${page.name}, answered.`} />
      <RelatedLinks items={page.related} />
      <CtaBand claimId={`${slug}-cta-claim`} secondary={{ href: "/pricing", label: "See pricing" }} title={page.ctaTitle ?? "Start with your name."} />
    </>
  );
}
