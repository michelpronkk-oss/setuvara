import Link from "next/link";
import type { ReactNode } from "react";

import { nameFontClasses } from "@/components/profile/name-fonts";

import { MeetMark } from "../brand";
import { CastPhone, ModeDesktop } from "../home/mode-phone";
import { Display, Label, Shell } from "../home/primitives";
import { BrowserFrame, Breadcrumbs, ButtonLink, Stage, type Crumb } from "./kit";

type ModeSlug = "personal" | "event" | "business" | "creator";

const DATE = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
export const articleDate = (iso: string) => DATE.format(new Date(`${iso}T00:00:00Z`));

/** The article's hero: the example page on a laptop with the phone beside it, on the Mode's stage. */
export function ArticleStage({ slug, url }: { slug: ModeSlug; url: string }) {
  return (
    <Stage className={`${nameFontClasses} aspect-[4/3] sm:aspect-[16/9] lg:aspect-[1328/700]`} slug={slug}>
      <div className="absolute left-[11%] top-[11%] hidden w-[66%] sm:block">
        <BrowserFrame url={url}><ModeDesktop fit slug={slug} /></BrowserFrame>
      </div>
      <div aria-hidden="true" className="absolute left-1/2 top-[8%] origin-top -translate-x-1/2 scale-[.5] sm:left-auto sm:right-[11%] sm:top-[20%] sm:translate-x-0 sm:origin-top-right sm:scale-[.62] lg:scale-[.78] xl:scale-[.95]" inert>
        <div className="rounded-[46px] shadow-[0_50px_80px_-30px_rgba(13,13,13,.6)]"><CastPhone slug={slug} /></div>
      </div>
    </Stage>
  );
}

/** Steps with large coral numbers, ruled between. */
export function NumberedSteps({ steps }: { steps: { title: string; body: string }[] }) {
  return (
    <ol className="mt-8 border-t border-ink/15">
      {steps.map((step, index) => (
        <li className="grid grid-cols-[48px_minmax(0,1fr)] gap-x-5 border-b border-ink/15 py-7 sm:grid-cols-[72px_minmax(0,1fr)]" key={step.title}>
          <span className="font-display text-[44px] font-extrabold leading-[0.8] tracking-[-0.05em] text-coral">{index + 1}</span>
          <div><h3 className="text-[19px] font-semibold tracking-[-0.01em]">{step.title}</h3><p className="mt-2 text-[16px] leading-[1.7] text-ink/62">{step.body}</p></div>
        </li>
      ))}
    </ol>
  );
}

export const proseH2 = "mt-20 scroll-mt-24 font-display text-[clamp(32px,3.4vw,44px)] font-extrabold leading-[0.98] tracking-[-0.05em] first:mt-0";
export const proseP = "mt-6 text-[17px] leading-[1.75] text-ink/80 sm:text-[18px]";

/** A long read: centred head, a stage, then contents · prose · a quiet way in. */
export function ArticleLayout({ crumbs, kicker, title, lede, date, minutes, hero, caption, toc, aside, children }: {
  crumbs: Crumb[];
  kicker: string;
  title: ReactNode;
  lede: string;
  date: string;
  minutes: number;
  hero: ReactNode;
  caption?: string;
  toc: { id: string; label: string }[];
  aside: { title: string; cta: string; href: string };
  children: ReactNode;
}) {
  return (
    <article className="bg-paper">
      <Shell className="pt-10 sm:pt-14">
        <div className="sr-only"><Breadcrumbs trail={crumbs} /></div>
        <div className="mx-auto flex max-w-[60rem] flex-col items-center text-center">
          <p className="font-label text-[11px] uppercase tracking-[0.16em] text-ink/50">{crumbs.slice(0, -1).map((crumb) => <Link className="hover:text-ink" href={crumb.path} key={crumb.path}>{crumb.name} / </Link>)}<span className="text-coral">{kicker}</span></p>
          <Display as="h1" className="mt-8 max-w-[14ch] text-[clamp(44px,6vw,88px)] leading-[0.9]">{title}</Display>
          <p className="mt-7 max-w-[46rem] text-[18px] leading-[1.6] text-ink/65 sm:text-[22px]">{lede}</p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
            <span className="flex items-center gap-3 text-[15px] font-semibold"><span aria-hidden="true" className="grid size-10 place-items-center rounded-full bg-ink"><MeetMark className="size-5 text-coral" /></span>The Setuvara team</span>
            <Label className="text-ink/45"><time dateTime={date}>{articleDate(date)}</time> · {minutes} min read</Label>
          </div>
        </div>
        <figure className="mt-14 lg:mt-20">
          {hero}
          {caption ? <figcaption className="mt-4 text-[14px] text-ink/55">{caption}</figcaption> : null}
        </figure>
        <div className="mt-16 grid gap-12 pb-20 lg:mt-24 lg:grid-cols-[260px_minmax(0,680px)_minmax(0,1fr)] lg:gap-x-16 lg:pb-32">
          <nav aria-label="In this article" className="hidden lg:block">
            <div className="sticky top-24 border-t-[1.5px] border-ink pt-6">
              <Label className="text-ink/45">In this article</Label>
              <ol className="mt-4 flex flex-col">
                {toc.map((item) => <li key={item.id}><a className="block border-l-2 border-transparent py-1.5 pl-3 text-[15px] text-ink/60 hover:border-coral hover:text-ink focus-visible:outline-2 focus-visible:outline-coral" href={`#${item.id}`}>{item.label}</a></li>)}
              </ol>
            </div>
          </nav>
          <div className="min-w-0 [&>p:first-of-type]:first-letter:float-left [&>p:first-of-type]:first-letter:mr-3 [&>p:first-of-type]:first-letter:font-display [&>p:first-of-type]:first-letter:text-[92px] [&>p:first-of-type]:first-letter:font-extrabold [&>p:first-of-type]:first-letter:leading-[0.78] [&>p:first-of-type]:first-letter:text-coral">{children}</div>
          <aside aria-label="Try it" className="hidden lg:block">
            <div className="sticky top-24 rounded-[24px] bg-white p-6 shadow-[0_40px_80px_-60px_rgba(13,13,13,.5)]">
              <Label className="text-coral">Try it</Label>
              <p className="mt-3 font-display text-[28px] font-extrabold leading-[0.95] tracking-[-0.05em]">{aside.title}</p>
              <ButtonLink className="mt-5 w-full" href={aside.href}>{aside.cta}</ButtonLink>
            </div>
          </aside>
        </div>
      </Shell>
    </article>
  );
}

/** "Keep reading": three cards, each a Mode stage with the phone peeking up. */
export function KeepReading({ items, all }: { items: { href: string; kicker: string; title: string; slug: ModeSlug }[]; all: { href: string; label: string } }) {
  return (
    <section aria-labelledby="keep-reading-title" className="bg-paper">
      <Shell className="pb-20 sm:pb-24 lg:pb-32">
        <div className="flex flex-wrap items-end justify-between gap-4 border-t-[1.5px] border-ink pt-12">
          <Display className="text-[clamp(40px,4.4vw,64px)] leading-[0.92]"><span id="keep-reading-title">Keep reading.</span></Display>
          <Link className="inline-flex min-h-11 items-center text-[15px] font-semibold hover:text-coral" href={all.href}>{all.label} →</Link>
        </div>
        <ul className={`${nameFontClasses} mt-10 grid gap-6 md:grid-cols-3`}>
          {items.map((item) => (
            <li className="group relative" key={item.href}>
              <Stage className="h-[260px]" slug={item.slug}>
                <div aria-hidden="true" className="absolute left-1/2 top-[12%] origin-top -translate-x-1/2 scale-[.66] transition-transform duration-500 group-hover:-translate-y-2" inert><CastPhone slug={item.slug} /></div>
              </Stage>
              <Label className="mt-5 text-coral">{item.kicker}</Label>
              <Link className="mt-2 block font-display text-[26px] font-extrabold leading-[1] tracking-[-0.05em] after:absolute after:inset-0 after:rounded-[28px] focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-4 focus-visible:after:outline-coral" href={item.href}>{item.title}</Link>
            </li>
          ))}
        </ul>
      </Shell>
    </section>
  );
}
