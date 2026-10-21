import type { Metadata } from "next";

import { ActionsFrame } from "@/components/actions/actions-frame";
import { EventsIndex } from "@/components/events/events-pages";

export const metadata: Metadata = { title: "Events · Setuvara" };

export default function EventsPage() {
  return <ActionsFrame page="events" slug="event"><EventsIndex /></ActionsFrame>;
}
