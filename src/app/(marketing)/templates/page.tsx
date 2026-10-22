import { TemplatesIndex } from "@/components/marketing/site/template-views";
import { marketingMetadata } from "@/lib/marketing/metadata";

export const metadata = marketingMetadata({
  title: "Templates: 10 Looks and 4 Modes for your page | Setuvara",
  description: "Setuvara templates: ten Looks, from Immersive and Clean (free) to Glow, Film and Stack, each with a phone and desktop view, for Personal, Event, Business and Creator Modes.",
  path: "/templates",
});

export default function TemplatesPage() {
  return <TemplatesIndex />;
}
