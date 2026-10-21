import Link from "next/link";
import { notFound } from "next/navigation";

import { Head } from "@/components/actions/actions-pages";
import { EmptyState, Mono, StudioPage, coralButton } from "@/components/creator/studio-ui";
import { formatSlot, zoneName, type Booking } from "@/lib/business/bookings";
import { funnelSteps, type Funnel } from "@/lib/business/model";
import { LEADS_HREF, loadLeads } from "@/lib/business/studio-server";
import { LeadsInbox } from "./leads-client";

const eyebrow = <><span aria-hidden="true" className="size-2 rounded-full bg-[#AFCBFF] shadow-[inset_0_0_0_1px_rgba(13,13,13,.2)]" />Business Mode</>;
const WINDOWS = [7, 30, 90, 365] as const;

/**
 * The funnel, read left to right. Every number counts its own events in the window; nothing here
 * follows one person from step to step, and there is no money in it.
 */
function FunnelStrip({ funnel, days }: { funnel: Funnel; days: number }) {
  const steps = funnelSteps(funnel);
  const peak = Math.max(1, ...steps.map((step) => step.value));
  return (
    <section aria-labelledby="funnel-title" className="mb-10">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <h2 className="font-display text-[28px] font-bold tracking-[-0.045em]" id="funnel-title">Conversion</h2>
        <nav aria-label="Window" className="flex gap-1 rounded-full bg-black/[0.05] p-1">
          {WINDOWS.map((window) => {
            const locked = window > funnel.plan_days;
            const on = window === funnel.days;
            return locked
              ? <span className="grid min-h-9 place-items-center rounded-full px-3 text-[13px] font-semibold text-black/30" key={window} title="Longer windows are part of Plus">{window}d</span>
              : <Link aria-current={on ? "page" : undefined} className={`grid min-h-9 place-items-center rounded-full px-3 text-[13px] font-semibold transition ${on ? "bg-white text-[#0D0D0D] shadow-[0_1px_2px_rgba(13,13,13,.12)]" : "text-black/55 hover:text-[#0D0D0D]"}`} href={`${LEADS_HREF}?days=${window}`} key={window} scroll={false}>{window}d</Link>;
          })}
        </nav>
      </div>
      <ol className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-6">
        {steps.map((step, index) => (
          <li className="relative overflow-hidden rounded-[22px] bg-white p-4 shadow-[inset_0_0_0_1px_rgba(13,13,13,.08)] md:p-5" data-funnel={step.key} key={step.key}>
            <span aria-hidden="true" className="absolute inset-x-0 bottom-0 bg-[#AFCBFF]/35" style={{ height: `${Math.max(4, (step.value / peak) * 100)}%` }} />
            <div className="relative">
              <Mono className="text-black/50">{String(index + 1).padStart(2, "0")} · {step.label}</Mono>
              <p className="mt-2 font-display text-[34px] font-bold leading-none tracking-[-0.05em]">{step.value.toLocaleString("en-GB")}</p>
              <p className="mt-1.5 min-h-[18px] text-[12.5px] text-black/55">{step.note ?? ""}</p>
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-[13px] leading-[1.5] text-black/50">
        Last {days} days. Each step counts its own events; Setuvara doesn&apos;t follow one visitor from step to step, and never guesses revenue. Won is what you mark.
        {funnel.days < days ? " Your plan shows a shorter window." : ""}
      </p>
    </section>
  );
}

function Card({ linked, href, className, children }: { linked: boolean; href: string; className: string; children: React.ReactNode }) {
  return linked ? <Link className={className} href={href}>{children}</Link> : <div className={className.replace(/ transition hover:\S+/, "")}>{children}</div>;
}

/**
 * The next held and confirmed times across Business Mode's Booking Actions. The owner's cards open
 * the Action's times; a teammate's (`linked` false) are read-only.
 */
export function ComingUp({ bookings, linked = true }: { bookings: (Booking & { name: string; title: string })[]; linked?: boolean }) {
  if (!bookings.length) return null;
  return (
    <section aria-labelledby="coming-title" className="mb-10">
      <div className="mb-3 flex items-end justify-between gap-3">
        <h2 className="font-display text-[28px] font-bold tracking-[-0.045em]" id="coming-title">Coming up</h2>
        <Mono className="text-black/45">{bookings.length} booked</Mono>
      </div>
      <ol className="-mx-3.5 flex snap-x gap-2.5 overflow-x-auto px-3.5 pb-1 md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0 xl:grid-cols-4">
        {bookings.slice(0, 8).map((booking) => (
          <li className="min-w-[232px] snap-start" data-coming={booking.status} key={booking.id}>
            <Card className="flex h-full flex-col gap-1 rounded-[22px] bg-white p-4 shadow-[inset_0_0_0_1px_rgba(13,13,13,.08)] transition hover:shadow-[inset_0_0_0_1.5px_#0D0D0D]" href={`/app/identity/actions/${booking.action_id}?tab=times`} linked={linked}>
              <span className="flex items-center justify-between gap-2">
                <span className="font-display text-[19px] font-bold tracking-[-0.03em]">{formatSlot(booking.starts_at, booking.timezone)}</span>
                <span className={`size-2.5 shrink-0 rounded-full ${booking.status === "confirmed" ? "bg-[#C7FF4A] shadow-[inset_0_0_0_1px_rgba(13,13,13,.25)]" : "bg-[#FFE7B8] shadow-[inset_0_0_0_1px_rgba(13,13,13,.2)]"}`} title={booking.status === "confirmed" ? "Confirmed" : "Requested"} />
              </span>
              <span className="truncate text-[14px] font-semibold">{booking.name}</span>
              <span className="truncate text-[13px] text-black/50">{booking.title} · {zoneName(booking.timezone)}</span>
            </Card>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Business Mode's leads: how inquiries turn into work, and the inbox to move them along. */
export async function LeadsIndex({ days }: { days: number }) {
  const data = await loadLeads(days);
  if (!data.mode) notFound();
  if (!data.ready) return <StudioPage><Head eyebrow={eyebrow} title="Leads" /><EmptyState body="Leads need a database update that hasn't reached this site yet." title="Not ready yet." /></StudioPage>;
  const { leads, funnel, limits } = data;
  const open = funnel.open_by_stage.new + funnel.open_by_stage.contacted + funnel.open_by_stage.qualified;
  return (
    <StudioPage className="max-w-[1180px]">
      <Head eyebrow={eyebrow} sub={leads.length ? `${open} open · ${funnel.open_by_stage.new} new` : "Every inquiry from your Business Mode lands here as a lead."} title="Leads" />
      <ComingUp bookings={data.bookings} />
      <FunnelStrip days={days} funnel={funnel} />
      {leads.length === 0 ? (
        <EmptyState
          action={<Link className={coralButton} href="/app/identity/actions?mode=business">Add a Booking or Collab Action</Link>}
          body="When someone books, asks or pitches through an Action on your Business Mode, they arrive here as a lead you can move from New to Won."
          title="No leads yet."
        />
      ) : (
        <LeadsInbox canExport={limits.can_export} canNote={limits.can_note} leads={leads} owner={data.profile.display_name} people={data.people} />
      )}
    </StudioPage>
  );
}
