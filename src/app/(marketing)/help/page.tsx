import Link from "next/link";

import { HelpCenter } from "@/components/marketing/site/help-center";
import { JsonLd } from "@/components/seo/json-ld";
import { CONTACT_EMAIL } from "@/lib/marketing/contact";
import { HELP_TOPICS, POPULAR } from "@/lib/marketing/help-content";
import { marketingMetadata } from "@/lib/marketing/metadata";

export const metadata = marketingMetadata({
  title: "Help centre: answers about Setuvara | Setuvara",
  description: "How Setuvara works: Modes, sharing by link, QR and tap, Connections, Actions, the Creator store, Builder, plans and billing, privacy and your account.",
  path: "/help",
});

export default function HelpPage() {
  return (
    <>
      <JsonLd data={{ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: HELP_TOPICS.flatMap((topic) => topic.items).map((item) => ({ "@type": "Question", name: item.q, acceptedAnswer: { "@type": "Answer", text: item.a } })) }} />
      <HelpCenter popular={POPULAR} topics={HELP_TOPICS} />

      <section aria-labelledby="still-title" className="bg-paper">
        <div className="mx-auto w-full max-w-[1440px] px-5 py-16 sm:px-8 sm:py-24 lg:px-14">
          <div className="relative isolate overflow-hidden rounded-[36px] bg-ink p-8 text-paper sm:p-12 lg:p-16">
            <span aria-hidden="true" className="absolute -right-24 -top-24 -z-10 size-[420px] rounded-full bg-coral/30 blur-[120px]" />
            <div className="grid gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-end">
              <div>
                <p className="font-label text-[11px] uppercase tracking-[0.16em] text-coral">Still stuck?</p>
                <h2 className="mt-4 font-display text-[clamp(38px,5vw,76px)] font-extrabold leading-[0.92] tracking-[-0.055em]" id="still-title">Ask a person.</h2>
                <p className="mt-5 max-w-[30rem] text-[17px] leading-[1.55] text-paper/65">A person reads every message. Write from the email on your account and say what you tried, so we can answer in one go.</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Link className="group flex flex-col justify-between gap-8 rounded-[26px] bg-coral p-6 text-ink transition-transform hover:-translate-y-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-paper" href="/contact">
                  <span className="font-label text-[10px] uppercase tracking-[0.14em] text-ink/60">Form</span>
                  <span className="font-display text-[26px] font-extrabold leading-none tracking-[-0.045em]">Contact support <span aria-hidden="true" className="inline-block transition-transform group-hover:translate-x-1">→</span></span>
                </Link>
                <a className="group flex flex-col justify-between gap-8 rounded-[26px] bg-white/[0.07] p-6 shadow-[inset_0_0_0_1px_rgba(245,244,239,.1)] transition-transform hover:-translate-y-1 focus-visible:outline-2 focus-visible:outline-coral" href={`mailto:${CONTACT_EMAIL}`}>
                  <span className="font-label text-[10px] uppercase tracking-[0.14em] text-paper/50">Email</span>
                  <span className="break-all font-display text-[22px] font-extrabold leading-tight tracking-[-0.04em]">{CONTACT_EMAIL}</span>
                </a>
                <Link className="flex items-center justify-between gap-4 rounded-[22px] bg-white/[0.05] px-6 py-5 text-[15px] font-semibold sm:col-span-2" href="/roadmap">What we’re building next<span aria-hidden="true" className="text-coral">→</span></Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
