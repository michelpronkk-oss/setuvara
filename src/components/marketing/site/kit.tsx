import Link from "next/link";
import type { ReactNode } from "react";

import { JsonLd } from "@/components/seo/json-ld";
import { SETUVARA_ORIGIN } from "@/lib/marketing/metadata";

import { MeetMark } from "../brand";
import type { DemoMode } from "../home/demo";
import { StageField } from "../home/phone-stage";
import { ClaimForm, Display, Label, Shell } from "../home/primitives";

/**
 * The parts every marketing landing page is built from: Mode pages, feature pages, comparisons,
 * use cases, templates and tools. The spec (Claude Design, "Setuvara Marketing Templates"):
 * Bricolage 800 at -0.055em for display, Geist body, Geist Mono labels; coral is the only accent;
 * grounds alternate paper / white / ink so each scroll has one change of light; product is shown
 * as working panels on blurred Mode stages, never as icon grids.
 */

export type Crumb = { name: string; path: string };
type ModeSlug = DemoMode["slug"];

/** Visible breadcrumbs plus their BreadcrumbList structured data. */
export function Breadcrumbs({ trail, className = "" }: { trail: Crumb[]; className?: string }) {
  // The homepage is the root of every trail; it shows none.
  if (!trail.length) return null;
  const items = [{ name: "Setuvara", path: "/" }, ...trail];
  return (
    <>
      <JsonLd data={{ "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: items.map((item, index) => ({ "@type": "ListItem", position: index + 1, name: item.name, item: new URL(item.path, SETUVARA_ORIGIN).toString() })) }} />
      <nav aria-label="Breadcrumb" className={`font-label text-[11px] uppercase tracking-[0.16em] text-ink/50 ${className}`}>
        <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {items.map((item, index) => (
            <li className="flex items-center gap-2" key={item.path}>
              {index > 0 && <span aria-hidden="true">/</span>}
              {index === items.length - 1 ? <span aria-current="page" className="text-ink">{item.name}</span> : <Link className="-my-3 inline-block rounded-sm py-3 hover:text-ink focus-visible:outline-2 focus-visible:outline-coral" href={item.path}>{item.name}</Link>}
            </li>
          ))}
        </ol>
      </nav>
    </>
  );
}

const pill = "inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-6 text-[15px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral";
const pillTone = {
  ink: "bg-ink text-paper hover:bg-[#262626]",
  coral: "bg-coral text-ink hover:bg-[#ff6e64]",
  paper: "bg-paper text-ink hover:bg-white",
  outline: "text-ink shadow-[inset_0_0_0_1.5px_rgba(13,13,13,.18)] hover:shadow-[inset_0_0_0_1.5px_#0D0D0D]",
  "outline-paper": "text-paper shadow-[inset_0_0_0_1.5px_rgba(245,244,239,.25)] hover:shadow-[inset_0_0_0_1.5px_#F5F4EF]",
} as const;

/** The site's one button shape, as a link. */
export function ButtonLink({ href, children, tone = "ink", className = "" }: { href: string; children: ReactNode; tone?: keyof typeof pillTone; className?: string }) {
  return <Link className={`${pill} ${pillTone[tone]} ${className}`} href={href}>{children}</Link>;
}

/** A Mode's blurred colour stage with grain: the ground every product moment sits on. */
export function Stage({ slug, children, className = "" }: { slug: ModeSlug; children?: ReactNode; className?: string }) {
  return (
    <div className={`relative isolate overflow-hidden rounded-[28px] [mask-image:radial-gradient(white,black)] sm:rounded-[32px] ${className}`}>
      <StageField className="-z-10" slug={slug} />
      {children}
    </div>
  );
}

/** Title left (7 of 12 columns), lede right from column 9, bottom-aligned: the head of every section. */
export function SectionHead({ id, eyebrow, title, lede, tone = "paper", as: Tag = "h2" }: { id?: string; eyebrow?: string; title: ReactNode; lede?: ReactNode; tone?: "paper" | "ink" | "coral"; as?: "h1" | "h2" }) {
  const muted = tone === "ink" ? "text-paper/60" : "text-ink/65";
  return (
    <div className="grid gap-6 lg:grid-cols-12 lg:items-end lg:gap-6">
      <div className="lg:col-span-7">
        {eyebrow ? <Label className={tone === "coral" ? "" : "text-coral"}>{eyebrow}</Label> : null}
        <Display as={Tag} className="mt-4 text-[clamp(40px,5vw,72px)] leading-[0.98] sm:mt-5 sm:leading-[0.9]"><span id={id ? `${id}-title` : undefined}>{title}</span></Display>
      </div>
      {lede ? <div className={`text-[17px] leading-[1.6] max-sm:hidden lg:col-span-4 lg:col-start-9 sm:text-[18px] ${muted}`}>{lede}</div> : null}
    </div>
  );
}

const grounds = { paper: "bg-paper", white: "bg-white", ink: "bg-ink text-paper", sand: "bg-[#EDEBE4]", coral: "bg-coral" } as const;

/** A section: eyebrow, heading and lede in the shared head, content below. */
export function Section({ id, eyebrow, title, lede, children, tone = "paper", className = "" }: { id?: string; eyebrow?: string; title?: ReactNode; lede?: ReactNode; children?: ReactNode; tone?: keyof typeof grounds; className?: string }) {
  return (
    <section aria-labelledby={id && title ? `${id}-title` : undefined} className={`scroll-mt-16 ${grounds[tone]} ${className}`} id={id}>
      <Shell className="py-20 sm:py-24 lg:py-32">
        {title ? <SectionHead eyebrow={eyebrow} id={id} lede={lede} title={title} tone={tone === "ink" ? "ink" : tone === "coral" ? "coral" : "paper"} /> : null}
        {children ? <div className={title ? "mt-12 lg:mt-[72px]" : ""}>{children}</div> : null}
      </Shell>
    </section>
  );
}

/**
 * The opening. "split": text left, a stage right (Mode pages, comparisons, use cases). "center":
 * centred title and actions with the visual full width below (feature pages, articles).
 */
export function PageHero({ crumbs, eyebrow, title, lede, visual, below, claimId, actions, note, meta, layout, tone = "paper" }: {
  crumbs: Crumb[];
  eyebrow: string;
  title: ReactNode;
  lede: ReactNode;
  visual?: ReactNode;
  below?: ReactNode;
  claimId?: string;
  actions?: ReactNode;
  note?: string;
  meta?: ReactNode;
  layout?: "split" | "center" | "wide";
  tone?: "paper" | "ink";
}) {
  const dark = tone === "ink";
  const mode = layout ?? (visual ? "split" : "wide");
  const claim = claimId ? <ClaimForm id={claimId} /> : null;
  const extras = (
    <>
      {claim ? <div className="mt-9 w-full max-w-[520px]">{claim}</div> : null}
      {actions ? <div className={`mt-9 flex flex-wrap gap-3 ${mode === "center" ? "justify-center" : ""}`}>{actions}</div> : null}
      {note ? <Label className={`mt-5 ${dark ? "text-paper/45" : "text-ink/45"}`}>{note}</Label> : null}
      {meta ? <div className="mt-6">{meta}</div> : null}
    </>
  );
  return (
    <section className={`relative overflow-hidden ${dark ? "bg-ink text-paper" : "bg-paper"}`}>
      <Shell className="relative pb-20 pt-10 sm:pt-14 lg:pb-28">
        <div className={dark ? "[&_nav]:text-paper/50 [&_nav_[aria-current]]:text-paper" : ""}><Breadcrumbs className={mode === "center" ? "lg:justify-center" : ""} trail={crumbs} /></div>
        {mode === "center" ? (
          <div className="mx-auto mt-12 flex max-w-[60rem] flex-col items-center text-center lg:mt-16">
            <Label className="text-coral">{eyebrow}</Label>
            <Display as="h1" className="mt-5 text-[clamp(50px,8vw,124px)] leading-[0.92] sm:leading-[0.86]">{title}</Display>
            <div className={`mt-7 max-w-[44rem] text-[18px] leading-[1.55] sm:text-[21px] ${dark ? "text-paper/70" : "text-ink/70"}`}>{lede}</div>
            {extras}
          </div>
        ) : mode === "split" ? (
          <div className="mt-12 grid gap-12 lg:mt-16 lg:grid-cols-12 lg:items-center lg:gap-6">
            <div className="min-w-0 lg:col-span-5">
              <Label className="text-coral">{eyebrow}</Label>
              <Display as="h1" className="mt-5 text-[clamp(50px,6.6vw,104px)] leading-[0.92] sm:leading-[0.88]">{title}</Display>
              <div className={`mt-7 max-w-[34rem] text-[18px] leading-[1.6] sm:text-[20px] ${dark ? "text-paper/70" : "text-ink/70"}`}>{lede}</div>
              {extras}
            </div>
            <div className="min-w-0 lg:col-span-7 lg:col-start-6">{visual}</div>
          </div>
        ) : (
          <div className="mt-12 grid gap-8 lg:mt-16 lg:grid-cols-12 lg:items-end lg:gap-6">
            <div className="min-w-0 lg:col-span-8">
              <Label className="text-coral">{eyebrow}</Label>
              <Display as="h1" className="mt-5 text-[clamp(50px,8vw,124px)] leading-[0.92] sm:leading-[0.86]">{title}</Display>
            </div>
            <div className="min-w-0 lg:col-span-4 lg:col-start-9">
              <div className={`text-[18px] leading-[1.6] sm:text-[19px] ${dark ? "text-paper/70" : "text-ink/70"}`}>{lede}</div>
              {extras}
            </div>
          </div>
        )}
        {below ? <div className="mt-14 lg:mt-20">{below}</div> : null}
      </Shell>
    </section>
  );
}

/**
 * Phones: a list of cards becomes one swipeable row (each card most of the screen wide, the
 * next one peeking), so a section reads as one idea instead of a long stack. From md up the
 * caller's grid takes over. Pair RAIL on the list with RAIL_ITEM on each child.
 */
export const RAIL = "max-md:-mx-5 max-md:flex max-md:flex-nowrap max-md:snap-x max-md:snap-mandatory max-md:gap-3 max-md:overflow-x-auto max-md:scroll-px-5 max-md:px-5 max-md:pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:max-md:-mx-8 sm:max-md:scroll-px-8 sm:max-md:px-8";
export const RAIL_ITEM = "max-md:w-[80%] max-md:max-w-[340px] max-md:flex-none max-md:snap-start";

/** Phones: items after the first few fold behind a toggle; wider screens show them all. CSS only. */
export function MoreOnPhone({ id, label, children, rest }: { id: string; label: string; children: ReactNode; rest: ReactNode }) {
  return (
    <>
      {children}
      <input aria-hidden="true" className="peer sr-only" id={id} tabIndex={-1} type="checkbox" />
      <div className="max-sm:hidden max-sm:peer-checked:block">{rest}</div>
      <label className="mt-6 flex min-h-12 cursor-pointer items-center justify-center rounded-full text-[14px] font-semibold shadow-[inset_0_0_0_1.5px_rgba(13,13,13,.18)] peer-checked:hidden sm:hidden" htmlFor={id}>{label}</label>
    </>
  );
}

export type Feature = { title: string; body: string; tag?: string; href?: string };

/** Index cards: a real capability per card, the tag naming the plan, an href leading further in. */
export function FeatureGrid({ items, columns = 3, tone = "white" }: { items: Feature[]; columns?: 2 | 3 | 4; tone?: "white" | "ink" }) {
  const cols = { 2: "md:grid-cols-2", 3: "md:grid-cols-2 lg:grid-cols-3", 4: "md:grid-cols-2 lg:grid-cols-4" }[columns];
  const card = tone === "ink" ? "bg-[#1B1B1B] text-paper" : "bg-white shadow-[0_30px_60px_-50px_rgba(13,13,13,.45)]";
  return (
    <ul className={`grid gap-6 ${cols} ${RAIL}`}>
      {items.map((item) => {
        const inner = (
          <>
            {item.tag ? <span className={`font-label text-[10.5px] uppercase tracking-[0.16em] ${tone === "ink" ? "text-paper/50" : "text-ink/45"}`}>{item.tag}</span> : null}
            <h3 className="mt-4 font-display text-[28px] font-extrabold leading-[0.95] tracking-[-0.05em]">{item.title}{item.href ? <span aria-hidden="true" className="ml-2 inline-block transition-transform group-hover:translate-x-1">→</span> : null}</h3>
            <p className={`mt-3 text-[15px] leading-[1.6] ${tone === "ink" ? "text-paper/60" : "text-ink/62"}`}>{item.body}</p>
          </>
        );
        return (
          <li className={`min-w-0 ${RAIL_ITEM}`} key={item.title}>
            {item.href
              ? <Link className={`group block h-full rounded-[24px] p-7 transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral sm:p-8 ${card}`} href={item.href}>{inner}</Link>
              : <div className={`h-full rounded-[24px] p-7 sm:p-8 ${card}`}>{inner}</div>}
          </li>
        );
      })}
    </ul>
  );
}

export type Faq = { q: string; a: string };

/** Questions left, answers right as native disclosures (no script), with FAQPage structured data. */
export function FaqSection({ items, title = "Questions, answered.", id = "faq", tone = "paper", single = false }: { items: Faq[]; title?: string; id?: string; tone?: "paper" | "white"; single?: boolean }) {
  return (
    <section aria-labelledby={`${id}-title`} className={`scroll-mt-16 ${tone === "white" ? "bg-white" : "bg-paper"}`} id={id}>
      <JsonLd data={{ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: items.map((item) => ({ "@type": "Question", name: item.q, acceptedAnswer: { "@type": "Answer", text: item.a } })) }} />
      <Shell className={`py-20 sm:py-24 lg:py-32 ${single ? "" : "grid gap-10 lg:grid-cols-12 lg:gap-6"}`}>
        <div className={single ? "mx-auto max-w-[680px]" : "lg:col-span-5"}>
          <Label className="text-coral">FAQ</Label>
          <Display className="mt-4 text-[clamp(40px,4.4vw,64px)] leading-[0.98] sm:leading-[0.92]"><span id={`${id}-title`}>{title}</span></Display>
        </div>
        <div className={single ? "mx-auto mt-10 max-w-[680px] border-t-[1.5px] border-ink" : "border-t-[1.5px] border-ink lg:col-span-7 lg:col-start-6"}>
          {(() => {
            const row = (item: Faq, index: number) => (
              <details className="group border-b border-ink/12" key={item.q} open={index === 0}>
                <summary className="flex min-h-11 cursor-pointer list-none items-start justify-between gap-6 py-6 text-[18px] font-semibold tracking-[-0.01em] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral sm:text-[19px] [&::-webkit-details-marker]:hidden">
                  {item.q}
                  <span aria-hidden="true" className="mt-0.5 text-[20px] font-normal leading-none text-ink/40 transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="-mt-2 max-w-[44rem] pb-7 text-[16px] leading-[1.65] text-ink/65">{item.a}</p>
              </details>
            );
            const first = items.slice(0, 3).map(row);
            return items.length > 4 ? <MoreOnPhone id={`${id}-more`} label={`${items.length - 3} more questions`} rest={items.slice(3).map((item, index) => row(item, index + 3))}>{first}</MoreOnPhone> : items.map(row);
          })()}
        </div>
      </Shell>
    </section>
  );
}

/** The closing ask on coral: one large line, the claim field and a quieter second way. */
export function CtaBand({ title, line, claimId, secondary }: { title: ReactNode; line?: string; claimId: string; secondary?: { href: string; label: string } }) {
  return (
    <section className="relative overflow-hidden bg-coral">
      <MeetMark className="pointer-events-none absolute -right-[6%] top-1/2 hidden w-[min(40vw,560px)] -translate-y-1/2 text-ink sm:block" />
      <MeetMark className="pointer-events-none absolute -right-[22%] -top-[8%] w-[78vw] text-ink sm:hidden" />
      <Shell className="relative py-20 sm:py-24 lg:py-32">
        <Label>Create your Setuvara</Label>
        <Display className="relative mt-5 max-w-[15ch] text-[clamp(50px,7.4vw,120px)] leading-[0.92] sm:leading-[0.86]">{title}</Display>
        {line ? <p className="relative mt-6 max-w-[30rem] text-[18px] leading-[1.5] text-ink/75">{line}</p> : null}
        <div className="relative mt-10 flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-6">
          <div className="w-full max-w-[520px]"><ClaimForm id={claimId} tone="coral" /></div>
          {secondary ? <Link className="inline-flex min-h-11 items-center text-[16px] font-semibold underline decoration-ink/40 decoration-[1.5px] underline-offset-4 hover:decoration-ink focus-visible:outline-2 focus-visible:outline-ink" href={secondary.href}>{secondary.label}</Link> : null}
        </div>
      </Shell>
    </section>
  );
}

/** A desktop window around a real profile drawn at desktop width. */
export function BrowserFrame({ url, children, className = "" }: { url: string; children: ReactNode; className?: string }) {
  return (
    <figure className={`overflow-hidden rounded-[18px] bg-[#1B1B1B] shadow-[0_60px_100px_-40px_rgba(13,13,13,.55),inset_0_0_0_1px_rgba(255,255,255,.06)] lg:rounded-[22px] ${className}`}>
      <div aria-hidden="true" className="flex h-9 items-center gap-2 px-4 lg:h-11">
        <span className="size-2.5 rounded-full bg-white/15" /><span className="size-2.5 rounded-full bg-white/15" /><span className="size-2.5 rounded-full bg-white/15" />
        <span className="mx-auto flex h-6 min-w-0 max-w-[420px] flex-1 items-center justify-center truncate rounded-full bg-white/[0.07] px-3 font-label text-[11px] text-white/55">{url}</span>
      </div>
      <div className="relative">{children}</div>
    </figure>
  );
}

/** Where to go next: a rule, a label and a row of white cards. The internal links that tie the site together. */
export function RelatedLinks({ title = "Keep exploring", items }: { title?: string; items: { href: string; label: string; line: string }[] }) {
  return (
    <section aria-label={title} className="bg-paper">
      <Shell className="pb-20 pt-2 sm:pb-24">
        <div className="border-t-[1.5px] border-ink pt-8">
          <Label className="text-ink/55">{title}</Label>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
            {items.map((item) => (
              <li key={item.href}>
                <Link className="group flex h-full flex-col rounded-[22px] bg-white p-6 transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral" href={item.href}>
                  <span className="font-display text-[24px] font-extrabold leading-none tracking-[-0.05em]">{item.label}<span aria-hidden="true" className="ml-2 inline-block transition-transform group-hover:translate-x-1">→</span></span>
                  <span className="mt-2.5 text-[14px] leading-[1.5] text-ink/58">{item.line}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </Shell>
    </section>
  );
}

/** The four Modes as a dark segmented switch; each opens that Mode's page. */
export function ModeSwitch({ current }: { current?: ModeSlug }) {
  const modes: { slug: ModeSlug; name: string; dot: string }[] = [
    { slug: "personal", name: "Personal", dot: "#FF5A4F" },
    { slug: "event", name: "Event", dot: "#C7FF4A" },
    { slug: "business", name: "Business", dot: "#AFCBFF" },
    { slug: "creator", name: "Creator", dot: "#E8A6FF" },
  ];
  return (
    <div className="flex flex-col items-center gap-4">
      <nav aria-label="Modes" className="grid w-full max-w-[440px] grid-cols-4 rounded-full bg-ink p-1 text-paper sm:flex sm:w-auto sm:max-w-none sm:p-1.5">
        {modes.map((mode) => (
          <Link aria-current={mode.slug === current ? "page" : undefined} className={`flex min-h-11 min-w-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-1 text-[13px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-coral sm:shrink-0 sm:gap-2 sm:px-5 sm:text-[15px] ${mode.slug === current ? "bg-paper font-semibold text-ink" : "text-paper/75 hover:text-paper"}`} href={`/${mode.slug}`} key={mode.slug}>
            <span aria-hidden="true" className="hidden size-2 shrink-0 rounded-full min-[440px]:block" style={{ background: mode.dot }} />{mode.name}
          </Link>
        ))}
      </nav>
      <Label className="text-ink/45">One identity · Four Modes</Label>
    </div>
  );
}
