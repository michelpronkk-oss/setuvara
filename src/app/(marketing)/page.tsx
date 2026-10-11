import { FinalCta, Physical } from "@/components/marketing/home/closing";
import { Events, Teams } from "@/components/marketing/home/events-teams";
import { Hero } from "@/components/marketing/home/hero";
import { Memory } from "@/components/marketing/home/memory";
import { Modes } from "@/components/marketing/home/modes";
import { Passport } from "@/components/marketing/home/passport";
import { Principle } from "@/components/marketing/home/principle";
import { MeetConnect, Share } from "@/components/marketing/home/share-connect";
import { JsonLd } from "@/components/seo/json-ld";
import { marketingMetadata, SETUVARA_ORIGIN } from "@/lib/marketing/metadata";

export const metadata = marketingMetadata({
  title: "Setuvara | Your identity for real life",
  description: "One identity. Every version of you. Share the right context when you meet, and keep the connection after.",
  path: "/",
});

const homeStructuredData = [
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Setuvara",
    url: `${SETUVARA_ORIGIN}/`,
    logo: `${SETUVARA_ORIGIN}/icons/setuvara-icon.png`,
  },
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Setuvara",
    url: `${SETUVARA_ORIGIN}/`,
    inLanguage: "en",
  },
];

export default function HomePage() {
  return (
    <>
      <JsonLd data={homeStructuredData} />
      <Hero />
      <Principle />
      <Modes />
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
