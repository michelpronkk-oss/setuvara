import { FinalCta, Physical } from "@/components/marketing/home/closing";
import { Events, Teams } from "@/components/marketing/home/events-teams";
import { Hero } from "@/components/marketing/home/hero";
import { Memory } from "@/components/marketing/home/memory";
import { Modes } from "@/components/marketing/home/modes";
import { Passport } from "@/components/marketing/home/passport";
import { Principle } from "@/components/marketing/home/principle";
import { MeetConnect, Share } from "@/components/marketing/home/share-connect";
import { Looks } from "@/components/marketing/pricing/looks";
import { JsonLd } from "@/components/seo/json-ld";
import { marketingMetadata, SETUVARA_ORGANIZATION_ID, SETUVARA_ORIGIN, SETUVARA_WEBSITE_ID } from "@/lib/marketing/metadata";

export const metadata = marketingMetadata({
  title: "Setuvara | Your identity for real life",
  description: "One identity. Every version of you. Share the right you by link, QR or Setuvara Tap, and remember everyone you meet.",
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
    publisher: { "@id": SETUVARA_ORGANIZATION_ID },
  },
];

export default function HomePage() {
  return (
    <>
      <JsonLd data={homeStructuredData} />
      <Hero />
      <Principle />
      <Modes />
      <Looks />
      <Share />
      <MeetConnect />
      <Memory />
      <Passport />
      <Events />
      <Teams />
      <Physical />
      <FinalCta />
    </>
  );
}
