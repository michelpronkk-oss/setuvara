import { ModesPage } from "@/components/marketing/modes/modes-page";
import { marketingMetadata } from "@/lib/marketing/metadata";

export const metadata = marketingMetadata({
  title: "Setuvara Modes",
  description: "Personal, Event and Business: one identity, three ways to meet. Each Mode has its own links, look, link and QR.",
  path: "/modes",
});

export default function ModesRoute() {
  return <ModesPage />;
}
