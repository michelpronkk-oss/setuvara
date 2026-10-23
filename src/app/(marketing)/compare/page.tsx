import { CompareList } from "@/components/marketing/site/compare-landing";
import { ModeScreens } from "@/components/marketing/site/mode-landing";
import { CtaBand, PageHero, Section } from "@/components/marketing/site/kit";
import { marketingMetadata } from "@/lib/marketing/metadata";

export const metadata = marketingMetadata({
  title: "Compare Setuvara: vs Linktree, Beacons, Popl and Carrd | Setuvara",
  description: "How Setuvara compares with Linktree, Beacons, Popl and digital business cards, and Carrd. Honest side-by-side tables, including when the other one is the better pick.",
  path: "/compare",
});

export default function CompareIndex() {
  return (
    <>
      <PageHero claimId="compare-claim" crumbs={[{ name: "Compare", path: "/compare" }]} eyebrow="Compare" lede="Link in bio, digital business card, page builder: Setuvara overlaps with all three. Here is how it differs, and when the other one fits better." title="Setuvara, compared." visual={<ModeScreens slug="creator" />} />
      <Section id="comparisons" title="Side by side." tone="white"><CompareList /></Section>
      <CtaBand claimId="compare-cta" line="Free to start, with all four Modes." secondary={{ href: "/what-is-setuvara", label: "What is Setuvara?" }} title="See for yourself." />
    </>
  );
}
