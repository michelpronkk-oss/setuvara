import { CtaBand, FaqSection, PageHero } from "@/components/marketing/site/kit";
import { RelatedLinks } from "@/components/marketing/site/link-cards";
import { MediaKitMaker } from "@/components/marketing/tools/media-kit-maker";
import { JsonLd } from "@/components/seo/json-ld";
import { marketingMetadata, SETUVARA_ORGANIZATION_ID, SETUVARA_ORIGIN } from "@/lib/marketing/metadata";

const PATH = "/tools/media-kit-template";

export const metadata = marketingMetadata({
  title: "Free media kit template for creators (PDF) | Setuvara",
  description: "Fill in a one-page creator media kit: platforms, audience, engagement, brands and rates. Save it as a PDF. Free, no sign-up, nothing uploaded.",
  path: PATH,
});

const FAQ = [
  { q: "What should a creator media kit include?", a: "Who you are and what you make, your platforms with follower counts, engagement, who your audience is, brands you’ve worked with, your rates and how to reach you. One page is enough." },
  { q: "Should I put my rates in my media kit?", a: "Starting rates help brands budget and filter out poor fits. Use “from” prices and keep room to quote per project." },
  { q: "How do I save it as a PDF?", a: "Press Save as PDF and choose “Save as PDF” as the printer. The PDF is one A4 page with only your kit on it." },
  { q: "Is there a media kit that stays up to date?", a: "Yes: Setuvara’s Creator Mode has a media kit page you share by link, on every plan, next to your store and brand Deals." },
];

export default function MediaKitTemplatePage() {
  return (
    <>
      <JsonLd data={{ "@context": "https://schema.org", "@type": "WebApplication", name: "Setuvara media kit template", url: `${SETUVARA_ORIGIN}${PATH}`, applicationCategory: "DesignApplication", operatingSystem: "Any", isAccessibleForFree: true, offers: { "@type": "Offer", price: "0", priceCurrency: "USD" }, publisher: { "@id": SETUVARA_ORGANIZATION_ID } }} />
      <PageHero crumbs={[{ name: "Tools", path: "/tools" }, { name: "Media kit template", path: PATH }]} eyebrow="Free tool" lede="A one-page media kit brands can read in ten seconds. Fill it in, save it as a PDF." title={<>Media kit<br />template.</>} />
      <section aria-label="Make your media kit" className="scroll-mt-16" id="maker">
        <div className="mx-auto w-full max-w-[1440px] px-5 pb-16 sm:px-8 sm:pb-24 lg:px-14"><MediaKitMaker /></div>
      </section>
      <FaqSection items={FAQ} title="Media kits, answered." />
      <RelatedLinks items={[
        { href: "/creator", label: "Creator Mode", line: "A live media kit, a store and brand Deals." },
        { href: "/use-cases/link-in-bio-for-creators", label: "Link in bio for creators", line: "Work first." },
        { href: "/tools/link-in-bio-checker", label: "Link in bio checker", line: "Ten checks on your bio link." },
      ]} />
      <CtaBand claimId="media-kit-cta" line="Creator Mode is on every plan, with no application." secondary={{ href: "/creator", label: "See Creator Mode" }} title="A media kit that lives at your link." />
    </>
  );
}
