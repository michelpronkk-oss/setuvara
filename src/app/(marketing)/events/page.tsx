import { MarketingRoutePage } from "@/components/marketing/primitives";
import { marketingMetadata } from "@/lib/marketing/metadata";

export const metadata = marketingMetadata({
  title: "Setuvara for Events",
  description: "Bring the right personal context to the people you meet at an event.",
  path: "/events",
});

export default function EventsPage() {
  return <MarketingRoutePage eyebrow="For events" title="Bring the right context into the room." description="Setuvara is built around one identity that can meet different moments. Event Mode gives you a focused way to share who you are and what you’re there for." />;
}
