import { TemplatesIndex } from "@/components/marketing/site/template-views";
import { marketingMetadata } from "@/lib/marketing/metadata";

export const metadata = marketingMetadata({
  title: "Templates: 10 Looks and 4 Modes for your page | Setuvara",
  description: "Ten Looks for your Setuvara page, from Immersive and Clean (free) to Glow, Film and Stack, each with phone and desktop views, for all four Modes.",
  path: "/templates",
});

export default function TemplatesPage() {
  return <TemplatesIndex />;
}
