import { EventsPage } from "@/components/marketing/events/events-page";
import { marketingMetadata } from "@/lib/marketing/metadata";

export const metadata = marketingMetadata({
  title: "Setuvara for Events",
  description: "Event Mode: set it before, share it in the room, remember everyone after.",
  path: "/events",
});

export default function EventsRoute() {
  return <EventsPage />;
}
