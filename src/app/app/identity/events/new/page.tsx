import type { Metadata } from "next";

import { ActionsFrame } from "@/components/actions/actions-frame";
import { NewEvent } from "@/components/events/events-pages";

export const metadata: Metadata = { title: "New event · Setuvara" };

export default function NewEventPage() {
  return <ActionsFrame page="events" slug="event"><NewEvent /></ActionsFrame>;
}
