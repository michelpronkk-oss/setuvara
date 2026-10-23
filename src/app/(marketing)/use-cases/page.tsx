import { ModeScreens } from "@/components/marketing/site/mode-landing";
import { CtaBand, PageHero, Section } from "@/components/marketing/site/kit";
import { LinkCards } from "@/components/marketing/site/link-cards";
import { marketingMetadata } from "@/lib/marketing/metadata";
import { USE_CASE_ORDER, USE_CASES } from "@/lib/marketing/use-cases-content";

export const metadata = marketingMetadata({
  title: "Use cases: business cards, link in bio, events, revenue | Setuvara",
  description: "How people use Setuvara: a digital business card for founders, a link in bio for creators, event networking, a QR business card and sharing your revenue publicly.",
  path: "/use-cases",
});

export default function UseCasesIndex() {
  return (
    <>
      <PageHero ledeShort="One account, four Modes, many uses." claimId="use-cases-claim" crumbs={[{ name: "Use cases", path: "/use-cases" }]} eyebrow="Use cases" lede="One account, four Modes. Here is what people do with them." title="What people use Setuvara for." visual={<ModeScreens slug="business" />} />
      <Section id="use-cases" title="Pick yours." tone="white">
        <LinkCards items={USE_CASE_ORDER.map((slug) => ({ title: USE_CASES[slug].name, line: USE_CASES[slug].ledeShort ?? USE_CASES[slug].lede, href: `/use-cases/${slug}` }))} />
      </Section>
      <CtaBand claimId="use-cases-cta" line="Free to start, with all four Modes." secondary={{ href: "/compare", label: "Compare Setuvara" }} title="Start with your name." />
    </>
  );
}
