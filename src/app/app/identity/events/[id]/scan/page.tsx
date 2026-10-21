import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ActionsFrame } from "@/components/actions/actions-frame";
import { DoorScan } from "@/components/events/events-pages";
import { loadOrganizerEvent } from "@/lib/events/studio-server";

export const metadata: Metadata = { title: "Scan passes · Setuvara", robots: { index: false, follow: false } };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EventScanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id) || !(await loadOrganizerEvent(id)).event) notFound();
  return <ActionsFrame page="events" slug="event"><DoorScan id={id} /></ActionsFrame>;
}
