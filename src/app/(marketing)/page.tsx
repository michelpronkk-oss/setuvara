import { FinalCta, Physical } from "@/components/marketing/home/closing";
import { Events, Teams } from "@/components/marketing/home/events-teams";
import { Hero } from "@/components/marketing/home/hero";
import { Memory } from "@/components/marketing/home/memory";
import { Modes } from "@/components/marketing/home/modes";
import { Passport } from "@/components/marketing/home/passport";
import { Principle } from "@/components/marketing/home/principle";
import { MeetConnect, Share } from "@/components/marketing/home/share-connect";
import { marketingMetadata } from "@/lib/marketing/metadata";

export const metadata = marketingMetadata({
  title: "Setuvara | One identity. Every version of you.",
  description: "Setuvara is a digital identity for real life. Share Personal, Event, and Business Modes in person, connect in a tap, and remember where you met.",
  path: "/",
});

export default function HomePage() {
  return (
    <>
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
