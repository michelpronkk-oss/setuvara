import { CtaBand, FeatureGrid, PageHero, Section } from "@/components/marketing/site/kit";
import { FEATURE_ORDER, FEATURE_PAGES } from "@/lib/marketing/features-content";
import { marketingMetadata } from "@/lib/marketing/metadata";
import { MODE_ORDER, MODE_PAGES } from "@/lib/marketing/modes-content";

export const metadata = marketingMetadata({
  title: "Features: Actions, Builder, Analytics, QR and Tap | Setuvara",
  description: "Everything in Setuvara: four Modes, Actions, Builder with verified revenue, Analytics, QR codes, NFC Tap and the Wallet pass.",
  path: "/features",
});

export default function FeaturesIndex() {
  return (
    <>
      <PageHero claimId="features-claim" crumbs={[{ name: "Features", path: "/features" }]} eyebrow="Features" lede="Four Modes, and the tools that do the next step: forms and sign-ups, projects with verified revenue, analytics, and every way to share in person." title="Everything in Setuvara." />
      <Section eyebrow="Tools" id="features-tools" title="What you work with.">
        <FeatureGrid items={FEATURE_ORDER.map((slug) => ({ title: FEATURE_PAGES[slug].name, body: FEATURE_PAGES[slug].lede, tag: FEATURE_PAGES[slug].status === "coming" ? "Coming soon" : undefined, href: `/features/${slug}` }))} />
      </Section>
      <Section eyebrow="Modes" id="features-modes" title="A page for each part of your life." tone="white">
        <FeatureGrid columns={4} items={MODE_ORDER.map((slug) => ({ title: `${MODE_PAGES[slug].name} Mode`, body: MODE_PAGES[slug].title, href: MODE_PAGES[slug].path }))} />
      </Section>
      <CtaBand claimId="features-cta" line="Free to start, with every Mode included." secondary={{ href: "/pricing", label: "Compare plans" }} title="Start with your name." />
    </>
  );
}
