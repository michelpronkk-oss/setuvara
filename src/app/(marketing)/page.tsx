import { FinalCta } from "@/components/marketing/home/closing";
import { Examples } from "@/components/marketing/home/examples";
import { HomeHero } from "@/components/marketing/home/home-hero";
import { FaqSection } from "@/components/marketing/site/kit";
import { Loop } from "@/components/marketing/home/loop";
import { Memory } from "@/components/marketing/home/memory";
import { Modes } from "@/components/marketing/home/modes";
import { Plans } from "@/components/marketing/home/plans";
import { MeetConnect, Share } from "@/components/marketing/home/share-connect";
import { Looks } from "@/components/marketing/pricing/looks-preview";
import { CATEGORY_LINE, LOOKS, ONE_LINER, PRICE_LINE } from "@/lib/marketing/facts";
import { JsonLd } from "@/components/seo/json-ld";
import { marketingMetadata, SETUVARA_ORGANIZATION_ID, SETUVARA_ORIGIN, SETUVARA_WEBSITE_ID } from "@/lib/marketing/metadata";

export const metadata = marketingMetadata({
  title: "Setuvara | Your identity for real life",
  description: "One identity, four Modes: Personal, Event, Business and Creator. Share the right you by link, QR or tap, and remember everyone you meet. Free to start.",
  path: "/",
});

const homeStructuredData = [
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": SETUVARA_ORGANIZATION_ID,
    name: "Setuvara",
    url: `${SETUVARA_ORIGIN}/`,
    logo: `${SETUVARA_ORIGIN}/icons/setuvara-icon.png`,
    slogan: "One identity. Every version of you.",
    description: ONE_LINER,
    email: "hello@setuvara.com",
    sameAs: ["https://instagram.com/setuvara.app"],
  },
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": SETUVARA_WEBSITE_ID,
    name: "Setuvara",
    url: `${SETUVARA_ORIGIN}/`,
    inLanguage: "en",
    description: CATEGORY_LINE,
    publisher: { "@id": SETUVARA_ORGANIZATION_ID },
  },
];

/** Short, factual answers: what people (and AI search) ask first. Only what ships today. */
const HOME_FAQ = [
  { q: "What is Setuvara?", a: ONE_LINER },
  { q: "What are Modes?", a: "Modes are the versions of you: Personal for friends, Event for conferences and meetups, Business for clients, and Creator for your audience. Each has its own page, link and QR code, and people only see the Mode you share with them." },
  { q: "Is Setuvara free?", a: `Yes. All four Modes, sharing by link, QR and Setuvara Tap, and Connections are free. ${PRICE_LINE}` },
  { q: "Do people need the app or an account to connect with me?", a: "No. They open your page, tap Connect and leave their name and email. If they join Setuvara later, the connection is already waiting for them." },
  { q: "How is it different from a link in bio?", a: "A link in bio is one list of links. Setuvara gives each part of your life its own full page, and it remembers everyone you meet: where, when and a private note." },
  { q: "Can I change how my page looks?", a: `Yes. There are ${LOOKS.total} Looks; ${LOOKS.free.join(" and ")} are free and Plus unlocks all ${LOOKS.total}. On a laptop your page opens as a full desktop spread, not a phone in the middle of the screen.` },
];

export default function HomePage() {
  return (
    <>
      <JsonLd data={homeStructuredData} />
      {/* Product first: the four Modes, then the loop (share, connect, remember), example pages, Looks and plans. */}
      <HomeHero />
      <Modes />
      <Loop />
      <Share />
      <MeetConnect />
      <Memory />
      <Examples />
      <Looks />
      <Plans />
      <FaqSection items={HOME_FAQ} title="Setuvara, answered." />
      <FinalCta />
    </>
  );
}
