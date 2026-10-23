import Link from "next/link";
import type { ReactNode } from "react";

import { nameFontClasses } from "@/components/profile/name-fonts";
import { JsonLd } from "@/components/seo/json-ld";
import { ONE_LINER } from "@/lib/marketing/facts";
import { MODE_ORDER, MODE_PAGES, type ModeSlugPage } from "@/lib/marketing/modes-content";
import { SETUVARA_ORIGIN, SETUVARA_ORGANIZATION_ID } from "@/lib/marketing/metadata";

import { CAST, CastPhone, DEMO_PEOPLE, ModeDesktop } from "../home/mode-phone";
import { Display, Label, Shell } from "../home/primitives";
import { BrowserFrame, CtaBand, FaqSection, ModeSwitch, PageHero, SectionHead, Stage } from "./kit";
import { AudienceRows, Avatar, BookingCard, ConnectionRows, DealStages, EventCard, LeadsList, LivePill, MediaKitCard, NewsletterCard, Quote, RevenueCard, RoadmapRows, Stamps, StoreList, SubRows, ToolPanel } from "./panels";

type Person = (typeof DEMO_PEOPLE)[keyof typeof DEMO_PEOPLE];

/** The moment that floats over each Mode's hero: what just happened because someone opened the page. */
const HERO_MOMENT: Record<ModeSlugPage, { who: Person; label: string; title: string; line: string; pill: string }> = {
  personal: { who: DEMO_PEOPLE.theo, label: "New connection", title: "Theo Laurent connected", line: "Café Lisboa · 21:40 · saved for you both", pill: "Only Personal · never your work page" },
  event: { who: DEMO_PEOPLE.noor, label: "Met at Slush", title: "Noor Haddad connected", line: "Slush 2026 · Helsinki · 11:05", pill: "Live · ends by itself" },
  business: { who: DEMO_PEOPLE.noor, label: "New lead", title: "Noor Haddad booked a call", line: "Thu 14 · 10:30 · from your QR", pill: "Saved to Leads · no app needed" },
  creator: { who: DEMO_PEOPLE.aanya, label: "New order", title: "Live session pack · $12", line: "Aanya Rao · paid with Stripe", pill: "0% Setuvara fee on Plus" },
};

/** Three example people for "who it's for", photographed wide. */
const WHO_PHOTOS: Record<ModeSlugPage, string[]> = {
  personal: ["/pricing/aanya-wide.webp", "/pricing/theo-wide.webp", "/pricing/noor-wide.webp"],
  event: ["/pricing/theo-wide.webp", "/pricing/noor-wide.webp", "/pricing/lucas-wide.webp"],
  business: ["/pricing/lucas-wide.webp", "/pricing/theo-wide.webp", "/pricing/noor-wide.webp"],
  creator: ["/pricing/sena-wide.webp", "/pricing/aanya-wide.webp", "/pricing/theo-wide.webp"],
};

/** Each Mode's tools as four working panels: wide ink, white, coral, wide white. */
function ToolPanels({ slug }: { slug: ModeSlugPage }): ReactNode[] {
  switch (slug) {
    case "personal": return [
      <ToolPanel body="Everyone who connects is saved with where and when you met, and a note only you can see." key="a" tag="Every plan" title="Connections" tone="ink">
        <ConnectionRows rows={[{ who: DEMO_PEOPLE.theo, name: "Theo Laurent", where: "Café Lisboa · after the run", when: "Today" }, { who: DEMO_PEOPLE.noor, name: "Noor Haddad", where: "Friday dinner · Alfama", when: "Fri" }, { who: DEMO_PEOPLE.sena, name: "Sena Okafor", where: "Concert · LX Factory", when: "12 Oct" }]} />
      </ToolPanel>,
      <ToolPanel body="A newsletter, a form or a question as a card on your page." key="b" tag="Free · 2 live" title="Actions"><NewsletterCard /></ToolPanel>,
      <ToolPanel body="Stamps for the places and people that mattered, kept in your Passport." key="c" tag="Every plan" title="Passport" tone="coral"><div className="mt-auto"><Stamps items={[{ title: "Lisbon", line: "First 10" }, { title: "Run club", line: "Sundays" }, { title: "50", line: "Connections" }]} /></div></ToolPanel>,
      <ToolPanel aside={<AudienceRows count="212" subject="Sunday’s route is up." />} body="Everyone who joined through your Actions, in one list you own." key="d" tag="Free · Email on Plus" title="Audience"><SubRows rows={[["Collect subscribers", "Every plan"], ["Email your list", "Plus · Pro"]]} /></ToolPanel>,
    ];
    case "event": return [
      <ToolPanel body="Host your own: an event page with RSVPs, a waitlist, a guest list and a door scanner." key="a" tag="Every plan · 50 upcoming" title="Events" tone="ink"><EventCard /></ToolPanel>,
      <ToolPanel body="Go Live while you’re there. It shows on your page and ends by itself." key="b" tag="Every plan" title="Live"><LivePill /></ToolPanel>,
      <ToolPanel body="Every event you go to leaves a stamp." key="c" tag="Every plan" title="Passport" tone="coral"><div className="mt-auto"><Stamps items={[{ title: "Slush", line: "2026" }, { title: "Web Summit", line: "Lisbon" }, { title: "Helsinki", line: "First visit" }]} /></div></ToolPanel>,
      <ToolPanel aside={<ConnectionRows dark={false} rows={[{ who: DEMO_PEOPLE.noor, name: "Noor Haddad", where: "Slush · Stage B · 11:05", when: "Today" }, { who: DEMO_PEOPLE.lucasClose, name: "Lucas Meyer", where: "Slush · Founders lunch", when: "Today" }]} />} body="Everyone you meet keeps the event, the city and the time. Search Connections by event later." key="d" tag="Every plan" title="Connections"><SubRows rows={[["Questions and sign-ups", "Actions · Free"], ["Your attendees list", "Audience · Free"]]} /></ToolPanel>,
    ];
    case "creator": return [
      <ToolPanel body="Sell downloads, guides and calls from your page, paid through your own Stripe account." key="a" tag="5% fee on Free · 0% on Plus" title="Store" tone="ink"><StoreList /></ToolPanel>,
      <ToolPanel body="Your platforms and audience on one page brands can read in ten seconds." key="b" tag="Every plan" title="Media kit"><MediaKitCard /></ToolPanel>,
      <ToolPanel body="Collaboration requests become Deals you move from new to paid." key="c" tag="Every plan" title="Deals" tone="coral"><DealStages /></ToolPanel>,
      <ToolPanel aside={<AudienceRows />} body="Fans who follow or sign up land in one list. Write to them from Setuvara." key="d" tag="Free · Email on Plus" title="Audience"><SubRows rows={[["Builder for your projects", "Free"], ["Insights", "Every plan"]]} /></ToolPanel>,
    ];
    default: return [
      <ToolPanel body="Every inquiry from your page lands as a lead with stages and a conversion funnel." key="a" tag="Free · Notes and CSV on Plus" title="Leads" tone="ink"><LeadsList /></ToolPanel>,
      <ToolPanel body="Projects, a public roadmap with voting and updates. Revenue verified on Plus." key="b" tag="Free · Verified on Plus" title="Builder"><div><RevenueCard compact /><RoadmapRows /></div></ToolPanel>,
      <ToolPanel key="c" tag="Free · 3 shown" title="Testimonials" tone="coral"><Quote role="Example client · you choose which quotes show" text="We booked the follow-up before we left the stand." who={DEMO_PEOPLE.sena} /></ToolPanel>,
      <ToolPanel aside={<BookingCard />} body="Forms, booking requests and a newsletter as cards on your page, each with its own inbox." key="d" tag="Free" title="Actions"><SubRows rows={[["Audience", "Free · Email on Plus"], ["Team", "Pro · 5 seats"]]} /></ToolPanel>,
    ];
  }
}

/** The hero stage: the desktop page in a window, the phone in front, and the moment it caused. */
export function ModeScreens({ slug }: { slug: ModeSlugPage }) {
  const { who } = CAST[slug];
  const moment = HERO_MOMENT[slug];
  const toast = (
    <div className="flex items-center gap-3 rounded-[20px] bg-white p-3.5 pr-5 shadow-[0_30px_60px_-30px_rgba(13,13,13,.5)]">
      <Avatar size={40} who={moment.who} />
      <div className="min-w-0">
        <p className="flex justify-between gap-6 font-label text-[10px] font-medium uppercase tracking-[0.16em]"><span className="text-coral">{moment.label}</span><span className="text-ink/40">Now</span></p>
        <p className="mt-1 text-[15px] font-semibold leading-tight">{moment.title}</p>
        <p className="mt-0.5 truncate text-[13px] text-ink/55">{moment.line}</p>
      </div>
    </div>
  );
  return (
    <div className={nameFontClasses}>
      <Stage className="aspect-[4/5] sm:aspect-[5/4] lg:aspect-[744/700]" slug={slug}>
        {/* Wide screens: the desktop window top right; the drawing hangs off its left, behind the phone, so the name stays whole. */}
        <div className="absolute right-[4.5%] top-[10%] hidden w-[75%] sm:block">
          <BrowserFrame url={MODE_PAGES[slug].share}><div className="flex justify-end [&>*]:shrink-0"><ModeDesktop scales="[--z:.32] md:[--z:.4] lg:[--z:.3] xl:[--z:.4]" slug={slug} /></div></BrowserFrame>
        </div>
        <div className="absolute bottom-[-12%] left-1/2 origin-top -translate-x-1/2 scale-[.78] sm:bottom-[4.5%] sm:left-[7.5%] sm:translate-x-0 sm:origin-bottom-left sm:scale-[.62] lg:scale-[.55] xl:scale-[.7]">
          <div className="rounded-[46px] shadow-[0_50px_80px_-30px_rgba(13,13,13,.6)]"><CastPhone mediaPriority="high" slug={slug} /></div>
        </div>
        <div className="absolute inset-x-4 bottom-4 sm:inset-x-auto sm:bottom-[20%] sm:right-[5%] sm:w-[46%]">{toast}</div>
        <p className="absolute bottom-[8%] right-[5%] hidden items-center gap-2 rounded-full bg-ink px-4 py-2.5 text-[13px] font-medium text-paper sm:flex"><span aria-hidden="true" className="size-2 rounded-full bg-[#C7FF4A]" />{moment.pill}</p>
      </Stage>
      <span className="sr-only">{`${who.name}'s ${MODE_PAGES[slug].name} Mode page, on a desktop and a phone. Example page.`}</span>
    </div>
  );
}

export function ModeLanding({ slug }: { slug: ModeSlugPage }) {
  const page = MODE_PAGES[slug];
  const others = MODE_ORDER.filter((item) => item !== slug);
  const url = `${SETUVARA_ORIGIN}${page.path}`;
  const [a, b, c, d] = ToolPanels({ slug });
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
        below={<ModeSwitch current={slug} />}
        claimId={`${slug}-hero-claim`}
        crumbs={[{ name: `${page.name} Mode`, path: page.path }]}
        eyebrow={page.eyebrow}
        lede={page.lede}
        note="Free · All four Modes · No card"
        title={page.title}
        visual={<ModeScreens slug={slug} />}
      />

      <section aria-labelledby={`${slug}-shows-title`} className="bg-white">
        <Shell className="py-20 sm:py-24 lg:py-32">
          <SectionHead eyebrow="What visitors see" id={`${slug}-shows`} lede={`On a laptop your page is a full editorial spread, not a phone in the middle of the screen. They see ${page.name} only, never your other Modes.`} title="One page, made for this part of your life." />
          <div className={`${nameFontClasses} mx-auto mt-12 max-w-[1168px] lg:mt-[72px]`}>
            <BrowserFrame url={page.share}><ModeDesktop scales="[--z:.26] sm:[--z:.44] md:[--z:.52] lg:[--z:.7] xl:[--z:.9]" slug={slug} /></BrowserFrame>
          </div>
          <ol className="mt-14 grid gap-10 md:grid-cols-3 md:gap-8">
            {page.shows.map((item, index) => (
              <li className="border-t-[1.5px] border-ink pt-6" key={item.title}>
                <span className="font-label text-[11px] tracking-[0.16em] text-coral">0{index + 1}</span>
                <h3 className="mt-3 font-display text-[28px] font-extrabold leading-[1] tracking-[-0.05em]">{item.title}</h3>
                <p className="mt-3 text-[16px] leading-[1.6] text-ink/62">{item.body}</p>
              </li>
            ))}
          </ol>
        </Shell>
      </section>

      <section aria-labelledby={`${slug}-tools-title`} className="bg-paper">
        <Shell className="py-20 sm:py-24 lg:py-32">
          <SectionHead eyebrow={`Tools in ${page.name} Mode`} id={`${slug}-tools`} lede={`Each Mode has its own tools in the app, beside its page. These are the ones built for ${page.name}.`} title="What you work with." />
          <div className="mt-12 grid gap-6 lg:mt-[72px] lg:grid-cols-12">
            <div className="flex lg:col-span-7 [&>*]:flex-1">{a}</div>
            <div className="flex lg:col-span-5 [&>*]:flex-1">{b}</div>
            <div className="flex min-h-[360px] lg:col-span-5 [&>*]:flex-1">{c}</div>
            <div className="flex lg:col-span-7 [&>*]:flex-1">{d}</div>
          </div>
        </Shell>
      </section>

      <section aria-labelledby={`${slug}-who-title`} className="bg-ink text-paper">
        <Shell className="py-20 sm:py-24 lg:py-32">
          <SectionHead eyebrow="Who it’s for" id={`${slug}-who`} title="Made for people who meet people." tone="ink" />
          <ul className="mt-12 grid gap-6 md:grid-cols-3 lg:mt-[72px]">
            {page.forWho.map((item, index) => (
              <li className="relative isolate flex aspect-[4/5] flex-col justify-end overflow-hidden rounded-[24px] p-7" key={item.title}>
                <span aria-hidden="true" className="absolute inset-0 -z-10 bg-cover bg-center" style={{ backgroundImage: `url(${WHO_PHOTOS[slug][index % 3]})` }} />
                <span aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-t from-ink via-ink/55 to-transparent" />
                <h3 className="font-display text-[clamp(28px,2.6vw,36px)] font-extrabold leading-[0.95] tracking-[-0.05em]">{item.title}</h3>
                <p className="mt-3 text-[15px] leading-[1.55] text-paper/75">{item.body}</p>
              </li>
            ))}
          </ul>
        </Shell>
      </section>

      <FaqSection items={page.faq} title={`${page.name} Mode, answered.`} />

      <section aria-labelledby={`${slug}-others-title`} className="bg-paper">
        <Shell className="pb-20 sm:pb-24 lg:pb-32">
          <div className="flex flex-wrap items-end justify-between gap-4 border-t-[1.5px] border-ink pt-12">
            <Display className="text-[clamp(40px,4.4vw,64px)] leading-[0.92]"><span id={`${slug}-others-title`}>One account, four Modes.</span></Display>
            <Link className="inline-flex min-h-11 items-center text-[15px] font-semibold hover:text-coral focus-visible:outline-2 focus-visible:outline-coral" href="/modes">How Modes work →</Link>
          </div>
          <ul className={`${nameFontClasses} mt-10 grid gap-6 sm:grid-cols-3`}>
            {others.map((other) => {
              const target = MODE_PAGES[other];
              return (
                <li className="group relative" key={other}>
                  <Stage className="h-[300px]" slug={other}>
                    <div aria-hidden="true" className="absolute left-1/2 top-[11%] origin-top -translate-x-1/2 scale-[.74] transition-transform duration-500 group-hover:-translate-y-2" inert><CastPhone slug={other} /></div>
                  </Stage>
                  <p className="mt-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <Link className="font-display text-[28px] font-extrabold tracking-[-0.05em] after:absolute after:inset-0 after:rounded-[28px] focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-4 focus-visible:after:outline-coral" href={target.path}>{target.name} →</Link>
                    <span className="text-[14px] text-ink/55">{target.title}</span>
                  </p>
                </li>
              );
            })}
          </ul>
          <Label className="mt-8 text-ink/40">Example pages · the people shown are illustrations</Label>
        </Shell>
      </section>

      <CtaBand claimId={`${slug}-cta-claim`} secondary={{ href: "/pricing", label: "See pricing" }} title={page.title} />
    </>
  );
}
