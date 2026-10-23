import { CtaBand, FeatureGrid, PageHero, Section } from "@/components/marketing/site/kit";
import { FeatureVisual } from "@/components/marketing/site/visuals";
import { marketingMetadata } from "@/lib/marketing/metadata";
import { TOOLS } from "@/lib/marketing/tools";

export const metadata = marketingMetadata({
  title: "Free tools: QR code generator and more | Setuvara",
  description: "Free tools from Setuvara: a QR code generator with PNG and SVG download, a link-in-bio checker and a media kit template. No sign-up.",
  path: "/tools",
});

export default function ToolsIndex() {
  return (
    <>
      <PageHero ledeShort="Free, no sign-up." crumbs={[{ name: "Tools", path: "/tools" }]} eyebrow="Free tools" lede="Small, useful things for meeting people and sharing your work. Free, with no sign-up." below={<FeatureVisual name="qr-and-tap" />} title="Free tools." />
      <Section id="tools" title="Use them as often as you like." tone="white">
        <FeatureGrid items={TOOLS.map((tool) => ({ title: tool.name, body: tool.line, href: tool.path }))} />
      </Section>
      <CtaBand claimId="tools-cta" line="One page with four Modes, shared by link, QR or tap." secondary={{ href: "/what-is-setuvara", label: "What is Setuvara?" }} title="And when you want the real thing." />
    </>
  );
}
