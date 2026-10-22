import { FinalCta } from "@/components/marketing/home/closing";
import { Examples } from "@/components/marketing/home/examples";
import { Hero } from "@/components/marketing/home/hero";
import { Loop } from "@/components/marketing/home/loop";
import { Memory } from "@/components/marketing/home/memory";
import { Modes } from "@/components/marketing/home/modes";
import { Plans } from "@/components/marketing/home/plans";
import { MeetConnect, Share } from "@/components/marketing/home/share-connect";
import { Looks } from "@/components/marketing/pricing/looks-preview";
import { CATEGORY_LINE, ONE_LINER } from "@/lib/marketing/facts";
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

export default function HomePage() {
  return (
    <>
      <JsonLd data={homeStructuredData} />
      {/* In order: the loop, the four Modes, example pages, then Plus and Pro. */}
      <Hero />
      <Loop />
      <Share />
      <MeetConnect />
      <Memory />
      <Modes />
      <Examples />
      <Looks />
      <Plans />
      <FinalCta />
    </>
  );
}
