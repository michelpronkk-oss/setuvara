import { CtaBand, FaqSection, PageHero, RelatedLinks, Section } from "@/components/marketing/site/kit";
import { QrGenerator } from "@/components/marketing/tools/qr-generator";
import { JsonLd } from "@/components/seo/json-ld";
import { marketingMetadata, SETUVARA_ORGANIZATION_ID, SETUVARA_ORIGIN } from "@/lib/marketing/metadata";

const PATH = "/tools/qr-code-generator";

export const metadata = marketingMetadata({
  title: "Free QR code generator: PNG and SVG, no sign-up | Setuvara",
  description: "Make a QR code for any link in seconds. Four styles, your colour, PNG or SVG download. No watermark, no sign-up, and it never expires.",
  path: PATH,
});

const STEPS = [
  { name: "Paste your link", text: "Any web address works: a profile, a menu, a form, a file. Bare domains get https:// added." },
  { name: "Pick a style and colour", text: "Standard, Accent frame, Rounded or Inverse. The code stays black on white so it scans everywhere." },
  { name: "Check it on a card or poster", text: "Preview the code on a business card or a poster before you print." },
  { name: "Download PNG or SVG", text: "A 2048 px PNG for screens and print shops, or a vector SVG that stays sharp at any size." },
];

const FAQ = [
  { q: "Is this QR code generator really free?", a: "Yes. No sign-up, no watermark and no limit on how many codes you make. The code is generated in your browser and the link never leaves the page." },
  { q: "Do these QR codes expire?", a: "No. The link is written into the code itself, so it works as long as the link does. There is no redirect in between that can be switched off." },
  { q: "PNG or SVG: which should I download?", a: "PNG for screens, slides and most print shops. SVG for designers and large prints: it is a vector, so it stays sharp at any size." },
  { q: "Can I change where the code points later?", a: "Not with a static code: it always opens the link it was made with. A Setuvara code opens your page, and you choose which Mode it shows, so the same printed code can show your work page at a conference and your personal page with friends." },
  { q: "Why does the code stay black and white?", a: "Scanners read dark modules on a light field most reliably. The styles change the frame and the colour around the code, never the code, so every style scans." },
  { q: "How big should I print a QR code?", a: "At least 2 × 2 cm (about 0.8 in) for something scanned up close, like a business card. For posters, a good rule is one tenth of the scanning distance: 30 cm wide to scan from 3 metres." },
];

export default function QrCodeGeneratorPage() {
  return (
    <>
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "WebApplication",
        name: "Setuvara QR code generator",
        url: `${SETUVARA_ORIGIN}${PATH}`,
        applicationCategory: "UtilitiesApplication",
        operatingSystem: "Any",
        browserRequirements: "Requires JavaScript",
        isAccessibleForFree: true,
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        publisher: { "@id": SETUVARA_ORGANIZATION_ID },
        featureList: ["PNG and SVG download", "Four frame styles", "Custom colour", "No watermark", "No sign-up", "Never expires"],
      }} />
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "HowTo",
        name: "How to make a QR code for a link",
        totalTime: "PT1M",
        step: STEPS.map((step, index) => ({ "@type": "HowToStep", position: index + 1, name: step.name, text: step.text })),
      }} />
      <PageHero crumbs={[{ name: "Tools", path: "/tools" }, { name: "QR code generator", path: PATH }]} eyebrow="Free tool" lede="Paste a link, pick a style, download. No watermark, no sign-up, and it never expires." title={<>QR code<br />generator.</>} />

      <section aria-label="Make your QR code" className="scroll-mt-16" id="generator">
        <div className="mx-auto w-full max-w-[1440px] px-5 pb-16 sm:px-8 sm:pb-24 lg:px-14">
          <QrGenerator />
        </div>
      </section>

      <Section eyebrow="How it works" id="how" title="Four steps, one minute." tone="white">
        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, index) => (
            <li className="rounded-[24px] bg-paper p-6" key={step.name}>
              <span className="font-label text-[11px] tracking-[0.16em] text-coral">0{index + 1}</span>
              <h3 className="mt-4 font-display text-[22px] font-bold leading-tight tracking-[-0.04em]">{step.name}</h3>
              <p className="mt-2 text-[15px] leading-[1.55] text-ink/65">{step.text}</p>
            </li>
          ))}
        </ol>
      </Section>

      <FaqSection items={FAQ} title="QR codes, answered." />

      <RelatedLinks items={[
        { href: "/features/qr-and-tap", label: "QR and Tap on Setuvara", line: "One code for every version of you, plus NFC cards and Quick QR." },
        { href: "/use-cases/qr-business-card", label: "QR business card", line: "Put a code on your card that opens a page you can keep editing." },
        { href: "/business", label: "Business Mode", line: "A digital business card with booking, leads and testimonials." },
      ]} />

      <CtaBand claimId="qr-tool-cta" line="Free. One code, four Modes, and you choose what it opens." secondary={{ href: "/features/qr-and-tap", label: "How Setuvara QR works" }} title="Make a code that knows who you are." />
    </>
  );
}
