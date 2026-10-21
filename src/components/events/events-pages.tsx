import Link from "next/link";
import { notFound } from "next/navigation";

import { Head } from "@/components/actions/actions-pages";
import { coralButton, EmptyState, inkButton, lineButton, Mono, StudioPage } from "@/components/creator/studio-ui";
import { checkInWindow, eventPath, eventPhase, eventWhen, PHASE_LABEL, registrationWindow, type EventPhase, type EventRecord } from "@/lib/events/model";
import { eventsEnabled } from "@/lib/events/server";
import { loadOrganizer, loadOrganizerEvent } from "@/lib/events/studio-server";
import { CopyLink } from "./copy-link";
import { DoorScanner } from "./door-scanner";
import { GuestList } from "./guest-list";
import { ClientEventEditor } from "./client-event-editor";

const eyebrow = <><span aria-hidden="true" className="size-2 rounded-full bg-[#C7FF4A] shadow-[inset_0_0_0_1px_rgba(13,13,13,.25)]" />Event Mode</>;
const PHASE_TONE: Record<EventPhase, string> = { draft: "bg-black/[0.06] text-black/60", upcoming: "bg-[#C7FF4A] text-[#0D0D0D]", live: "bg-[#FF5A4F] text-[#0D0D0D]", ended: "bg-black/[0.06] text-black/55", cancelled: "bg-black/[0.06] text-black/45 line-through" };
/** Server render time; pages are dynamic, so this is the request's clock. */
const clock = () => Date.now();
const offNote = <p className="mb-6 rounded-[18px] bg-[#FFF3D6] px-4 py-3 text-[14px] leading-[1.5]">Event pages are not switched on for this site yet. You can create and edit events; guests can RSVP once they are.</p>;

function PhasePill({ phase }: { phase: EventPhase }) {
  return <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 font-label text-[10px] uppercase tracking-[0.12em] ${PHASE_TONE[phase]}`}>{phase === "live" && <span aria-hidden="true" className="size-1.5 animate-pulse rounded-full bg-[#0D0D0D]" />}{PHASE_LABEL[phase]}</span>;
}

function DateTile({ event }: { event: EventRecord }) {
  const date = new Date(event.starts_at);
  const month = new Intl.DateTimeFormat("en-GB", { timeZone: event.timezone, month: "short" }).format(date);
  const day = new Intl.DateTimeFormat("en-GB", { timeZone: event.timezone, day: "numeric" }).format(date);
  return (
    <span aria-hidden="true" className="grid size-[60px] shrink-0 grid-rows-[20px_1fr] overflow-hidden rounded-[18px] bg-white text-center shadow-[inset_0_0_0_1px_rgba(13,13,13,.1)]">
      <span className="bg-[#0D0D0D] font-label text-[10px] uppercase leading-[20px] tracking-[0.14em] text-[#C7FF4A]">{month}</span>
      <span className="grid place-items-center font-display text-[24px] font-bold leading-none tracking-[-0.04em]">{day}</span>
    </span>
  );
}

function EventRow({ event, now }: { event: EventRecord; now: number }) {
  const when = eventWhen(event);
  const phase = eventPhase(event, now);
  const seats = event.capacity ? `${event.confirmed_count} / ${event.capacity} going` : `${event.confirmed_count} going`;
  return (
    <li>
      <Link className="flex items-center gap-4 rounded-[24px] bg-white p-3.5 pr-4 shadow-[inset_0_0_0_1px_rgba(13,13,13,.08)] transition hover:shadow-[inset_0_0_0_1.5px_rgba(13,13,13,.3)] md:p-4" data-event-row={phase} href={`/app/identity/events/${event.id}`}>
        <DateTile event={event} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-[20px] font-bold leading-tight tracking-[-0.035em]">{event.title}</p>
          <p className="mt-0.5 truncate text-[13.5px] text-black/55">{when.time}{event.city ? ` · ${event.city}` : event.online_url ? " · Online" : ""}</p>
        </div>
        <div className="hidden shrink-0 flex-col items-end gap-1.5 sm:flex">
          <PhasePill phase={phase} />
          {phase !== "draft" && <p className="text-[13px] font-semibold text-black/60">{seats}{event.waitlist_count ? ` · ${event.waitlist_count} waiting` : ""}</p>}
        </div>
        <span aria-hidden="true" className="text-xl text-black/30">›</span>
      </Link>
    </li>
  );
}

/** Event Mode's events: what's coming, drafts, and the history, newest first. */
export async function EventsIndex() {
  const data = await loadOrganizer("/app/identity/events");
  if (!data.mode) notFound();
  if (!data.ready) return <StudioPage><Head eyebrow={eyebrow} title="Events" /><EmptyState body="Events need a database update that hasn't reached this site yet." title="Not ready yet." /></StudioPage>;
  const now = clock();
  const upcoming = data.events.filter((event) => event.status === "published" && new Date(event.ends_at).getTime() > now).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const drafts = data.events.filter((event) => event.status === "draft");
  const past = data.events.filter((event) => !upcoming.includes(event) && !drafts.includes(event));
  const going = upcoming.reduce((sum, event) => sum + event.confirmed_count, 0);
  const groups = [["Coming up", upcoming], ["Drafts", drafts], ["Past", past]] as const;
  return (
    <StudioPage>
      <Head action={<Link className={coralButton} href="/app/identity/events/new">New event</Link>} eyebrow={eyebrow} sub={upcoming.length ? `${upcoming.length} coming up · ${going} going` : "Each event gets its own page, RSVPs and guest list."} title="Events" />
      {!eventsEnabled() && offNote}
      {data.events.length === 0 ? (
        <EmptyState action={<Link className={coralButton} href="/app/identity/events/new">Create your first event</Link>} body="A dinner, a launch, a meetup. Give it a name, a time and a place; Setuvara gives it a page in your Event Mode's look, with RSVPs, a guest list and a waitlist." title="Host something." />
      ) : (
        <div className="flex flex-col gap-9">
          {groups.filter(([, list]) => list.length).map(([title, list]) => (
            <section aria-label={title} key={title}>
              <Mono className="mb-3 text-black/50">{title} · {list.length}</Mono>
              <ul className="flex flex-col gap-2.5">{list.map((event) => <EventRow event={event} key={event.id} now={now} />)}</ul>
            </section>
          ))}
        </div>
      )}
    </StudioPage>
  );
}

export async function NewEvent() {
  const data = await loadOrganizer("/app/identity/events/new");
  if (!data.mode) notFound();
  return (
    <StudioPage className="max-w-[860px]">
      <Head back={{ href: "/app/identity/events", label: "Events" }} eyebrow={eyebrow} title="New event" />
      <ClientEventEditor event={null} modeId={data.mode.id} modeLive={data.modeLive} profileId={data.userId} />
    </StudioPage>
  );
}

/** One event for its organizer: the numbers, the link, the guest list, and the details to edit. */
export async function EventDetail({ id }: { id: string }) {
  const data = await loadOrganizerEvent(id);
  if (!data.mode || !data.event) notFound();
  const { event, guests } = data;
  const now = clock();
  const phase = eventPhase(event, now);
  const rsvp = registrationWindow(event, now);
  const when = eventWhen(event);
  const url = `${data.origin}${eventPath(event)}`;
  const checkIn = checkInWindow(event, now);
  const checkedIn = guests.filter((guest) => guest.status === "confirmed" && guest.checked_in_at).length;
  const connected = guests.filter((guest) => guest.status === "confirmed" && guest.connection_id).length;
  const cards = [
    { label: "Going", value: `${event.confirmed_count}`, note: event.capacity ? `of ${event.capacity} spots` : "no limit" },
    { label: "Spots left", value: event.capacity ? `${Math.max(0, event.capacity - event.confirmed_count)}` : "∞", note: event.capacity && event.confirmed_count >= event.capacity ? (event.waitlist_enabled ? "full · waitlist on" : "full") : "open" },
    { label: "Waitlist", value: `${event.waitlist_count}`, note: event.waitlist_enabled ? "in join order" : "off" },
    { label: "Checked in", value: `${checkedIn}`, note: checkIn === "soon" ? "opens 12h before" : connected ? `${connected} connected` : `of ${event.confirmed_count} going` },
  ];
  return (
    <StudioPage className="max-w-[1120px]">
      <Head
        action={phase !== "draft" && phase !== "cancelled" ? (
          <div className="flex flex-wrap gap-2">
            {checkIn === "open" && <Link className={inkButton} data-open-scanner href={`/app/identity/events/${event.id}/scan`}><ScanIcon />Scan passes</Link>}
            <CopyLink url={url} />
            <a className={lineButton} href={eventPath(event)} rel="noreferrer" target="_blank">View page ↗</a>
          </div>
        ) : undefined}
        back={{ href: "/app/identity/events", label: "Events" }}
        eyebrow={<>{eyebrow}<span aria-hidden="true" className="text-black/25">/</span><PhasePill phase={phase} /></>}
        sub={<>{when.date} {when.year} · {when.time}{phase === "upcoming" || phase === "live" ? ` · RSVPs ${rsvp === "open" ? "open" : rsvp === "soon" ? "open later" : "closed"}` : ""}</>}
        title={event.title}
      />
      {!eventsEnabled() && offNote}
      {event.status !== "draft" && (
        <div className="mb-8 grid grid-cols-2 gap-2.5 md:grid-cols-4">
          {cards.map((card) => (
            <div className="rounded-[22px] bg-white p-4 shadow-[inset_0_0_0_1px_rgba(13,13,13,.08)] md:p-5" key={card.label}>
              <Mono className="text-black/50">{card.label}</Mono>
              <p className="mt-2 font-display text-[34px] font-bold leading-none tracking-[-0.05em]">{card.value}</p>
              <p className="mt-1.5 text-[13px] text-black/55">{card.note}</p>
            </div>
          ))}
        </div>
      )}
      <div className="grid gap-10 lg:grid-cols-[1.15fr_1fr] lg:items-start">
        {event.status !== "draft" && (
          <div className="min-w-0">
            <h2 className="mb-4 font-display text-[28px] font-bold tracking-[-0.045em]">Guests</h2>
            <GuestList canCheckIn={checkIn === "open"} canEdit={phase === "upcoming" || phase === "live"} eventId={event.id} guests={guests} />
          </div>
        )}
        <div className={`min-w-0 ${event.status === "draft" ? "lg:col-span-2 lg:max-w-[860px]" : ""}`}>
          {event.status !== "draft" && <h2 className="mb-4 font-display text-[28px] font-bold tracking-[-0.045em]">Details</h2>}
          <ClientEventEditor ended={phase === "ended"} event={event} modeId={data.mode.id} modeLive={data.modeLive} profileId={data.userId} />
        </div>
      </div>
    </StudioPage>
  );
}

function ScanIcon() {
  return <svg aria-hidden="true" fill="none" height="18" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" viewBox="0 0 20 20" width="18"><path d="M3 7V4.5A1.5 1.5 0 0 1 4.5 3H7M13 3h2.5A1.5 1.5 0 0 1 17 4.5V7M17 13v2.5a1.5 1.5 0 0 1-1.5 1.5H13M7 17H4.5A1.5 1.5 0 0 1 3 15.5V13M6 10h8" /></svg>;
}

/** The organizer's door for one event: the camera scanner while check-in is open, otherwise when it opens. */
export async function DoorScan({ id }: { id: string }) {
  const data = await loadOrganizerEvent(id);
  if (!data.mode || !data.event) notFound();
  const { event, guests } = data;
  const door = event.status === "cancelled" ? "cancelled" : checkInWindow(event, clock());
  const when = eventWhen(event);
  const checkedIn = guests.filter((guest) => guest.status === "confirmed" && guest.checked_in_at).length;
  const back = { href: `/app/identity/events/${event.id}`, label: "Guest list" };
  const closed = { soon: "Check-in opens 12 hours before the start. Come back then, or check guests in from the list on the day.", closed: "Check-in has closed for this event.", cancelled: "This event was cancelled." } as const;
  return (
    <StudioPage className="max-w-[560px]">
      <Head back={back} eyebrow={<>{eyebrow}<span aria-hidden="true" className="text-black/25">/</span>Door</>} sub={<>{when.date} · {when.time}</>} title={event.title} />
      {door === "open"
        ? <DoorScanner checkedIn={checkedIn} eventId={event.id} going={event.confirmed_count} />
        : <EmptyState action={<Link className={lineButton} href={back.href}>Guest list</Link>} body={closed[door]} title="The door isn't open." />}
      {door === "open" && <p className="mt-4 px-1 text-[13.5px] leading-[1.5] text-black/55">Guests find their door pass on their event page, linked in their RSVP email. No pass? Check them in from the guest list.</p>}
    </StudioPage>
  );
}
