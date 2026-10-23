import { CapabilityGrid } from "@/components/marketing/site/capability-visuals";
import { CtaBand, FaqSection, PageHero, Section } from "@/components/marketing/site/kit";
import { ModeScreens } from "@/components/marketing/site/mode-landing";
import { SoundtrackTry } from "@/components/marketing/site/soundtrack-try";
import { CueGrid, LooksGallery, NameStyles, SoundtrackPresentations, SoundtrackSources } from "@/components/marketing/site/product-tour";
import { LOOKS } from "@/lib/marketing/facts";
import { marketingMetadata } from "@/lib/marketing/metadata";

const PATH = "/product";

export const metadata = marketingMetadata({
  title: "The product: Looks, content and your soundtrack | Setuvara",
  description: `Everything you can change on a Setuvara page: content, ${LOOKS.total} Looks, accent, name style, scroll cue and a profile soundtrack. Free to start, with all four Modes.`,
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
  { q: "Can I try it for free?", a: "Yes. The Free plan has all four Modes, two Looks, any accent colour and a profile soundtrack, with no card and no time limit. Claim your name and set it up for real." },
  { q: "Which choices are free?", a: `All four Modes, the ${LOOKS.free.join(" and ")} Looks, two name styles, any accent colour, the Look’s own scroll cue, and a profile soundtrack in the Ambient or Minimal style. Choices marked Plus need the Plus or Pro plan.` },
  { q: "What is a profile soundtrack?", a: "A song or playlist you pick, played from your page when a visitor turns sound on. It shows as a small sound button, a minimal strip or a featured player, and it never autoplays." },
  { q: "Can each Mode look different?", a: "Yes. Every Mode has its own Look, accent, name style, cue and soundtrack, so your Event page can look nothing like your Personal one." },
];

export default function ProductPage() {
  return (
    <>
      <PageHero ledeShort="Change any of it, Mode by Mode." claimId="product-hero-claim" crumbs={[{ name: "Product", path: PATH }]} eyebrow="The product" lede="Content, Looks, accent, name style, scroll cue and a profile soundtrack. Change any of it, Mode by Mode, and your page follows." note="Free · All four Modes · No card" title={<>Make it yours.</>} visual={<ModeScreens slug="creator" />} />
      <Section eyebrow="Looks" id="looks" lede={`Ten complete designs, each with its own photo treatment, type, motion and scroll cue. ${LOOKS.free.join(" and ")} are free; Plus opens all ten.`} title="Ten Looks. One is you." tone="ink">
        <LooksGallery />
      </Section>
      <Section eyebrow="Name style" id="name-style" lede="Six display styles for your name, on top of any Look. Setuvara and Modern are free." title="Your name, your type." tone="white">
        <NameStyles />
      </Section>
      <Section eyebrow="Scroll cues" id="cues" lede="The small sign at the foot of your page that there is more below. Each Look has its own; Plus picks any of the ten, or none." title="A nudge, in your style." tone="ink">
        <CueGrid />
      </Section>
      <Section eyebrow="Profile soundtrack" id="soundtrack" lede="Pick a song or playlist for each Mode. Visitors hear it when they tap sound; it never starts on its own." title="Your page, with a sound." tone="paper">
        <SoundtrackPresentations />
        <SoundtrackSources />
        <SoundtrackTry />
      </Section>
      <Section eyebrow="At a glance" id="parts" title="Every part of your page." tone="white">
        <CapabilityGrid items={PARTS} />
      </Section>
      <FaqSection items={FAQ} title="Your page, answered." />
      <CtaBand claimId="product-cta" line="Free to start, with all four Modes." secondary={{ href: "/pricing", label: "See what Plus adds" }} title="Keep this look." />
    </>
  );
}
