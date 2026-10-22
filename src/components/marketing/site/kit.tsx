import Link from "next/link";
import type { ReactNode } from "react";

import { JsonLd } from "@/components/seo/json-ld";
import { SETUVARA_ORIGIN } from "@/lib/marketing/metadata";

import { MeetMark } from "../brand";
import { ClaimForm, Display, Label, Shell } from "../home/primitives";

/**
 * The parts every marketing landing page is built from: Mode pages, feature pages, comparisons,
 * use cases, templates and tools. One rhythm, one type scale, so thirty pages read as one site.
 */

export type Crumb = { name: string; path: string };

/** Visible breadcrumbs plus their BreadcrumbList structured data. */
export function Breadcrumbs({ trail }: { trail: Crumb[] }) {
  const items = [{ name: "Setuvara", path: "/" }, ...trail];
  return (
    <>
      <JsonLd data={{ "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: items.map((item, index) => ({ "@type": "ListItem", position: index + 1, name: item.name, item: new URL(item.path, SETUVARA_ORIGIN).toString() })) }} />
      <nav aria-label="Breadcrumb" className="font-label text-[11px] uppercase tracking-[0.14em] text-ink/50">
        <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {items.map((item, index) => (
            <li className="flex items-center gap-2" key={item.path}>
              {index > 0 && <span aria-hidden="true">/</span>}
              {index === items.length - 1 ? <span aria-current="page" className="text-ink/80">{item.name}</span> : <Link className="rounded-sm hover:text-ink focus-visible:outline-2 focus-visible:outline-coral" href={item.path}>{item.name}</Link>}
            </li>
          ))}
        </ol>
      </nav>
    </>
  );
}

/** The opening: what this page is about, in one large line, with the way in beside it. */
export function PageHero({ crumbs, eyebrow, title, lede, visual, claimId, actions, tone = "paper" }: { crumbs: Crumb[]; eyebrow: string; title: ReactNode; lede: string; visual?: ReactNode; claimId?: string; actions?: ReactNode; tone?: "paper" | "ink" }) {
  const dark = tone === "ink";
  return (
    <section className={`relative overflow-hidden ${dark ? "bg-ink text-paper" : ""}`}>
      <MeetMark className={`pointer-events-none absolute -right-[12%] top-[-8%] hidden w-[min(46vw,620px)] lg:block ${dark ? "text-paper/[0.04]" : "text-ink/[0.04]"}`} />
      <Shell className={`relative grid gap-12 pb-16 pt-8 sm:pt-12 lg:gap-16 lg:pb-24 lg:pt-16 ${visual ? "lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-center" : ""}`}>
        <div className="min-w-0">
          <div className={dark ? "[&_nav]:text-paper/55 [&_nav_[aria-current]]:text-paper/85" : ""}><Breadcrumbs trail={crumbs} /></div>
          <Label className="mt-8 text-coral">{eyebrow}</Label>
          <Display as="h1" className="mt-5 text-[clamp(44px,6.4vw,104px)] leading-[0.9]">{title}</Display>
          <p className={`mt-6 max-w-[38rem] text-[18px] leading-[1.5] sm:text-[21px] ${dark ? "text-paper/70" : "text-ink/70"}`}>{lede}</p>
          {claimId ? <div className="mt-9"><ClaimForm id={claimId} /></div> : null}
          {actions ? <div className="mt-8 flex flex-wrap gap-3">{actions}</div> : null}
        </div>
        {visual ? <div className="min-w-0">{visual}</div> : null}
      </Shell>
    </section>
  );
}

/** A section with an eyebrow, a heading and a short lede; content below. */
export function Section({ id, eyebrow, title, lede, children, tone = "paper", className = "" }: { id?: string; eyebrow?: string; title: ReactNode; lede?: ReactNode; children?: ReactNode; tone?: "paper" | "white" | "ink" | "sand"; className?: string }) {
  const bg = { paper: "", white: "bg-white", ink: "bg-ink text-paper", sand: "bg-[#E9E4D9]" }[tone];
  const muted = tone === "ink" ? "text-paper/65" : "text-ink/65";
  return (
    <section aria-labelledby={id ? `${id}-title` : undefined} className={`${bg} ${className}`} id={id}>
      <Shell className="py-16 sm:py-20 lg:py-28">
        <div className="max-w-[46rem]">
          {eyebrow ? <Label className="text-coral">{eyebrow}</Label> : null}
          <Display className="mt-4 text-[clamp(34px,4.4vw,64px)] leading-[0.95]"><span id={id ? `${id}-title` : undefined}>{title}</span></Display>
          {lede ? <p className={`mt-5 text-[17px] leading-[1.55] sm:text-[19px] ${muted}`}>{lede}</p> : null}
        </div>
        {children ? <div className="mt-10 lg:mt-14">{children}</div> : null}
      </Shell>
    </section>
  );
}

export type Feature = { title: string; body: string; tag?: string; href?: string };

/** Cards of real capabilities; a tag names the plan or kind, an href makes the card a way further in. */
export function FeatureGrid({ items, columns = 3, tone = "white" }: { items: Feature[]; columns?: 2 | 3 | 4; tone?: "white" | "ink" }) {
  const cols = { 2: "md:grid-cols-2", 3: "md:grid-cols-2 lg:grid-cols-3", 4: "md:grid-cols-2 lg:grid-cols-4" }[columns];
  const card = tone === "ink" ? "bg-[#1A1918] text-paper shadow-[inset_0_0_0_1px_rgba(245,244,239,.08)]" : "bg-white shadow-[inset_0_0_0_1px_rgba(13,13,13,.08)]";
  return (
    <ul className={`grid gap-3 sm:gap-4 ${cols}`}>
      {items.map((item) => {
        const inner = (
          <>
            {item.tag ? <span className={`font-label text-[10.5px] uppercase tracking-[0.16em] ${tone === "ink" ? "text-paper/50" : "text-ink/50"}`}>{item.tag}</span> : null}
            <h3 className="mt-3 font-display text-[23px] font-bold leading-[1.1] tracking-[-0.035em]">{item.title}</h3>
            <p className={`mt-2.5 text-[15px] leading-[1.55] ${tone === "ink" ? "text-paper/65" : "text-ink/65"}`}>{item.body}</p>
            {item.href ? <span aria-hidden="true" className="mt-5 inline-block text-[14px] font-semibold text-coral transition-transform group-hover:translate-x-0.5">Learn more →</span> : null}
          </>
        );
        return (
          <li className="min-w-0" key={item.title}>
            {item.href
              ? <Link className={`group block h-full rounded-[24px] p-6 transition-shadow hover:shadow-[inset_0_0_0_1.5px_rgba(13,13,13,.3)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral sm:p-7 ${card}`} href={item.href}>{inner}</Link>
              : <div className={`h-full rounded-[24px] p-6 sm:p-7 ${card}`}>{inner}</div>}
          </li>
        );
      })}
    </ul>
  );
}

export type Faq = { q: string; a: string };

/** Short, factual answers, with FAQPage structured data so search and AI tools can quote them. */
export function FaqSection({ items, title = "Questions, answered.", id = "faq" }: { items: Faq[]; title?: string; id?: string }) {
  return (
    <section aria-labelledby={`${id}-title`} className="border-t border-ink/10" id={id}>
      <JsonLd data={{ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: items.map((item) => ({ "@type": "Question", name: item.q, acceptedAnswer: { "@type": "Answer", text: item.a } })) }} />
      <Shell className="grid gap-10 py-16 sm:py-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] lg:gap-16 lg:py-28">
        <div>
          <Label className="text-coral">FAQ</Label>
          <Display className="mt-4 text-[clamp(34px,4vw,56px)] leading-[0.95]"><span id={`${id}-title`}>{title}</span></Display>
        </div>
        <dl className="divide-y divide-ink/10 border-y border-ink/10">
          {items.map((item) => (
            <div className="py-6" key={item.q}>
              <dt className="text-[18px] font-semibold tracking-[-0.01em]">{item.q}</dt>
              <dd className="mt-2.5 max-w-[44rem] text-[16px] leading-[1.6] text-ink/70">{item.a}</dd>
            </div>
          ))}
        </dl>
      </Shell>
    </section>
  );
}

/** The closing ask: one line, the claim field and a quieter second way. */
export function CtaBand({ title, line, claimId, secondary }: { title: ReactNode; line: string; claimId: string; secondary?: { href: string; label: string } }) {
  return (
    <section className="relative overflow-hidden bg-coral">
      <MeetMark className="pointer-events-none absolute -bottom-[30%] -right-[8%] w-[min(54vw,620px)] text-ink/[0.09]" />
      <Shell className="relative py-16 sm:py-20 lg:py-28">
        <Display className="max-w-[18ch] text-[clamp(40px,5.6vw,88px)] leading-[0.9]">{title}</Display>
        <p className="mt-5 max-w-[34rem] text-[18px] leading-[1.5] text-ink/75">{line}</p>
        <div className="mt-9 flex flex-col gap-4 sm:flex-row sm:items-center">
          <ClaimForm id={claimId} tone="coral" />
          {secondary ? <Link className="inline-flex min-h-12 items-center rounded-full px-2 text-[15px] font-semibold underline decoration-ink/30 underline-offset-4 hover:decoration-ink focus-visible:outline-2 focus-visible:outline-ink" href={secondary.href}>{secondary.label}</Link> : null}
        </div>
      </Shell>
    </section>
  );
}

/** A quiet desktop window around a real profile drawn at desktop width. */
export function BrowserFrame({ url, children, className = "" }: { url: string; children: ReactNode; className?: string }) {
  return (
    <figure className={`overflow-hidden rounded-[18px] bg-[#1B1B1B] shadow-[0_50px_90px_-40px_rgba(13,13,13,.6),inset_0_0_0_1px_rgba(255,255,255,.06)] ${className}`}>
      <div aria-hidden="true" className="flex h-9 items-center gap-2 px-4">
        <span className="size-2.5 rounded-full bg-white/15" /><span className="size-2.5 rounded-full bg-white/15" /><span className="size-2.5 rounded-full bg-white/15" />
        <span className="ml-3 flex h-6 min-w-0 flex-1 items-center justify-center truncate rounded-full bg-white/[0.07] px-3 font-label text-[11px] text-white/55">{url}</span>
      </div>
      <div className="relative">{children}</div>
    </figure>
  );
}

/** Where to go next: a short row of related pages, the internal links that tie the site together. */
export function RelatedLinks({ title = "Keep exploring", items }: { title?: string; items: { href: string; label: string; line: string }[] }) {
  return (
    <section aria-label={title} className="border-t border-ink/10 bg-white">
      <Shell className="py-14 sm:py-16">
        <Label className="text-ink/55">{title}</Label>
        <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((item) => (
            <li key={item.href}>
              <Link className="group flex h-full flex-col rounded-[20px] p-5 shadow-[inset_0_0_0_1px_rgba(13,13,13,.1)] transition-shadow hover:shadow-[inset_0_0_0_1.5px_rgba(13,13,13,.35)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral" href={item.href}>
                <span className="font-display text-[19px] font-bold tracking-[-0.03em]">{item.label}<span aria-hidden="true" className="ml-1.5 text-coral transition-transform group-hover:translate-x-0.5">→</span></span>
                <span className="mt-1.5 text-[14px] leading-[1.5] text-ink/60">{item.line}</span>
              </Link>
            </li>
          ))}
        </ul>
      </Shell>
    </section>
  );
}
