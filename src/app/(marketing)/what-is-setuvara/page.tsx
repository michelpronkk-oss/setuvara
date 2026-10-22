import Link from "next/link";

import { CtaBand, FaqSection, PageHero, Section } from "@/components/marketing/site/kit";
import { JsonLd } from "@/components/seo/json-ld";
import { CATEGORY_LINE, COMING, EVERY_PLAN, LOOKS, MODES, NOT_THIS, ONE_LINER, PLAN_LIMITS, PRICE_LINE, PRICE_NUMBERS, PRICES } from "@/lib/marketing/facts";
import { marketingMetadata, SETUVARA_ORGANIZATION_ID, SETUVARA_ORIGIN } from "@/lib/marketing/metadata";

export const metadata = marketingMetadata({
  title: "What is Setuvara? A plain-language explanation | Setuvara",
  description: "Setuvara in plain words: one account with a page for each part of your life, shared by link, QR or tap, that remembers everyone you meet.",
  path: "/what-is-setuvara",
});

const LOOP = [
  ["Identity", "You claim a name: setuvara.com/yourname. One account, one person."],
  ["Mode", "You fill in the Modes you need. Each is its own page with its own links, look, link and QR."],
  ["Share", "You share one Mode by link, QR code, Quick QR from your lock screen, or a tap of an NFC card. People only see that Mode."],
  ["Connect", "The other person connects in one tap, without an app or an account."],
  ["Stay connected", "Setuvara keeps where and when you met and a private note. Then you share again."],
] as const;

const FAQ = [
  { q: "What is Setuvara?", a: ONE_LINER },
  { q: "Is Setuvara a link in bio?", a: `It can be. ${CATEGORY_LINE} Your Personal or Creator Mode works as a link in bio, and the same account has pages for events and work.` },
  { q: "Is Setuvara a digital business card?", a: "Yes. Business Mode is a digital business card shared by link, QR code or NFC tap, with booking, lead capture, testimonials and Builder." },
  { q: "How much does Setuvara cost?", a: PRICE_LINE },
  { q: "Does the other person need Setuvara?", a: "No. Your page opens in any browser, and they can connect in one tap without an account." },
  { q: "What is a Mode?", a: "A version of your page for one part of your life: Personal, Event, Business or Creator. Each has its own links, look, link and QR, and visitors only see the Mode you share." },
];

export default function WhatIsSetuvara() {
  return (
    <>
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        name: "Setuvara",
        url: SETUVARA_ORIGIN,
        description: ONE_LINER,
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        publisher: { "@id": SETUVARA_ORGANIZATION_ID },
        offers: [
          { "@type": "Offer", name: "Free", price: "0", priceCurrency: "USD" },
          { "@type": "Offer", name: "Plus (monthly)", price: String(PRICE_NUMBERS.plus.monthly), priceCurrency: "USD" },
          { "@type": "Offer", name: "Plus (yearly)", price: String(PRICE_NUMBERS.plus.yearly), priceCurrency: "USD" },
          { "@type": "Offer", name: "Pro (monthly)", price: String(PRICE_NUMBERS.pro.monthly), priceCurrency: "USD" },
          { "@type": "Offer", name: "Pro (yearly)", price: String(PRICE_NUMBERS.pro.yearly), priceCurrency: "USD" },
        ],
      }} />
      <PageHero claimId="what-claim" crumbs={[{ name: "What is Setuvara", path: "/what-is-setuvara" }]} eyebrow="In plain words" lede={ONE_LINER} title="What is Setuvara?" />

      <Section eyebrow="In one line" id="category" title={CATEGORY_LINE} tone="white">
        <p className="max-w-[44rem] text-[18px] leading-[1.6] text-ink/75">Most tools do one of these. Setuvara is one account that does all three, because they are the same moment: someone wants to know who you are and how to stay in touch.</p>
      </Section>

      <Section eyebrow="How it works" id="how" title="Five steps.">
        <ol className="grid gap-px overflow-hidden rounded-[24px] bg-ink/10 sm:grid-cols-2 lg:grid-cols-5">
          {LOOP.map(([title, line], index) => (
            <li className="bg-paper p-6" key={title}>
              <span className="font-label text-[11px] tracking-[0.16em] text-coral">0{index + 1}</span>
              <h3 className="mt-4 font-display text-[22px] font-bold tracking-[-0.04em]">{title}</h3>
              <p className="mt-2 text-[15px] leading-[1.55] text-ink/70">{line}</p>
            </li>
          ))}
        </ol>
      </Section>

      <Section eyebrow="The four Modes" id="modes" title="A page for each part of your life." tone="white">
        <dl className="grid gap-4 md:grid-cols-2">
          {MODES.map((mode) => (
            <div className="rounded-[24px] bg-paper p-6" key={mode.slug}>
              <dt className="font-display text-[24px] font-bold tracking-[-0.04em]"><Link className="hover:text-coral" href={`/${mode.slug}`}>{mode.name} Mode</Link></dt>
              <dd className="mt-2 text-[16px] leading-[1.55] text-ink/70">{mode.line}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-6 text-[16px] text-ink/65">{LOOKS.total} Looks style any Mode: {LOOKS.all.join(", ")}. {LOOKS.free.join(" and ")} are free.</p>
      </Section>

      <Section eyebrow="Price" id="price" lede={PRICE_LINE} title="Free to start.">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-[24px] bg-white p-6 shadow-[inset_0_0_0_1px_rgba(13,13,13,.08)]">
            <h3 className="font-display text-[22px] font-bold tracking-[-0.04em]">On every plan</h3>
            <ul className="mt-4 flex flex-col gap-2">{EVERY_PLAN.map((item) => <li className="flex gap-3 text-[15px] leading-[1.5]" key={item}><span aria-hidden="true" className="mt-[8px] size-1.5 shrink-0 rounded-full bg-coral" />{item}</li>)}</ul>
          </div>
          <div className="rounded-[24px] bg-white p-6 shadow-[inset_0_0_0_1px_rgba(13,13,13,.08)]">
            <h3 className="font-display text-[22px] font-bold tracking-[-0.04em]">What Plus ({PRICES.plus.monthly}) and Pro ({PRICES.pro.monthly}) add</h3>
            <ul className="mt-4 flex flex-col gap-2">
              {PLAN_LIMITS.flatMap((group) => group.rows).filter((row) => row.free !== row.plus || row.plus !== row.pro).slice(0, 9).map((row) => <li className="flex gap-3 text-[15px] leading-[1.5]" key={row.label}><span aria-hidden="true" className="mt-[8px] size-1.5 shrink-0 rounded-full bg-coral" /><span><b className="font-semibold">{row.label}:</b> Free {row.free}, Plus {row.plus}, Pro {row.pro}</span></li>)}
            </ul>
            <Link className="mt-4 inline-flex min-h-11 items-center text-[15px] font-semibold underline decoration-ink/25 underline-offset-4 hover:decoration-ink" href="/pricing#compare">Every line, compared →</Link>
          </div>
        </div>
      </Section>

      <Section eyebrow="Clear lines" id="not" title="What Setuvara is not." tone="white">
        <ul className="grid gap-4 md:grid-cols-2">{NOT_THIS.map((line) => <li className="rounded-[24px] bg-paper p-6 text-[17px] leading-[1.5]" key={line}>{line}</li>)}</ul>
        <p className="mt-6 text-[15px] text-ink/60">In development, not live yet: {COMING.join(", ")}.</p>
      </Section>

      <FaqSection items={FAQ} title="Short answers." />
      <CtaBand claimId="what-cta" line="Free to start, with all four Modes." secondary={{ href: "/compare", label: "Compare Setuvara" }} title="See it for yourself." />
    </>
  );
}
