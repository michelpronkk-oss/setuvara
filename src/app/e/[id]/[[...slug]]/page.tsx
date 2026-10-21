import type { Metadata, Viewport } from "next";
import { notFound, redirect } from "next/navigation";

import { marketingFontClasses } from "@/app/(marketing)/fonts";
import { EventPageView, EventPanel } from "@/components/events/event-page-view";
import { RsvpForm } from "@/components/events/rsvp-form";
import { nameFontClasses } from "@/components/profile/name-fonts";
import { availability, eventPath, spotsLeftNote } from "@/lib/events/model";
import { loadPublicEvent } from "@/lib/events/server";
import { createClient } from "@/lib/supabase/server";

type Props = { params: Promise<{ id: string; slug?: string[] }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const page = await loadPublicEvent(id);
  if (!page) notFound();
  return {
    title: `${page.event.title} · ${page.organizer}`,
    description: page.event.summary.slice(0, 160) || undefined,
    alternates: { canonical: `https://setuvara.com${eventPath(page.event)}` },
    // Event pages are shared by link. Search indexing is a separate, later choice for organizers.
    robots: { index: false, follow: false },
  };
}

export async function generateViewport({ params }: Props): Promise<Viewport> {
  const { id } = await params;
  const page = await loadPublicEvent(id);
  return { themeColor: page?.theme.bg ?? "#F5F4EF", viewportFit: "cover" };
}

/** An event's own page: /e/<short id>/<name>. Any name (or none) opens it; the current one is canonical. */
export default async function EventPage({ params }: Props) {
  const { id, slug } = await params;
  const page = await loadPublicEvent(id);
  if (!page) notFound();
  const { event, theme, organizer, photoUrl, backHref } = page;
  if ((slug?.join("/") ?? "") !== event.slug) redirect(eventPath(event));

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = typeof claims?.claims?.sub === "string" ? claims.claims.sub : null;
  const own = userId === event.profile_id;
  const { data: viewer } = userId && !own ? await supabase.from("profiles").select("display_name").eq("id", userId).maybeSingle() : { data: null };
  const firstName = organizer.split(/\s+/)[0] || organizer;
  const seats = availability(event);

  let below;
  if (event.phase === "cancelled") below = <EventPanel body={`${firstName} cancelled this event.`} title="This event was cancelled." />;
  else if (event.phase === "ended") below = <EventPanel body="Thanks to everyone who came." title="This event has ended." />;
  else if (own) below = <EventPanel action={<a className="mt-4 inline-flex min-h-11 items-center rounded-full px-[18px] text-[15px] font-semibold" href={`/app/identity/events/${event.id}`} style={{ background: "var(--av-btn-bg)", color: "var(--av-btn-fg)", boxShadow: "var(--av-btn-ring)" }}>Open guest list</a>} body={`${event.confirmed_count} going${event.capacity ? ` of ${event.capacity}` : ""}.`} title="This is your event." />;
  else if (event.registration === "soon") below = <EventPanel body={event.registration_opens_at ? `RSVPs open ${new Intl.DateTimeFormat("en-GB", { timeZone: event.timezone, weekday: "short", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(new Date(event.registration_opens_at))}.` : undefined} title="RSVPs aren't open yet." />;
  else if (event.registration === "closed") below = <EventPanel body={event.phase === "live" ? "It's happening now." : undefined} title="RSVPs have closed." />;
  else if (seats === "full") below = <EventPanel body="Every spot is taken." title="This event is full." />;
  else below = <RsvpForm eventId={event.id} organizerFirstName={firstName} signedInName={viewer?.display_name ?? ""} spotsNote={spotsLeftNote(event)} waitlist={seats === "waitlist"} />;

  return (
    <main className={`${marketingFontClasses} ${nameFontClasses} min-h-dvh`} style={{ background: theme.bg }}>
      <EventPageView backHref={backHref} calendarHref={`/e/${event.short_id}/calendar.ics`} event={event} organizer={organizer} photoUrl={photoUrl} theme={theme}>
        {below}
      </EventPageView>
    </main>
  );
}
