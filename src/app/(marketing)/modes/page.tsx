import { ModesPage } from "@/components/marketing/modes/modes-page";
import { marketingMetadata } from "@/lib/marketing/metadata";

export const metadata = marketingMetadata({
  title: "Modes: Personal, Event, Business and Creator | Setuvara",
  description: "One identity, four Modes. Personal, Event, Business and Creator each have their own links, look, QR and tools, and people only see the one you share.",
  path: "/modes",
});

export default function ModesRoute() {
  return <ModesPage />;
}
