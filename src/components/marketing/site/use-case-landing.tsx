import Link from "next/link";

import { JsonLd } from "@/components/seo/json-ld";
import { SETUVARA_ORIGIN } from "@/lib/marketing/metadata";
import { MODE_PAGES } from "@/lib/marketing/modes-content";
import { USE_CASE_ORDER, USE_CASES } from "@/lib/marketing/use-cases-content";

import { ArticleLayout, KeepReading, NumberedSteps, proseH2, proseP } from "./article";
import { visualFor } from "./link-cards";
import { CtaBand, FaqSection } from "./kit";

/** One use case as a long read: the problem, four steps, what you get, questions. */
export function UseCaseLanding({ slug }: { slug: string }) {
  const page = USE_CASES[slug];
  const path = `/use-cases/${page.slug}`;
  const mode = MODE_PAGES[page.mode];
  const others = USE_CASE_ORDER.filter((other) => other !== slug).slice(0, 3);
  return (
    <>
      <JsonLd data={{ "@context": "https://schema.org", "@type": "Article", headline: page.title, description: page.metaDescription, url: `${SETUVARA_ORIGIN}${path}`, datePublished: "2026-10-22", author: { "@type": "Organization", name: "Setuvara" } }} />
      <ArticleLayout
        aside={{ title: `Your ${mode.name} page, free.`, cta: "Claim your name", href: "/signup" }}
        caption="Example page. The people shown are illustrations."
        crumbs={[{ name: "Use cases", path: "/use-cases" }, { name: page.name, path }]}
        date="2026-10-22"
        hero={<div className="mx-auto max-w-[1200px] overflow-hidden rounded-[24px] sm:rounded-[32px] [&>div]:!rounded-none">{visualFor(path, page.name)}</div>}
        kicker={page.eyebrow}
        lede={page.lede}
        ledeShort={page.ledeShort}
        minutes={4}
        title={page.title}
        toc={[{ id: "problem", label: "The problem" }, { id: "steps", label: "Four steps" }, { id: "tools", label: "What you get" }, { id: "faq", label: "Questions" }]}
      >
        <h2 className="sr-only" id="problem">{page.problem.title}</h2>
        <p className="text-[19px] leading-[1.55] text-ink sm:text-[24px] sm:leading-[1.6]">{page.problem.title} {page.problem.body}</p>
        <h2 className={proseH2} id="steps">Four steps, about ten minutes.</h2>
        <NumberedSteps steps={page.steps} />
        <h2 className={proseH2} id="tools">What you get.</h2>
        <ul className="mt-8 border-t border-ink/15">
          {page.features.map((feature) => (
            <li className="border-b border-ink/15 py-5" key={feature.title}>
              <p className={`${proseP} !mt-0`}><b className="font-semibold text-ink">{feature.title}.</b> {feature.body}{feature.href ? <> <Link className="whitespace-nowrap font-semibold text-ink underline decoration-coral decoration-2 underline-offset-4 hover:text-coral" href={feature.href}>More →</Link></> : null}</p>
            </li>
          ))}
        </ul>
        <p className={proseP}>Built on <Link className="font-semibold text-ink underline decoration-coral decoration-2 underline-offset-4" href={mode.path}>{mode.name} Mode</Link>. Your other Modes stay separate: nobody sees both unless you share both.</p>
      </ArticleLayout>
      <FaqSection items={page.faq} single title="Questions." />
      <KeepReading all={{ href: "/use-cases", label: "All use cases" }} items={others.map((other) => ({ href: `/use-cases/${other}`, kicker: USE_CASES[other].eyebrow, title: USE_CASES[other].name, slug: USE_CASES[other].mode }))} />
      <CtaBand claimId={`use-${page.slug}-cta`} secondary={{ href: mode.path, label: `See ${mode.name} Mode` }} title="Meet once. Stay connected." />
    </>
  );
}
