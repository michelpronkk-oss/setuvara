import type { Metadata } from "next";

import { ActionsFrame } from "@/components/actions/actions-frame";
import { CheckInScreen } from "@/components/events/check-in-screen";
import { loadOrganizer } from "@/lib/events/studio-server";

export const metadata: Metadata = { title: "Check in · Setuvara", robots: { index: false, follow: false }, referrer: "no-referrer" };
export const dynamic = "force-dynamic";

/** Where a guest's door pass lands: the organizer's phone camera opens it, signed in as themselves. */
export default async function CheckInPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  // Signed out, the organizer signs in and comes straight back to this pass.
  await loadOrganizer(`/app/identity/events/check-in/${token}`);
  return <ActionsFrame page="events" slug="event"><CheckInScreen token={token} /></ActionsFrame>;
}
