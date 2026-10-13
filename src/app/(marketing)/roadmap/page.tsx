import { RoadmapPage } from "@/components/marketing/roadmap/roadmap-page";
import { marketingMetadata } from "@/lib/marketing/metadata";

export const metadata = marketingMetadata({
  title: "Roadmap | Setuvara",
  description: "See what is live, what is next, and what Setuvara is exploring as we make it easier to meet, share and stay connected.",
  path: "/roadmap",
});

export default function RoadmapRoute() {
  return <RoadmapPage />;
}
