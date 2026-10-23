import Link from "next/link";

import { JsonLd } from "@/components/seo/json-ld";
import { SETUVARA_ORIGIN } from "@/lib/marketing/metadata";
import { MODE_PAGES } from "@/lib/marketing/modes-content";
import { USE_CASE_ORDER, USE_CASES } from "@/lib/marketing/use-cases-content";

import { CAST } from "../home/mode-phone";
import { ArticleLayout, ArticleStage, KeepReading, NumberedSteps, proseH2, proseP } from "./article";
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
        caption={`${CAST[page.mode].who.name}’s ${mode.name} Mode on a laptop and a phone. Example page.`}
        crumbs={[{ name: "Use cases", path: "/use-cases" }, { name: page.name, path }]}
        date="2026-10-22"
        hero={<ArticleStage slug={page.mode} url={mode.share} />}
        kicker={page.eyebrow}
        lede={page.lede}
        minutes={4}
        title={page.title}
        toc={[{ id: "problem", label: "The problem" }, { id: "steps", label: "Four steps" }, { id: "tools", label: "What you get" }, { id: "faq", label: "Questions" }]}
      >
        <h2 className="sr-only" id="problem">{page.problem.title}</h2>
        <p className="text-[21px] leading-[1.6] text-ink sm:text-[24px]">{page.problem.title} {page.problem.body}</p>
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
