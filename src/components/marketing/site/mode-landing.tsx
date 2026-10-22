import Link from "next/link";

import { nameFontClasses } from "@/components/profile/name-fonts";
import { JsonLd } from "@/components/seo/json-ld";
import { MODE_ORDER, MODE_PAGES, type ModeSlugPage } from "@/lib/marketing/modes-content";
import { SETUVARA_ORIGIN, SETUVARA_ORGANIZATION_ID } from "@/lib/marketing/metadata";
import { ONE_LINER } from "@/lib/marketing/facts";

import { CAST, CastPhone, ModeDesktop } from "../home/mode-phone";
import { PhoneStage } from "../home/phone-stage";
import { Display, Label, Shell } from "../home/primitives";
import { BrowserFrame, CtaBand, FaqSection, FeatureGrid, PageHero, RelatedLinks, Section } from "./kit";

/** The Mode on both screens: the desktop page in a window, the phone in front of it. */
export function ModeScreens({ slug }: { slug: ModeSlugPage }) {
  const { who } = CAST[slug];
  return (
    <div className={`${nameFontClasses} relative`}>
      <div className="hidden lg:block lg:pl-[72px] xl:hidden">
        <BrowserFrame url={MODE_PAGES[slug].share}><ModeDesktop scale={0.44} slug={slug} /></BrowserFrame>
      </div>
      <div className="hidden xl:block xl:pl-[88px]">
        <BrowserFrame url={MODE_PAGES[slug].share}><ModeDesktop scale={0.5} slug={slug} /></BrowserFrame>
      </div>
      <div className="flex justify-center lg:hidden">
        <PhoneStage slug={slug}><CastPhone slug={slug} /></PhoneStage>
      </div>
      {/* In front of the window's photo side, never over the name. */}
      <div className="absolute -bottom-14 left-0 hidden origin-bottom-left scale-[0.58] lg:block xl:scale-[0.66]"><CastPhone slug={slug} /></div>
      <span className="sr-only">{`${who.name}'s ${MODE_PAGES[slug].name} Mode page, on a desktop and a phone.`}</span>
    </div>
  );
}

export function ModeLanding({ slug }: { slug: ModeSlugPage }) {
  const page = MODE_PAGES[slug];
  const others = MODE_ORDER.filter((item) => item !== slug);
  const url = `${SETUVARA_ORIGIN}${page.path}`;
  return (
    <>
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "WebPage",
        "@id": `${url}#webpage`,
        url,
        name: page.metaTitle,
        description: page.metaDescription,
        isPartOf: { "@id": `${SETUVARA_ORIGIN}/#website` },
        about: { "@type": "SoftwareApplication", name: "Setuvara", applicationCategory: "SocialNetworkingApplication", operatingSystem: "Web", description: ONE_LINER, publisher: { "@id": SETUVARA_ORGANIZATION_ID } },
      }} />
      <PageHero
        claimId={`${slug}-hero-claim`}
        crumbs={[{ name: `${page.name} Mode`, path: page.path }]}
        eyebrow={page.eyebrow}
        lede={page.lede}
        title={page.title}
        visual={<ModeScreens slug={slug} />}
      />

      <section aria-labelledby={`${slug}-shows-title`} className="border-y border-ink/10 bg-white">
        <Shell className="py-16 sm:py-20 lg:py-24">
          <Label className="text-coral">What visitors see</Label>
          <Display className="mt-4 max-w-[20ch] text-[clamp(34px,4.4vw,64px)] leading-[0.95]"><span id={`${slug}-shows-title`}>One page, made for this part of your life.</span></Display>
          <ol className="mt-12 grid gap-10 md:grid-cols-3 md:gap-8">
            {page.shows.map((item, index) => (
              <li className="border-t-2 border-ink pt-5" key={item.title}>
                <span className="font-label text-[11px] tracking-[0.14em] text-coral">0{index + 1}</span>
                <h3 className="mt-3 font-display text-[26px] font-bold leading-[1.05] tracking-[-0.04em]">{item.title}</h3>
                <p className="mt-3 text-[16px] leading-[1.55] text-ink/65">{item.body}</p>
              </li>
            ))}
          </ol>
        </Shell>
      </section>

      <Section eyebrow={`Tools in ${page.name} Mode`} id={`${slug}-tools`} lede="Each Mode has its own tools in the app, beside its page. These are the ones built for this Mode." title="What you work with.">
        <FeatureGrid columns={page.tools.length > 4 ? 3 : 2} items={page.tools} />
      </Section>

      <Section eyebrow="Who it's for" id={`${slug}-who`} title="Made for people who meet people." tone="ink">
        <FeatureGrid columns={3} items={page.forWho.map((item) => ({ ...item }))} tone="ink" />
      </Section>

      <section aria-labelledby={`${slug}-others-title`} className="bg-white">
        <Shell className="py-16 sm:py-20">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <Display className="text-[clamp(30px,3.6vw,52px)] leading-[0.95]"><span id={`${slug}-others-title`}>One account, four Modes.</span></Display>
            <Link className="text-[15px] font-semibold underline decoration-ink/25 underline-offset-4 hover:decoration-ink focus-visible:outline-2 focus-visible:outline-coral" href="/modes">How Modes work →</Link>
          </div>
          <p className="mt-4 max-w-[40rem] text-[17px] leading-[1.55] text-ink/65">Every Setuvara has all four. Each has its own page, link, look and QR, and visitors only see the one you share.</p>
          <ul className="mt-10 grid gap-3 sm:grid-cols-3">
            {others.map((other) => {
              const target = MODE_PAGES[other];
              const { who } = CAST[other];
              return (
                <li key={other}>
                  <Link className="group flex h-full items-center gap-4 rounded-[22px] p-5 shadow-[inset_0_0_0_1px_rgba(13,13,13,.1)] transition-shadow hover:shadow-[inset_0_0_0_1.5px_rgba(13,13,13,.35)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral" href={target.path}>
                    <span aria-hidden="true" className="size-14 shrink-0 rounded-full bg-cover" style={{ backgroundImage: `url(${who.photo})`, backgroundPosition: `${who.face.x}% ${who.face.y}%` }} />
                    <span className="min-w-0">
                      <span className="block font-display text-[22px] font-bold tracking-[-0.035em]">{target.name}<span aria-hidden="true" className="ml-1.5 text-coral transition-transform group-hover:translate-x-0.5">→</span></span>
                      <span className="mt-0.5 block text-[14px] leading-[1.45] text-ink/60">{target.title}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Shell>
      </section>

      <FaqSection items={page.faq} title={`${page.name} Mode, answered.`} />

      <RelatedLinks items={[
        { href: "/features/actions", label: "Actions", line: "Forms, newsletters and bookings on your page." },
        { href: "/features/qr-and-tap", label: "QR and Tap", line: "Share by QR code, Quick QR or NFC." },
        { href: "/features/analytics", label: "Analytics", line: "Views, scans and connections." },
        { href: "/pricing", label: "Pricing", line: "Free to start. Plus and Pro when you want more." },
      ]} />

      <CtaBand claimId={`${slug}-cta-claim`} line="Claim your name, fill in this Mode and share it today. Free, with the other three Modes included." secondary={{ href: "/pricing", label: "See Plus and Pro" }} title={`Make your ${page.name} page.`} />
    </>
  );
}
