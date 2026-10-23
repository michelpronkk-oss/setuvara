"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";

import type { HelpIcon, HelpTopic } from "@/lib/marketing/help-content";

/**
 * The Help centre's working part: one search across every answer, topic cards that jump to their
 * answers, and answers that open in place. Everything is in the page's HTML, so search engines and
 * people without JavaScript still read every answer.
 */

const ICONS: Record<HelpIcon, ReactNode> = {
  start: <path d="M5 19 19 5M9 5h10v10" />,
  modes: <><rect height="14" rx="3" width="9" x="3" y="5" /><rect height="14" rx="3" width="9" x="12" y="5" opacity=".45" /></>,
  share: <><rect height="7" rx="1.5" width="7" x="4" y="4" /><rect height="7" rx="1.5" width="7" x="13" y="4" /><rect height="7" rx="1.5" width="7" x="4" y="13" /><path d="M13 13h3v3M20 20h-4M20 16v1" /></>,
  people: <><circle cx="9" cy="8.5" r="3.2" /><path d="M3.4 19.4c.7-3.1 2.9-4.9 5.6-4.9s4.9 1.8 5.6 4.9M15.4 5.4a3 3 0 0 1 0 5.9M17.2 14.6c1.8.5 3 2 3.4 4.4" /></>,
  actions: <><rect height="16" rx="3" width="16" x="4" y="4" /><path d="M8 9h8M8 13h5M8 17h3" /></>,
  store: <><path d="M5 8h14l-1 11a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1L5 8Z" /><path d="M9 8V6.5a3 3 0 0 1 6 0V8" /></>,
  builder: <path d="M5 19V13M10 19V9M15 19v-4M20 19V5" />,
  billing: <><rect height="13" rx="2.5" width="18" x="3" y="5.5" /><path d="M3 10h18M7 15h4" /></>,
  privacy: <><rect height="10" rx="2.5" width="14" x="5" y="10" /><path d="M8 10V7.5a4 4 0 0 1 8 0V10" /></>,
};

function Icon({ name, className = "size-6" }: { name: HelpIcon; className?: string }) {
  return <svg aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24">{ICONS[name]}</svg>;
}

const normalize = (value: string) => value.toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N}\s]/gu, " ");

export function HelpCenter({ topics, popular }: { topics: HelpTopic[]; popular: string[] }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const words = normalize(query).split(/\s+/).filter(Boolean);
  const results = useMemo(() => {
    if (!words.length) return [];
    return topics.flatMap((topic) => topic.items.map((item) => ({ topic, item }))).filter(({ topic, item }) => {
      const text = normalize(`${item.q} ${item.a} ${topic.title}`);
      return words.every((word) => text.includes(word));
    });
  }, [topics, words]);

  const ask = (q: string) => { setQuery(q); setOpen(q); };

  return (
    <>
      <section aria-labelledby="help-title" className="relative isolate overflow-hidden bg-ink text-paper">
        <span aria-hidden="true" className="absolute -right-40 -top-40 -z-10 size-[620px] rounded-full bg-coral/25 blur-[140px]" />
        <span aria-hidden="true" className="absolute -bottom-56 -left-40 -z-10 size-[520px] rounded-full bg-[#C7FF4A]/10 blur-[140px]" />
        <div className="mx-auto w-full max-w-[1440px] px-5 pb-16 pt-14 sm:px-8 sm:pb-24 sm:pt-20 lg:px-14 lg:pb-28 lg:pt-24">
          <p className="font-label text-[11px] uppercase tracking-[0.16em] text-coral">Help centre</p>
          <h1 className="mt-5 max-w-[14ch] font-display text-[clamp(48px,8vw,128px)] font-extrabold leading-[0.88] tracking-[-0.06em]" id="help-title">How can we help?</h1>
          <p className="mt-6 max-w-[34rem] text-[17px] leading-[1.5] text-paper/65 sm:text-[20px]">Answers about your page, sharing, Connections, plans and your data, straight from how Setuvara works today.</p>

          <div className="mt-10 max-w-[760px]">
            <label className="sr-only" htmlFor="help-search">Search help</label>
            <div className="flex items-center gap-3 rounded-full bg-paper px-5 text-ink shadow-[0_40px_80px_-40px_rgba(0,0,0,.8)] focus-within:outline-2 focus-within:outline-offset-4 focus-within:outline-coral sm:px-7">
              <svg aria-hidden="true" className="size-5 shrink-0 text-ink/45" fill="none" viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="2" /><path d="m16 16 4 4" stroke="currentColor" strokeLinecap="round" strokeWidth="2" /></svg>
              <input autoComplete="off" className="min-h-[64px] min-w-0 flex-1 bg-transparent [&::-webkit-search-cancel-button]:hidden text-[17px] outline-none placeholder:text-ink/40 sm:min-h-[72px] sm:text-[19px]" id="help-search" onChange={(event) => setQuery(event.target.value)} placeholder="Search: QR, cancel, refund, Connections…" type="search" value={query} />
              {query && <button className="shrink-0 rounded-full bg-ink/[0.06] px-3.5 py-2 text-[13px] font-semibold" onClick={() => setQuery("")} type="button">Clear</button>}
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <span className="py-2 font-label text-[11px] uppercase tracking-[0.14em] text-paper/45">Popular</span>
              {popular.map((q) => <button className="rounded-full bg-white/[0.08] px-4 py-2 text-[13px] font-semibold text-paper/85 transition-colors hover:bg-white/[0.14] focus-visible:outline-2 focus-visible:outline-coral" key={q} onClick={() => ask(q)} type="button">{q}</button>)}
            </div>
          </div>

          {words.length > 0 && (
            <div aria-live="polite" className="mt-10 max-w-[900px]">
              <p className="font-label text-[11px] uppercase tracking-[0.14em] text-paper/50">{results.length} {results.length === 1 ? "answer" : "answers"}</p>
              {results.length ? (
                <ul className="mt-4 flex flex-col gap-3">
                  {results.map(({ topic, item }) => (
                    <li className="rounded-[24px] bg-white/[0.06] p-6 shadow-[inset_0_0_0_1px_rgba(245,244,239,.08)]" key={item.q}>
                      <p className="flex items-center gap-2 font-label text-[10px] uppercase tracking-[0.14em] text-coral"><Icon className="size-3.5" name={topic.icon} />{topic.title}</p>
                      <p className="mt-2 text-[19px] font-semibold leading-snug">{item.q}</p>
                      <p className="mt-2 text-[15px] leading-[1.65] text-paper/70">{item.a}</p>
                      <Links dark item={item} />
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="mt-4 rounded-[24px] bg-white/[0.06] p-6">
                  <p className="text-[18px] font-semibold">No answer for that yet.</p>
                  <p className="mt-1 text-[15px] text-paper/65">Try another word, or <Link className="font-semibold text-paper underline underline-offset-4" href="/contact">ask us directly</Link>. A person reads every message.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      <section aria-labelledby="topics-title" className="bg-paper">
        <div className="mx-auto w-full max-w-[1440px] px-5 py-16 sm:px-8 sm:py-24 lg:px-14">
          <h2 className="font-display text-[clamp(34px,4.4vw,64px)] font-extrabold leading-[0.95] tracking-[-0.055em]" id="topics-title">Browse by topic.</h2>
          <ul className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:gap-4">
            {topics.map((topic, index) => (
              <li key={topic.id}>
                <a className="group flex h-full items-start gap-5 rounded-[28px] bg-white p-6 shadow-[0_40px_80px_-60px_rgba(13,13,13,.5)] transition-transform duration-300 hover:-translate-y-1 focus-visible:outline-2 focus-visible:outline-coral sm:p-7" href={`#${topic.id}`}>
                  <span className={`grid size-14 shrink-0 place-items-center rounded-[18px] ${index === 0 ? "bg-coral text-ink" : "bg-ink text-paper"}`}><Icon name={topic.icon} /></span>
                  <span className="min-w-0">
                    <span className="block font-display text-[23px] font-extrabold leading-tight tracking-[-0.04em]">{topic.title}<span aria-hidden="true" className="ml-2 inline-block transition-transform group-hover:translate-x-1">→</span></span>
                    <span className="mt-1.5 block text-[14.5px] leading-[1.5] text-ink/60">{topic.line}</span>
                    <span className="mt-3 block font-label text-[10px] uppercase tracking-[0.14em] text-ink/40">{topic.items.length} answers</span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <div className="bg-white">
        <div className="mx-auto grid w-full max-w-[1440px] gap-x-16 px-5 py-8 sm:px-8 lg:grid-cols-[280px_minmax(0,1fr)] lg:px-14 lg:py-20">
          <nav aria-label="Help topics" className="hidden lg:block">
            <ul className="sticky top-24 flex flex-col gap-1">
              {topics.map((topic) => <li key={topic.id}><a className="flex items-center gap-3 rounded-2xl px-4 py-3 text-[15px] font-semibold text-ink/70 transition-colors hover:bg-paper hover:text-ink" href={`#${topic.id}`}><Icon className="size-[18px]" name={topic.icon} />{topic.title}</a></li>)}
            </ul>
          </nav>
          <div className="flex flex-col">
            {topics.map((topic) => (
              <section aria-labelledby={`${topic.id}-title`} className="scroll-mt-20 border-b border-ink/10 py-12 last:border-0 sm:py-16 lg:first:pt-0" id={topic.id} key={topic.id}>
                <div className="flex items-center gap-4">
                  <span className="grid size-12 shrink-0 place-items-center rounded-[16px] bg-ink text-paper"><Icon className="size-[22px]" name={topic.icon} /></span>
                  <h2 className="font-display text-[clamp(28px,3vw,42px)] font-extrabold leading-none tracking-[-0.05em]" id={`${topic.id}-title`}>{topic.title}</h2>
                </div>
                <div className="mt-8 flex flex-col gap-2.5">
                  {topic.items.map((item) => (
                    <details className="group rounded-[22px] bg-paper px-5 open:bg-[#EFEDE6] sm:px-7" key={item.q} onToggle={(event) => { if ((event.currentTarget as HTMLDetailsElement).open) setOpen(item.q); }} open={open === item.q}>
                      <summary className="flex min-h-[68px] cursor-pointer list-none items-center justify-between gap-4 py-4 text-[17px] font-semibold leading-snug sm:text-[18px] [&::-webkit-details-marker]:hidden">
                        {item.q}
                        <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-full bg-white text-[18px] transition-transform group-open:rotate-45">+</span>
                      </summary>
                      <div className="pb-6 pr-2 sm:pr-14">
                        <p className="text-[16px] leading-[1.7] text-ink/75">{item.a}</p>
                        <Links item={item} />
                      </div>
                    </details>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

function Links({ item, dark = false }: { item: HelpTopic["items"][number]; dark?: boolean }) {
  if (!item.links?.length) return null;
  return (
    <p className="mt-4 flex flex-wrap gap-2">
      {item.links.map((link) => <Link className={`inline-flex min-h-10 items-center gap-1.5 rounded-full px-4 text-[13px] font-semibold ${dark ? "bg-paper text-ink" : "bg-ink text-paper"}`} href={link.href} key={link.href}>{link.label}<span aria-hidden="true">→</span></Link>)}
    </p>
  );
}
