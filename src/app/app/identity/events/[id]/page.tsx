import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ActionsFrame } from "@/components/actions/actions-frame";
import { EventDetail } from "@/components/events/events-pages";
import { loadOrganizerEvent } from "@/lib/events/studio-server";

export const metadata: Metadata = { title: "Event · Setuvara" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Checked before the frame streams, so another member's event is a real 404.
  if (!UUID.test(id) || !(await loadOrganizerEvent(id)).event) notFound();
  return <ActionsFrame page="events" slug="event"><EventDetail id={id} /></ActionsFrame>;
}
