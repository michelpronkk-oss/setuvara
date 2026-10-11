import Link from "next/link";

import { JsonLd } from "@/components/seo/json-ld";
import { Display, Label, Shell } from "@/components/marketing/home/primitives";
import { marketingMetadata, SETUVARA_ORIGIN } from "@/lib/marketing/metadata";

export const metadata = marketingMetadata({
  title: "Setuvara | Jouw identiteit voor het echte leven",
  description: "Eén identiteit, met ruimte voor elke kant van jou. Deel de juiste context wanneer je iemand ontmoet en houd contact daarna.",
  path: "/nl",
});

const modes = [
  { number: "01", title: "Personal", detail: "Voor vrienden, nieuwe mensen en alles wat jou jou maakt.", color: "bg-[#ece9e1]" },
  { number: "02", title: "Event", detail: "Laat zien waar je bent en wie je daar wilt ontmoeten.", color: "bg-[#ffe1dc]" },
  { number: "03", title: "Business", detail: "Deel je professionele verhaal en de manier waarop mensen je bereiken.", color: "bg-[#e3ebfb]" },
];

export default function DutchHomePage() {
  return (
    <>
      <JsonLd data={{ "@context": "https://schema.org", "@type": "WebPage", name: "Setuvara", url: `${SETUVARA_ORIGIN}/nl`, inLanguage: "nl" }} />
      <section aria-labelledby="nl-hero-title" className="relative overflow-hidden">
        <Shell className="flex flex-col items-center pb-16 pt-12 text-center sm:pt-20 lg:pb-24 lg:pt-28">
          <Label className="text-coral">Personal · Event · Business</Label>
          <Display as="h1" className="mt-5 text-[clamp(46px,8vw,112px)] leading-[0.88] sm:mt-6">
            <span id="nl-hero-title">Eén identiteit.<br />Elke kant van jou.</span>
          </Display>
          <p className="mt-6 max-w-[36rem] text-[18px] leading-[1.5] text-ink/70 sm:text-[21px]">
            Deel de versie van jezelf die bij het moment past.<br className="hidden sm:block" /> Onthoud de mensen die je ontmoet.
          </p>
          <form action="/signup" className="mt-9 flex h-[60px] w-full max-w-[520px] items-center gap-1 rounded-full bg-white pl-5 pr-1.5 shadow-[inset_0_0_0_1.5px_#0d0d0d] focus-within:shadow-[inset_0_0_0_2.5px_#0d0d0d]" method="get">
            <label className="sr-only" htmlFor="nl-username">Kies je Setuvara-gebruikersnaam</label>
            <span aria-hidden="true" className="shrink-0 font-label text-[14px] text-ink/55">setuvara.com/</span>
            <input autoCapitalize="none" autoComplete="off" className="min-w-0 flex-1 bg-transparent font-label text-base font-medium text-ink outline-none placeholder:text-ink/35" id="nl-username" maxLength={24} name="username" pattern="[A-Za-z0-9_]{3,24}" placeholder="jouwnaam" spellCheck={false} title="3–24 letters, cijfers of underscores" />
            <button className="h-12 shrink-0 rounded-full bg-ink px-5 text-[15px] font-semibold text-paper transition-colors hover:bg-[#262626] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral" type="submit">Claim je naam</button>
          </form>
          <a className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-ink/70 hover:text-coral" href="#modes">Ontdek hoe het werkt <span aria-hidden="true" className="ml-1.5">↓</span></a>
        </Shell>
      </section>

      <section aria-labelledby="nl-principle-title" className="bg-ink text-paper" id="product">
        <Shell className="py-14 sm:py-20">
          <h2 className="sr-only" id="nl-principle-title">Zo werkt Setuvara</h2>
          <ol className="grid divide-y divide-paper/15 md:grid-cols-3 md:divide-x md:divide-y-0">
            {[
              ["De persoon", "staat voorop.", "Eén identiteit, altijd van jou."],
              ["De Mode", "geeft context.", "Personal, Event en Business."],
              ["Setuvara", "brengt het samen.", "Delen, verbinden en onthouden."],
            ].map(([lead, rest, note], index) => (
              <li className="flex items-baseline gap-4 py-6 md:flex-col md:gap-3 md:px-8 md:py-10 md:first:pl-0 md:last:pr-0" key={lead}>
                <span className="w-6 shrink-0 font-label text-[11px] tracking-[0.14em] text-coral">0{index + 1}</span>
                <span className="flex flex-col gap-1.5">
                  <span className="font-display text-[26px] font-bold leading-none tracking-[-0.045em]">{lead} <span className="text-coral">{rest}</span></span>
                  <span className="text-[14px] text-paper/55">{note}</span>
                </span>
              </li>
            ))}
          </ol>
        </Shell>
      </section>

      <section aria-labelledby="modes-title" className="bg-white" id="modes">
        <Shell className="py-16 sm:py-28 lg:py-36">
          <div className="max-w-3xl">
            <Label className="text-coral">Eén identiteit, drie Modes</Label>
            <Display className="mt-4 text-[clamp(40px,5vw,72px)] leading-[0.95]"><span id="modes-title">Wie je bent, krijgt kleur door wie je ontmoet.</span></Display>
            <p className="mt-5 max-w-[34rem] text-[18px] leading-[1.5] text-ink/70 sm:text-[21px]">Je kiest zelf welke details je per Mode deelt. Je profiel, links en QR passen zich aan zonder dat je een tweede account nodig hebt.</p>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-3 md:gap-5">
            {modes.map((mode) => (
              <article className={`${mode.color} min-h-56 rounded-[26px] p-6 sm:p-7`} key={mode.title}>
                <p className="font-label text-[11px] tracking-[0.14em] text-ink/55">{mode.number} · SETUVARA MODE</p>
                <h3 className="mt-12 font-display text-3xl font-bold tracking-[-0.045em]">{mode.title}</h3>
                <p className="mt-2 max-w-[24rem] text-[15px] leading-6 text-ink/70">{mode.detail}</p>
              </article>
            ))}
          </div>
        </Shell>
      </section>

      <section aria-labelledby="context-title" className="bg-ink text-paper" id="share">
        <Shell className="grid gap-8 py-16 sm:gap-12 sm:py-24 lg:grid-cols-[1.1fr_.9fr] lg:items-center lg:gap-20 lg:py-32">
          <div>
            <Label className="text-coral">Live Context</Label>
            <Display className="mt-4 text-[clamp(40px,5vw,72px)] leading-[0.95]"><span id="context-title">Een ontmoeting is meer dan een profiel.</span></Display>
            <p className="mt-5 max-w-[34rem] text-[18px] leading-[1.5] text-paper/70 sm:text-[21px]">Leg zelf vast waar en wanneer je mensen ontmoet. Deze context staat los van je Modes en wordt alleen gebruikt wanneer jij die kiest.</p>
          </div>
          <div className="rounded-[28px] bg-[#1a1a1a] p-6 sm:p-8">
            <p className="font-label text-[10px] uppercase tracking-[0.16em] text-coral">Jij bepaalt de context</p>
            <p className="mt-5 font-display text-3xl font-bold tracking-[-0.04em]">Web Summit</p>
            <p className="mt-2 text-[15px] text-paper/65">Lissabon · Portugal</p>
            <div className="mt-7 border-t border-paper/15 pt-5">
              <p className="font-label text-[10px] uppercase tracking-[0.15em] text-paper/45">Gedeelde versie</p>
              <p className="mt-2 text-lg font-semibold">Event Mode</p>
            </div>
          </div>
        </Shell>
      </section>

      <section aria-labelledby="nl-cta-title" className="relative overflow-hidden bg-coral">
        <Shell className="relative flex flex-col gap-7 py-20 sm:py-28 lg:py-36">
          <Label>Maak je Setuvara</Label>
          <Display className="max-w-[12ch] text-[clamp(56px,9vw,128px)] leading-[0.84]"><span id="nl-cta-title">Ontmoet. Blijf verbonden.</span></Display>
          <p className="max-w-[30rem] font-display text-[22px] font-bold leading-tight tracking-[-0.03em] sm:text-[26px]">Eén identiteit. Elke kant van jou.</p>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <Link className="inline-flex min-h-14 items-center justify-center rounded-full bg-ink px-7 text-[16px] font-semibold text-paper transition-colors hover:bg-[#262626] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink" href="/signup">Ontdek Setuvara</Link>
            <Link className="inline-flex min-h-11 items-center text-[16px] font-semibold underline decoration-[1.5px] underline-offset-[6px] hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink" href="/login">Inloggen</Link>
          </div>
        </Shell>
      </section>
    </>
  );
}
