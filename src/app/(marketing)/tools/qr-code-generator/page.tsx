import { CtaBand, FaqSection, PageHero, Section, Stage } from "@/components/marketing/site/kit";
import { RelatedLinks } from "@/components/marketing/site/link-cards";
import { QrGenerator } from "@/components/marketing/tools/qr-generator";
import { JsonLd } from "@/components/seo/json-ld";
import { marketingMetadata, SETUVARA_ORGANIZATION_ID, SETUVARA_ORIGIN } from "@/lib/marketing/metadata";
import { MODE_ORDER, MODE_PAGES } from "@/lib/marketing/modes-content";

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

/** Where the same printed Setuvara code can point, Mode by Mode. */
const MODE_MOMENTS: Record<string, string> = {
  personal: "With friends and new people",
  event: "At the conference, for one weekend",
  business: "At work, with clients",
  creator: "With brands and your audience",
};

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
          <QrGenerator stage={<Stage className="!rounded-none" slug="business" />} />
        </div>
      </section>

      <Section eyebrow="Static vs Setuvara" id="modes" lede="A plain code opens one link forever. A Setuvara code opens your page, and you pick which Mode it shows, so the same card works everywhere you go." title="A code that can change its mind." tone="ink">
        <ul className="border-t border-paper/15">
          {MODE_ORDER.map((slug, index) => (
            <li className="grid grid-cols-[40px_minmax(0,1fr)] items-baseline gap-x-4 border-b border-paper/15 py-6 sm:grid-cols-[64px_minmax(0,1fr)_minmax(0,1fr)]" key={slug}>
              <span className="font-label text-[11px] tracking-[0.16em] text-coral">0{index + 1}</span>
              <span className="font-display text-[clamp(32px,4vw,56px)] font-extrabold leading-none tracking-[-0.055em]">{MODE_PAGES[slug].name}</span>
              <span className="col-start-2 mt-2 text-[17px] text-paper/65 sm:col-start-3 sm:mt-0 sm:text-right">{MODE_MOMENTS[slug]}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section eyebrow="How it works" id="how" title="Four steps, one minute." tone="white">
        <ol className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, index) => (
            <li className="border-t-[1.5px] border-ink pt-6" key={step.name}>
              <span className="font-label text-[11px] tracking-[0.16em] text-coral">0{index + 1}</span>
              <h3 className="mt-3 font-display text-[28px] font-extrabold leading-[1] tracking-[-0.05em]">{step.name}</h3>
              <p className="mt-3 text-[16px] leading-[1.6] text-ink/62">{step.text}</p>
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
