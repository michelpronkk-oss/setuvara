import type { Metadata } from "next";

import { marketingFontClasses } from "@/app/(marketing)/fonts";
import { EventPageView } from "@/components/events/event-page-view";
import { GuestRegistration } from "@/components/events/guest-registration";
import { nameFontClasses } from "@/components/profile/name-fonts";
import { eventPath } from "@/lib/events/model";
import { createEventsServiceClient, eventsEnabled, loadPublicEvent } from "@/lib/events/server";
import { readGuestToken } from "@/lib/events/token";

export const metadata: Metadata = { title: "Your registration · Setuvara", robots: { index: false, follow: false }, referrer: "no-referrer" };
export const dynamic = "force-dynamic";

type Registration = { id: string; short_id: string; name: string; email: string; status: "confirmed" | "waitlisted" | "cancelled" };

async function load(token: string) {
  const guest = eventsEnabled() ? readGuestToken(token) : null;
  if (!guest) return null;
  try {
    const { data } = await createEventsServiceClient().rpc("get_event_registration", { p_registration_id: guest.id, p_token_version: guest.version });
    const registration = data as Registration | null;
    if (!registration) return null;
    const page = await loadPublicEvent(registration.short_id);
    return page ? { registration, page } : null;
  } catch {
    return null;
  }
}

/** A guest's private page, opened from their email. Only the signed link opens it; nothing here is listed. */
export default async function GuestRegistrationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const found = await load(decodeURIComponent(token));
  if (!found) {
    return (
      <main className={`${marketingFontClasses} grid min-h-dvh place-items-center bg-[#F5F4EF] px-5 font-brand text-[#0D0D0D]`}>
        <div className="w-full max-w-[440px]">
          <h1 className="font-display text-[36px] font-bold leading-none tracking-[-0.05em]">This link doesn&apos;t work.</h1>
          <p className="mt-3 text-[16px] text-black/65">Open the newest email about this event, or RSVP again from the event page.</p>
        </div>
      </main>
    );
  }
  const { registration, page } = found;
  const { event, theme } = page;
  return (
    <main className={`${marketingFontClasses} ${nameFontClasses} min-h-dvh`} style={{ background: theme.bg }}>
      <EventPageView backHref={eventPath(event)} calendarHref={registration.status === "confirmed" ? `/e/${event.short_id}/calendar.ics` : undefined} event={event} organizer={page.organizer} photoUrl={page.photoUrl} theme={theme}>
        <GuestRegistration canCancel={event.phase === "upcoming" || event.phase === "live"} email={registration.email} name={registration.name} status={registration.status} token={decodeURIComponent(token)} />
      </EventPageView>
    </main>
  );
}
