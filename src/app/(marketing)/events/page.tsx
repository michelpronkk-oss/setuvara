import { EventsPage } from "@/components/marketing/events/events-page";
import { marketingMetadata } from "@/lib/marketing/metadata";

export const metadata = marketingMetadata({
  title: "Setuvara for Events",
  description: "Event Mode carries the event, your role and who you are here to meet. Set it before, share it in the room, and remember everyone after.",
  path: "/events",
});

export default function EventsRoute() {
  return <EventsPage />;
}
