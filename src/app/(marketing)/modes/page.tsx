import { ModesPage } from "@/components/marketing/modes/modes-page";
import { marketingMetadata } from "@/lib/marketing/metadata";

export const metadata = marketingMetadata({
  title: "Modes: Personal, Event and Business | Setuvara",
  description: "One identity, three Modes. Personal, Event and Business each have their own links, look and QR, and people only see the one you share.",
  path: "/modes",
});

export default function ModesRoute() {
  return <ModesPage />;
}
