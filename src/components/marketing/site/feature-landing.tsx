import { PRICES } from "@/lib/marketing/facts";
import { FEATURE_PAGES, planRowsFor, type FeatureSlug } from "@/lib/marketing/features-content";

import { Shell } from "../home/primitives";
import { CapabilityGrid } from "./capability-visuals";
import { ButtonLink, CtaBand, FaqSection, RAIL, RAIL_ITEM, PageHero, Section, SectionHead } from "./kit";
import { RelatedLinks } from "./link-cards";
import { FeatureVisual } from "./visuals";

const COLUMNS = [
  { code: "free", name: "Free", price: "$0", note: "For good", cta: { href: "/signup", label: "Start free", tone: "ink" as const } },
  { code: "plus", name: "Plus", price: PRICES.plus.monthly, note: `a month, or ${PRICES.plus.yearly} a year`, cta: { href: "/pricing", label: "See Plus", tone: "coral" as const } },
  { code: "pro", name: "Pro", price: PRICES.pro.monthly, note: `a month, or ${PRICES.pro.yearly} a year`, cta: { href: "/pricing", label: "See Pro", tone: "paper" as const } },
] as const;

const mark = (value: string) => (value === "Yes" ? "✓" : value);

/** One group of limits from facts.ts as three plan cards: Free on white, Plus on coral, Pro in ink. */
export function PlanTable({ group }: { group: string }) {
  const table = planRowsFor(group);
  if (!table) return null;
  const skin = {
    free: { card: "bg-white text-ink", muted: "text-ink/50", rule: "border-ink/10", off: "text-ink/30" },
    plus: { card: "bg-coral text-ink", muted: "text-ink/65", rule: "border-ink/15", off: "text-ink/35" },
    pro: { card: "bg-ink text-paper", muted: "text-paper/55", rule: "border-paper/12", off: "text-paper/30" },
  } as const;
  return (
    <div>
      <p className="font-label text-[10px] uppercase tracking-[0.16em] text-ink/50">{group} limits by plan · prices in USD</p>
      <ul className="mt-5 grid gap-4 lg:grid-cols-3 lg:gap-6">
        {COLUMNS.map((column) => {
          const tone = skin[column.code];
          return (
            <li className={`relative flex flex-col overflow-hidden rounded-[28px] p-7 shadow-[0_40px_80px_-50px_rgba(13,13,13,.55)] sm:p-9 ${tone.card}`} key={column.code}>
              {column.code === "plus" ? <span aria-hidden="true" className="pointer-events-none absolute -right-16 -top-20 size-56 rounded-full bg-[#FFB3AC] opacity-70 blur-[60px]" /> : null}
              {column.code === "pro" ? <span aria-hidden="true" className="pointer-events-none absolute -right-16 -top-20 size-56 rounded-full bg-coral opacity-25 blur-[70px]" /> : null}
              <div className="relative flex items-center justify-between">
                <span className={`font-label text-[11px] uppercase tracking-[0.16em] ${tone.muted}`}>{column.name}</span>
              </div>
              <p className="relative mt-6 font-display text-[64px] font-extrabold leading-[0.85] tracking-[-0.06em]">{column.price}</p>
              <p className={`relative mt-2 text-[14px] ${tone.muted}`}>{column.note}</p>
              <ul className={`relative mt-7 flex-1 border-t ${tone.rule}`}>
                {table.rows.map((row) => {
                  const value = row[column.code];
                  return (
                    <li className={`flex items-baseline justify-between gap-4 border-b py-3.5 text-[15px] ${tone.rule}`} key={row.label}>
                      <span className={value === "—" ? tone.off : ""}>{row.label}</span>
                      <span className={`shrink-0 text-right font-semibold tabular-nums ${value === "—" ? tone.off : ""}`}>{mark(value)}</span>
                    </li>
                  );
                })}
              </ul>
              <ButtonLink className="relative mt-8 w-full" href={column.cta.href} tone={column.cta.tone === "coral" ? "ink" : column.cta.tone}>{column.cta.label}</ButtonLink>
            </li>
          );
        })}
      </ul>
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
        ledeShort={page.ledeShort}
        title={page.title}
      />

      <section aria-labelledby={`${slug}-how-title`} className="bg-ink text-paper">
        <Shell className="py-20 sm:py-24 lg:py-32">
          <SectionHead eyebrow="How it works" id={`${slug}-how`} lede={page.status === "coming" ? "Quick QR and Tap do this job today; the pass will make it one swipe." : "From a card on your page to something people use, in a few minutes."} title={page.stepsTitle ?? "Four steps."} tone="ink" />
          <ol className={`mt-12 grid gap-4 sm:grid-cols-2 lg:mt-[72px] lg:grid-cols-4 lg:gap-6 ${RAIL}`}>
            {steps.map((step, index) => {
              const last = index === steps.length - 1;
              return (
                <li className={`flex min-h-[220px] flex-col rounded-[24px] p-7 lg:min-h-[300px] ${RAIL_ITEM} ${last ? "bg-coral text-ink" : "bg-[#1B1B1B]"}`} key={step.title}>
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
        <CapabilityGrid items={page.capabilities} />
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
