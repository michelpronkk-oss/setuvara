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
  const seats = event.capacity ? `${event.confirmed_count} / ${event.capacity}` : `${event.confirmed_count}`;
  return (
    <li>
      <Link className="group flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-black/[0.02] focus-visible:outline-2 focus-visible:outline-offset-[-2px] md:px-5" data-event-row={phase} href={`/app/identity/events/${event.id}`}>
        <DateTile event={event} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[16px] font-semibold tracking-[-0.01em]">{event.title}</p>
          <p className="mt-0.5 truncate text-[13.5px] text-black/55">{when.date} · {when.time}{event.city ? ` · ${event.city}` : event.online_url ? " · Online" : ""}</p>
        </div>
        <PhasePill phase={phase} />
        <p className="hidden w-[92px] shrink-0 text-right text-[13.5px] tabular-nums text-black/60 sm:block">{phase === "draft" ? "—" : <><span className="font-semibold text-black">{seats}</span> going</>}</p>
        <span aria-hidden="true" className="text-xl text-black/30 transition-transform group-hover:translate-x-0.5">›</span>
      </Link>
    </li>
  );
}

/** The next published event, leading the page: when, where, how full, and the two things you do with it. */
function NextEvent({ event, now }: { event: EventRecord; now: number }) {
  const when = eventWhen(event);
  const phase = eventPhase(event, now);
  const days = Math.ceil((new Date(event.starts_at).getTime() - now) / 86_400_000);
  const lead = phase === "live" ? "Happening now" : days <= 0 ? "Today" : days === 1 ? "Tomorrow" : `In ${days} days`;
  const share = event.capacity ? Math.min(1, event.confirmed_count / event.capacity) : null;
  const where = event.venue_name && event.city ? `${event.venue_name}, ${event.city}` : event.city || event.venue_name || (event.online_url ? "Online" : "");
  return (
    <section aria-labelledby="sv-next-event" className="relative mb-10 overflow-hidden rounded-[28px] bg-[#0D0D0D] p-6 text-[#F5F4EF] md:p-8">
      <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-24 size-[340px] rounded-full bg-[#C7FF4A]/[0.07] blur-3xl" />
      <div className="relative flex flex-wrap items-start justify-between gap-6">
        <div className="min-w-0 max-w-[620px]">
          <Mono className="flex items-center gap-2 text-[#C7FF4A]">{phase === "live" && <span aria-hidden="true" className="size-1.5 animate-pulse rounded-full bg-[#C7FF4A]" />}Next up · {lead}</Mono>
          <h2 className="mt-3 text-balance font-display text-[34px] font-bold leading-[0.98] tracking-[-0.045em] md:text-[44px]" id="sv-next-event">{event.title}</h2>
          <p className="mt-3 text-[15px] text-[#F5F4EF]/70">{when.date} · {when.time}{where ? ` · ${where}` : ""}</p>
        </div>
        <div className="min-w-[200px]">
          <p className="font-display text-[44px] font-bold leading-none tracking-[-0.05em] tabular-nums">{event.confirmed_count}<span className="ml-2 text-[15px] font-semibold tracking-normal text-[#F5F4EF]/55">{event.capacity ? `of ${event.capacity} going` : "going"}</span></p>
          {share !== null && <div aria-hidden="true" className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-[#C7FF4A]" style={{ width: `${Math.max(2, share * 100)}%` }} /></div>}
          {event.waitlist_count > 0 && <p className="mt-2 text-[13px] text-[#F5F4EF]/60">{event.waitlist_count} on the waitlist</p>}
        </div>
      </div>
      <div className="relative mt-7 flex flex-wrap gap-2.5">
        <Link className="inline-flex min-h-11 items-center rounded-full bg-[#C7FF4A] px-5 text-[14px] font-semibold text-[#0D0D0D] transition hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F5F4EF]" href={`/app/identity/events/${event.id}`}>Guest list &amp; details</Link>
        <a className="inline-flex min-h-11 items-center rounded-full px-5 text-[14px] font-semibold shadow-[inset_0_0_0_1.5px_rgba(245,244,239,.3)] transition hover:bg-white/[0.06] focus-visible:outline-2 focus-visible:outline-[#F5F4EF]" href={eventPath(event)} rel="noreferrer" target="_blank">View event page ↗</a>
      </div>
    </section>
  );
}

/** No events yet: the whole journey in three steps, and one way in. */
function EventsEmpty() {
  const steps = [
    { title: "Create the page", body: "A name, a time and a place. It takes your Event Mode's look." },
    { title: "Share the link", body: "Guests RSVP in a tap. Set a limit and a waitlist fills itself." },
    { title: "Open the door", body: "Scan each guest's pass on the day, or check them in from the list." },
  ];
  return (
    <section className="overflow-hidden rounded-[28px] bg-[#0D0D0D] text-[#F5F4EF] md:grid md:grid-cols-[1.1fr_1fr]">
      <div className="p-6 md:p-9">
        <Mono className="text-[#C7FF4A]">Your first event</Mono>
        <h2 className="mt-3 font-display text-[36px] font-bold leading-[0.98] tracking-[-0.05em] md:text-[48px]">Host something.</h2>
        <p className="mt-3 max-w-[40ch] text-[15px] leading-[1.55] text-[#F5F4EF]/70">A dinner, a launch, a meetup. Setuvara gives it its own page with RSVPs, a guest list and a door.</p>
        <Link className="mt-7 inline-flex min-h-12 items-center rounded-full bg-[#C7FF4A] px-6 text-[15px] font-semibold text-[#0D0D0D] transition hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F5F4EF]" href="/app/identity/events/new">Create an event</Link>
      </div>
      <ol className="flex flex-col justify-center gap-5 border-t border-white/10 p-6 md:border-l md:border-t-0 md:p-9">
        {steps.map((step, index) => (
          <li className="flex gap-4" key={step.title}>
            <span aria-hidden="true" className="font-label text-[12px] text-[#C7FF4A]">0{index + 1}</span>
            <span><span className="block text-[16px] font-semibold">{step.title}</span><span className="mt-1 block text-[14px] leading-[1.5] text-[#F5F4EF]/60">{step.body}</span></span>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Event Mode's events: the next one up front, then what's coming, drafts, and the history. */
export async function EventsIndex() {
  const data = await loadOrganizer("/app/identity/events");
  if (!data.mode) notFound();
  if (!data.ready) return <StudioPage className="max-w-[1120px]"><Head tone="#C7FF4A" eyebrow={eyebrow} title="Events" /><EmptyState body="Events need a database update that hasn't reached this site yet." title="Not ready yet." /></StudioPage>;
  const now = clock();
  const upcoming = data.events.filter((event) => event.status === "published" && new Date(event.ends_at).getTime() > now).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const drafts = data.events.filter((event) => event.status === "draft");
  const past = data.events.filter((event) => !upcoming.includes(event) && !drafts.includes(event)).sort((a, b) => b.starts_at.localeCompare(a.starts_at));
  const going = upcoming.reduce((sum, event) => sum + event.confirmed_count, 0);
  const [next, ...later] = upcoming;
  const groups = [["Coming up", later], ["Drafts", drafts], ["Past", past]] as const;
  return (
    <StudioPage className="max-w-[1120px] pb-12">
      <Head tone="#C7FF4A" action={data.events.length ? <Link className={coralButton} href="/app/identity/events/new">New event</Link> : undefined} eyebrow={eyebrow} sub={upcoming.length ? `${upcoming.length} coming up · ${going} going` : data.events.length ? "Each event gets its own page, RSVPs and guest list." : undefined} title="Events" />
      {!eventsEnabled() && offNote}
      {data.events.length === 0 ? <EventsEmpty /> : (
        <>
          {next && <NextEvent event={next} now={now} />}
          <div className="flex flex-col gap-9">
            {groups.filter(([, list]) => list.length).map(([title, list]) => (
              <section aria-label={title} key={title}>
                <Mono className="mb-3 px-1 text-black/50">{title} · {list.length}</Mono>
                <ul className="divide-y divide-black/[0.07] overflow-hidden rounded-[24px] bg-white shadow-[inset_0_0_0_1px_rgba(13,13,13,.08)]">{list.map((event) => <EventRow event={event} key={event.id} now={now} />)}</ul>
              </section>
            ))}
          </div>
        </>
      )}
    </StudioPage>
  );
}

export async function NewEvent() {
  const data = await loadOrganizer("/app/identity/events/new");
  if (!data.mode) notFound();
  return (
    <StudioPage className="max-w-[860px]">
      <Head tone="#C7FF4A" back={{ href: "/app/identity/events", label: "Events" }} eyebrow={eyebrow} title="New event" />
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
      <Head tone="#C7FF4A"
        action={phase !== "draft" && phase !== "cancelled" ? (
          <div className="flex flex-wrap gap-2">
            {checkIn === "open" && <Link className={inkButton} data-open-scanner href={`/app/identity/events/${event.id}/scan`}><ScanIcon />Scan passes</Link>}
            <CopyLink url={url} />
            <a className={lineButton} href={eventPath(event)} rel="noreferrer" target="_blank">View page ↗</a>
          </div>
        ) : undefined}
        back={{ href: "/app/identity/events", label: "Events" }}
        eyebrow={<>{eyebrow}<span aria-hidden="true" className="text-black/25">/</span><PhasePill phase={phase} /></>}
        sub={<><span className="mb-2 flex lg:hidden"><PhasePill phase={phase} /></span>{when.date} {when.year} · {when.time}{phase === "upcoming" || phase === "live" ? ` · RSVPs ${rsvp === "open" ? "open" : rsvp === "soon" ? "open later" : "closed"}` : ""}</>}
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
      <Head tone="#C7FF4A" back={back} eyebrow={<>{eyebrow}<span aria-hidden="true" className="text-black/25">/</span>Door</>} sub={<>{when.date} · {when.time}</>} title={event.title} />
      {door === "open"
        ? <DoorScanner checkedIn={checkedIn} eventId={event.id} going={event.confirmed_count} />
        : <EmptyState action={<Link className={lineButton} href={back.href}>Guest list</Link>} body={closed[door]} title="The door isn't open." />}
      {door === "open" && <p className="mt-4 px-1 text-[13.5px] leading-[1.5] text-black/55">Guests find their door pass on their event page, linked in their RSVP email. No pass? Check them in from the guest list.</p>}
    </StudioPage>
  );
}
