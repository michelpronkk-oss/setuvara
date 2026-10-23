import { CtaBand, FaqSection, PageHero } from "@/components/marketing/site/kit";
import { RelatedLinks } from "@/components/marketing/site/link-cards";
import { LinkChecker } from "@/components/marketing/tools/link-checker";
import { JsonLd } from "@/components/seo/json-ld";
import { marketingMetadata, SETUVARA_ORGANIZATION_ID, SETUVARA_ORIGIN } from "@/lib/marketing/metadata";

const PATH = "/tools/link-in-bio-checker";

export const metadata = marketingMetadata({
  title: "Free link in bio checker: test your bio link | Setuvara",
  description: "Paste your link in bio and get ten checks in seconds: speed, HTTPS, preview image, title, mobile, links. Works with Linktree, Beacons, Carrd or any page.",
  path: PATH,
});

const FAQ = [
  { q: "What does the link in bio checker test?", a: "Ten things that decide whether people tap: it opens, it’s on HTTPS, the first response is fast, it has a title, a description, a preview image, a mobile viewport and an icon, a focused number of links, and light HTML." },
  { q: "Does it work with Linktree, Beacons or Carrd?", a: "Yes. It reads any public web page, whatever tool made it." },
  { q: "Why does a preview image matter?", a: "When your link is shared in a message or on social apps, the preview image is what people see. Without one, the link shows as plain text and gets fewer taps." },
  { q: "Do you store the pages I check?", a: "No. The page is read once to run the checks and only the results come back to you." },
];

export default function LinkInBioCheckerPage() {
  return (
    <>
      <JsonLd data={{ "@context": "https://schema.org", "@type": "WebApplication", name: "Setuvara link in bio checker", url: `${SETUVARA_ORIGIN}${PATH}`, applicationCategory: "UtilitiesApplication", operatingSystem: "Any", isAccessibleForFree: true, offers: { "@type": "Offer", price: "0", priceCurrency: "USD" }, publisher: { "@id": SETUVARA_ORGANIZATION_ID } }} />
      <PageHero crumbs={[{ name: "Tools", path: "/tools" }, { name: "Link in bio checker", path: PATH }]} eyebrow="Free tool" lede="Paste your link in bio. Ten checks in a few seconds, and what to fix first." title={<>Link in bio<br />checker.</>} />
      <section aria-label="Check your link" className="scroll-mt-16" id="checker">
        <div className="mx-auto w-full max-w-[1440px] px-5 pb-16 sm:px-8 sm:pb-24 lg:px-14"><LinkChecker /></div>
      </section>
      <FaqSection items={FAQ} title="The checker, answered." />
      <RelatedLinks items={[
        { href: "/use-cases/link-in-bio-for-creators", label: "Link in bio for creators", line: "Work first, with a store and a media kit." },
        { href: "/compare/linktree", label: "Setuvara vs Linktree", line: "The classic link in bio, compared." },
        { href: "/tools/qr-code-generator", label: "Free QR code generator", line: "A code for any link." },
      ]} />
      <CtaBand claimId="link-check-cta" line="Free to start. Every check, built in." secondary={{ href: "/templates", label: "Browse templates" }} title="A link in bio that passes." />
    </>
  );
}
