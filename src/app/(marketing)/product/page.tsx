import { CtaBand, FaqSection, FeatureGrid, PageHero, Section } from "@/components/marketing/site/kit";
import { ProfilePlayground } from "@/components/marketing/tools/profile-playground";
import { JsonLd } from "@/components/seo/json-ld";
import { LOOKS } from "@/lib/marketing/facts";
import { marketingMetadata, SETUVARA_ORGANIZATION_ID, SETUVARA_ORIGIN } from "@/lib/marketing/metadata";

const PATH = "/product";

export const metadata = marketingMetadata({
  title: "Try Setuvara: design a profile page live, no sign-up | Setuvara",
  description: `Change the Look, name style, accent, scroll cue and profile soundtrack on a live Setuvara page. All ${LOOKS.total} Looks to try, no account and nothing to pay.`,
  path: PATH,
});

const PARTS = [
  { title: "Content", body: "Your name, a line for each Mode, links, pictures, video, music and Actions. Each Mode keeps its own.", tag: "Every plan" },
  { title: "Looks", body: `${LOOKS.total} complete designs, from Immersive to Film. ${LOOKS.free.join(" and ")} are free; Plus unlocks the rest.`, tag: "2 free · 10 on Plus" },
  { title: "Name style", body: "Six display styles for your name, from Setuvara to Impact. Two are free.", tag: "2 free · 6 on Plus" },
  { title: "Accent", body: "Five presets or any colour. Contrast is handled for you, on every Look.", tag: "Every plan" },
  { title: "Scroll cue", body: "The small sign at the foot of your page that there is more below. Each Look has its own; Plus picks any of ten.", tag: "Plus for the ten" },
  { title: "Profile soundtrack", body: "A song or playlist from Spotify, Apple Music, SoundCloud or YouTube that visitors can play on your page. It never starts on its own.", tag: "Every plan" },
];

const FAQ = [
  { q: "Do I need an account to try this?", a: "No. The playground runs in your browser and nothing is saved or sent. When you like a look, claim your name and set it up for real." },
  { q: "Which choices are free?", a: `All four Modes, the ${LOOKS.free.join(" and ")} Looks, two name styles, any accent colour, the Look’s own scroll cue, and a profile soundtrack in the Ambient or Minimal style. Choices marked Plus need the Plus or Pro plan.` },
  { q: "What is a profile soundtrack?", a: "A song or playlist you pick, played from your page when a visitor turns sound on. It shows as a small sound button, a minimal strip or a featured player, and it never autoplays." },
  { q: "Can each Mode look different?", a: "Yes. Every Mode has its own Look, accent, name style, cue and soundtrack, so your Event page can look nothing like your Personal one." },
];

export default function ProductPage() {
  return (
    <>
      <JsonLd data={{ "@context": "https://schema.org", "@type": "WebApplication", name: "Setuvara profile playground", url: `${SETUVARA_ORIGIN}${PATH}`, applicationCategory: "DesignApplication", operatingSystem: "Any", isAccessibleForFree: true, offers: { "@type": "Offer", price: "0", priceCurrency: "USD" }, publisher: { "@id": SETUVARA_ORGANIZATION_ID } }} />
      <PageHero crumbs={[{ name: "Try it", path: PATH }]} eyebrow="Profile playground" lede="Change the Look, name style, accent, scroll cue and soundtrack, and watch a real Setuvara page change with you. No account, nothing to pay." title={<>Make it yours.<br />Live.</>} />
      <section aria-label="Profile playground" className="scroll-mt-16" id="playground">
        <div className="mx-auto w-full max-w-[1440px] px-5 pb-20 sm:px-8 sm:pb-28 lg:px-14"><ProfilePlayground /></div>
      </section>
      <Section eyebrow="What you can change" id="parts" title="Every part of your page." tone="white">
        <FeatureGrid items={PARTS} />
      </Section>
      <FaqSection items={FAQ} title="The playground, answered." />
      <CtaBand claimId="product-cta" line="Free to start, with all four Modes." secondary={{ href: "/pricing", label: "See what Plus adds" }} title="Keep this look." />
    </>
  );
}
