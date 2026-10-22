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
      <FunnelFlow steps={steps} />
      <p className="mt-3 text-[13px] leading-[1.5] text-black/50">
        Last {days} days. Each step counts its own events; Setuvara doesn&apos;t follow one visitor from step to step, and never guesses revenue. Won is what you mark.
        {funnel.days < days ? " Your plan shows a shorter window." : ""}
      </p>
    </section>
  );
}

/**
 * The funnel as one shape: a band that narrows from visits to won, in the Mode's blue fading to
 * lime, with each step's number under it. Heights use a square root so small steps stay visible.
 */
function FunnelFlow({ steps }: { steps: ReturnType<typeof funnelSteps> }) {
  const peak = Math.max(1, ...steps.map((step) => step.value));
  const W = 1200;
  const H = 180;
  const col = W / steps.length;
  const half = (value: number) => Math.max(3, Math.sqrt(value / peak) * (H / 2 - 6));
  const pts = steps.map((step, i) => ({ x: col * i + col / 2, h: half(step.value) }));
  const all = [{ x: 0, h: pts[0].h }, ...pts, { x: W, h: pts[pts.length - 1].h }];
  const curve = (sign: 1 | -1) => all.map((p, i) => {
    const y = H / 2 - sign * p.h;
    if (i === 0) return `M${p.x},${y}`;
    const prev = all[i - 1];
    const mid = (prev.x + p.x) / 2;
    return `C${mid},${H / 2 - sign * prev.h} ${mid},${y} ${p.x},${y}`;
  }).join(" ");
  const shape = `${curve(1)} L${W},${H / 2 + all[all.length - 1].h} ${[...all].reverse().map((p, i, list) => {
    const y = H / 2 + p.h;
    if (i === 0) return "";
    const prev = list[i - 1];
    const mid = (prev.x + p.x) / 2;
    return `C${mid},${H / 2 + prev.h} ${mid},${y} ${p.x},${y}`;
  }).join(" ")} Z`;
  const rate = (i: number) => {
    if (i === 0) return null;
    const before = steps[i - 1].value;
    return before > 0 ? `${Math.round((steps[i].value / before) * 100)}% of ${steps[i - 1].label.toLowerCase()}` : null;
  };
  return (
    <div className="relative isolate overflow-hidden rounded-[28px] bg-[#0D0D0D] text-[#F5F4EF] shadow-[0_30px_60px_-40px_#0D0D0D]" data-funnel-flow>
      <div className="overflow-x-auto [scrollbar-width:none]">
        <div className="min-w-[680px] px-2 pb-6 pt-7 md:px-4">
          <svg aria-hidden="true" className="funnel-in block h-[150px] w-full md:h-[180px]" preserveAspectRatio="none" viewBox={`0 0 ${W} ${H}`}>
            <defs>
              <linearGradient id="funnel-fill" x1="0" x2="1" y1="0" y2="0">
                <stop offset="0%" stopColor="#AFCBFF" stopOpacity="0.95" />
                <stop offset="70%" stopColor="#AFCBFF" stopOpacity="0.55" />
                <stop offset="100%" stopColor="#C7FF4A" stopOpacity="0.9" />
              </linearGradient>
            </defs>
            <path d={shape} fill="url(#funnel-fill)" />
            {pts.slice(1).map((p) => <line key={p.x} stroke="#0D0D0D" strokeOpacity="0.55" strokeWidth="2" vectorEffect="non-scaling-stroke" x1={p.x - col / 2} x2={p.x - col / 2} y1="0" y2={H} />)}
          </svg>
          <ol className="mt-5 grid" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
            {steps.map((step, i) => (
              <li className="flex flex-col gap-1 border-l border-[#F5F4EF]/10 px-3 first:border-l-0 md:px-4" data-funnel={step.key} key={step.key}>
                <span className="font-label text-[10px] uppercase tracking-[0.16em] text-[#F5F4EF]/50">{step.label}</span>
                <span className="font-display text-[30px] font-bold leading-none tracking-[-0.05em] tabular-nums md:text-[38px]">{step.value.toLocaleString("en-GB")}</span>
                <span className="min-h-[34px] text-[12px] leading-[1.4] text-[#F5F4EF]/55">{rate(i) ?? step.note ?? ""}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
      <style>{`.funnel-in{clip-path:inset(0 100% 0 0);animation:funnel-in 1.4s cubic-bezier(.65,0,.35,1) .1s forwards}@keyframes funnel-in{to{clip-path:inset(0 0 0 0)}}@media (prefers-reduced-motion:reduce){.funnel-in{animation:none;clip-path:none}}`}</style>
    </div>
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
  if (!data.ready) return <StudioPage><Head tone="#AFCBFF" eyebrow={eyebrow} title="Leads" /><EmptyState body="Leads need a database update that hasn't reached this site yet." title="Not ready yet." /></StudioPage>;
  const { leads, funnel, limits } = data;
  const open = funnel.open_by_stage.new + funnel.open_by_stage.contacted + funnel.open_by_stage.qualified;
  return (
    <StudioPage className="max-w-[1180px]">
      <Head tone="#AFCBFF" eyebrow={eyebrow} sub={leads.length ? `${open} open · ${funnel.open_by_stage.new} new` : "Every inquiry from your Business Mode lands here as a lead."} title="Leads" />
      <ComingUp bookings={data.bookings} />
      <FunnelStrip days={days} funnel={funnel} />
      {leads.length === 0 ? (
        <EmptyState
          action={<Link className={coralButton} href="/app/identity/actions?mode=business">Add a Booking or Collab Action</Link>}
          body="When someone books, asks or pitches through an Action on your Business Mode, they arrive here as a lead you can move from New to Won."
          title="No leads yet."
        />
      ) : (
        <LeadsInbox canExport={limits.can_export} canNote={limits.can_note} leads={leads} owner={data.profile.display_name} />
      )}
    </StudioPage>
  );
}
