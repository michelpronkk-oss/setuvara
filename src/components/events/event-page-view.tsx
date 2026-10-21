import Link from "next/link";
import type { ReactNode } from "react";

import { actionThemeVars, type ActionTheme } from "@/lib/actions/theme";
import { eventPlace, eventWhen, PHASE_LABEL, type EventPhase, type PublicEvent } from "@/lib/events/model";

type ViewEvent = Pick<PublicEvent, "title" | "summary" | "starts_at" | "ends_at" | "timezone" | "venue_name" | "address" | "city" | "online_url"> & { phase: EventPhase };

const mapsUrl = (query: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;

/**
 * One event's page, in the organizer's Event Mode Appearance: a wash of the Mode's photo, the title
 * in the name's typeface, then the when-and-where as one calm card, the story, and whatever goes below
 * (the RSVP form, a state, or a guest's own registration).
 */
export function EventPageView({ event, theme, organizer, photoUrl, backHref, calendarHref, children }: {
  event: ViewEvent; theme: ActionTheme; organizer: string; photoUrl: string | null; backHref?: string | null; calendarHref?: string; children: ReactNode;
}) {
  const when = eventWhen(event);
  const place = eventPlace(event);
  const query = [event.venue_name, event.address, event.city].filter(Boolean).join(", ");
  const live = event.phase === "live";
  const muted = event.phase === "ended" || event.phase === "cancelled";
  const back = <span aria-hidden="true" className="text-[22px] leading-none">←</span>;
  return (
    <div className="relative isolate min-h-dvh font-brand" data-event-page={event.phase} style={actionThemeVars(theme)}>
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[460px] overflow-hidden">
        {photoUrl
          // eslint-disable-next-line @next/next/no-img-element -- decorative wash of the Mode's own public photo
          ? <img alt="" className="absolute -inset-[12%] size-[124%] max-w-none object-cover" src={photoUrl} style={{ filter: `blur(48px) saturate(1.3) brightness(${theme.light ? 1.1 : 0.6})`, opacity: theme.light ? 0.55 : 0.75 }} />
          : <div className="absolute inset-0" style={{ background: `radial-gradient(90% 70% at 50% 0%, color-mix(in srgb, ${theme.accent} 45%, transparent), transparent)` }} />}
        <div className="absolute inset-0" style={{ background: `linear-gradient(180deg, color-mix(in srgb, ${theme.bg} 20%, transparent), ${theme.bg} 92%)` }} />
      </div>
      <div className="mx-auto flex min-h-dvh w-full max-w-[600px] flex-col px-5 pb-[calc(24px+env(safe-area-inset-bottom))] pt-[calc(16px+env(safe-area-inset-top))]">
        <header className="grid grid-cols-[44px_1fr_44px] items-center">
          {backHref
            ? <Link aria-label={`Back to ${organizer}`} className="grid size-11 place-items-center rounded-full transition hover:bg-[var(--av-line)] focus-visible:outline-2" href={backHref}>{back}</Link>
            : <span aria-hidden="true" />}
          <p className="truncate text-center text-[16px] font-semibold">{organizer}</p>
        </header>

        <p className="mt-8 flex items-center gap-2 font-label text-[11px] uppercase tracking-[0.18em] text-[var(--av-muted)]">
          <span aria-hidden="true" className={`size-1.5 rounded-full ${live ? "animate-pulse" : ""}`} style={{ background: muted ? "var(--av-muted)" : theme.accent }} />
          {event.phase === "upcoming" ? "Event" : PHASE_LABEL[event.phase]}
        </p>
        <h1 className={`mt-3 text-balance text-[44px] md:text-[56px] ${event.phase === "cancelled" ? "line-through decoration-2 opacity-70" : ""}`} style={{ ...theme.heading, lineHeight: 0.95 }}>{event.title}</h1>

        <section aria-label="When and where" className="mt-7 overflow-hidden bg-[var(--av-panel)] shadow-[inset_0_0_0_1px_var(--av-line)]" style={{ borderRadius: Math.min(theme.radius + 6, 28) }}>
          <div className="flex items-start gap-4 p-5">
            <DateTile iso={event.starts_at} timeZone={event.timezone} theme={theme} />
            <div className="min-w-0 pt-0.5">
              <p className="text-[17px] font-semibold leading-snug">{when.date}</p>
              <p className="mt-1 text-[15px] text-[var(--av-muted)]">{when.time}</p>
              {calendarHref && !muted && <a className="mt-2 inline-flex min-h-9 items-center text-[14px] font-semibold underline decoration-[var(--av-line)] underline-offset-4 hover:decoration-current" download href={calendarHref}>Add to calendar</a>}
            </div>
          </div>
          {(place.line || place.address) && (
            <div className="flex items-start gap-4 border-t border-[var(--av-line)] p-5">
              <span aria-hidden="true" className="grid size-14 shrink-0 place-items-center rounded-[16px] bg-[var(--av-line)]">
                <svg className="size-6" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24">{place.online ? <><rect height="12" rx="2" width="18" x="3" y="5" /><path d="M8 21h8M12 17v4" /></> : <><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21Z" /><circle cx="12" cy="9.5" r="2.5" /></>}</svg>
              </span>
              <div className="min-w-0 pt-0.5">
                <p className="text-[17px] font-semibold leading-snug">{place.line}</p>
                {place.address && <p className="mt-1 text-[15px] text-[var(--av-muted)]">{place.address}</p>}
                {query && !muted && <a className="mt-2 inline-flex min-h-9 items-center text-[14px] font-semibold underline decoration-[var(--av-line)] underline-offset-4 hover:decoration-current" href={mapsUrl(query)} rel="noreferrer" target="_blank">Open in Maps</a>}
              </div>
            </div>
          )}
        </section>

        {event.summary && <p className="mt-7 whitespace-pre-line text-[16px] leading-[1.6] opacity-90">{event.summary}</p>}
        {children}
      </div>
    </div>
  );
}

/** The month and day as a small card, in the event's own time zone. */
function DateTile({ iso, timeZone, theme }: { iso: string; timeZone: string; theme: ActionTheme }) {
  const date = new Date(iso);
  const month = new Intl.DateTimeFormat("en-GB", { timeZone, month: "short" }).format(date);
  const day = new Intl.DateTimeFormat("en-GB", { timeZone, day: "numeric" }).format(date);
  return (
    <span aria-hidden="true" className="grid size-14 shrink-0 grid-rows-[18px_1fr] overflow-hidden rounded-[16px] text-center shadow-[inset_0_0_0_1px_var(--av-line)]">
      <span className="font-label text-[10px] uppercase leading-[18px] tracking-[0.14em]" style={{ background: theme.accent, color: theme.onAccent }}>{month}</span>
      <span className="grid place-items-center text-[22px] font-bold leading-none">{day}</span>
    </span>
  );
}

/** A quiet panel under the details: closed, full, cancelled, ended, or a note. */
export function EventPanel({ title, body, action }: { title: string; body?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mt-8 rounded-[22px] bg-[var(--av-panel)] p-6 shadow-[inset_0_0_0_1px_var(--av-line)]">
      <p className="text-[17px] font-semibold">{title}</p>
      {body && <p className="mt-2 text-[15px] leading-[1.5] text-[var(--av-muted)]">{body}</p>}
      {action}
    </div>
  );
}

export const eventButton = "inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-full text-[16px] font-semibold transition active:scale-[.98] focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50";
export const eventButtonStyle = { background: "var(--av-btn-bg)", color: "var(--av-btn-fg)", boxShadow: "var(--av-btn-ring)" } as const;
