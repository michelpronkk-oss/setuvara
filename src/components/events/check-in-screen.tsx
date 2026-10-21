import Link from "next/link";
import { notFound } from "next/navigation";

import { Head } from "@/components/actions/actions-pages";
import { EmptyState, lineButton, StudioPage } from "@/components/creator/studio-ui";
import { checkInWindow, EVENT_COLUMNS, eventWhen, GUEST_COLUMNS, type EventRecord, type Guest } from "@/lib/events/model";
import { loadOrganizer } from "@/lib/events/studio-server";
import { readPassToken } from "@/lib/events/token";
import { CheckInCard } from "./check-in-card";

const eyebrow = <><span aria-hidden="true" className="size-2 rounded-full bg-[#C7FF4A] shadow-[inset_0_0_0_1px_rgba(13,13,13,.25)]" />Check in</>;
const back = { href: "/app/identity/events", label: "Events" };

/**
 * One guest's pass, for the organizer. The signature proves it's a real pass; the guest is read under
 * RLS, so a pass for someone else's event shows nothing about that guest.
 */
export async function CheckInScreen({ token }: { token: string }) {
  const pass = readPassToken(token);
  const data = await loadOrganizer(`/app/identity/events/check-in/${token}`);
  if (!data.mode) notFound();
  const { data: guest } = pass ? await data.supabase.from("event_registrations").select(GUEST_COLUMNS).eq("id", pass.id).maybeSingle() : { data: null };
  const { data: event } = guest ? await data.supabase.from("events").select(EVENT_COLUMNS).eq("id", guest.event_id).maybeSingle() : { data: null };
  if (!guest || !event) {
    return (
      <StudioPage className="max-w-[640px]">
        <Head back={back} eyebrow={eyebrow} title="Not your guest." />
        <EmptyState action={<Link className={lineButton} href="/app/identity/events">Your events</Link>} body="This pass isn't for one of your events, or it was changed. Ask the guest to open the newest email about the event." title="Nothing to check in." />
      </StudioPage>
    );
  }
  const record = event as EventRecord;
  const when = eventWhen(record);
  return (
    <StudioPage className="max-w-[640px]">
      <Head back={{ href: `/app/identity/events/${record.id}`, label: "Guest list" }} eyebrow={eyebrow} sub={<>{when.date} {when.year} · {when.time}</>} title={record.title} />
      <CheckInCard eventId={record.id} guest={guest as Guest} window={record.status === "cancelled" ? "cancelled" : checkInWindow(record)} />
    </StudioPage>
  );
}
