import Link from "next/link";
import type { ReactNode } from "react";

import { formatCount, formatDay } from "@/lib/admin/format";

/*
 * Admin building blocks, in the homepage's language: paper canvas, Bricolage display type,
 * coral mono eyebrows, white cards with a hairline edge, ink pills. Dense where it must be, calm everywhere.
 */

export const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral";
export const labelClass = "font-label text-[10.5px] font-medium uppercase tracking-[0.16em] text-ink/45";
const card = "rounded-[22px] bg-white shadow-[0_0_0_1px_rgba(13,13,13,.08),0_1px_2px_rgba(13,13,13,.03)] sm:rounded-[26px]";

const buttonSizes = { sm: "h-9 px-4 text-[12.5px]", md: "h-11 px-5 text-[13.5px]" } as const;
const buttonVariants = {
  primary: "bg-ink text-paper hover:bg-[#262626]",
  secondary: "bg-white text-ink shadow-[inset_0_0_0_1px_rgba(13,13,13,.16)] hover:shadow-[inset_0_0_0_1.5px_#0d0d0d]",
  quiet: "text-ink/60 hover:bg-ink/[0.05] hover:text-ink",
  coral: "bg-coral text-ink hover:bg-[#ff6d63]",
} as const;

/** Pill buttons and button-looking links, sized for thumbs on phones. */
export function buttonClass(variant: keyof typeof buttonVariants = "secondary", size: keyof typeof buttonSizes = "sm") {
  return `inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full font-semibold transition-[background-color,box-shadow,color,opacity] disabled:cursor-wait disabled:opacity-55 ${buttonSizes[size]} ${buttonVariants[variant]} ${focusRing}`;
}

export function Eyebrow({ children, className = "text-coral" }: { children: ReactNode; className?: string }) {
  return <p className={`font-label text-[10.5px] font-medium uppercase tracking-[0.18em] sm:text-[11px] ${className}`}>{children}</p>;
}

export function PageHeader({ title, description, actions, eyebrow }: { title: string; description?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-5 pb-6 sm:pb-9">
      <div className="min-w-0 max-w-3xl">
        {eyebrow ? <Eyebrow className="mb-3 text-coral sm:mb-4">{eyebrow}</Eyebrow> : null}
        <h1 className="font-display text-[44px] font-extrabold leading-[0.9] tracking-[-0.06em] text-balance sm:text-[64px]">
          {title}<span className="text-coral">.</span>
        </h1>
        {description ? <p className="mt-4 max-w-2xl text-[14.5px] leading-[22px] text-ink/60 sm:mt-5 sm:text-[16px] sm:leading-6">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

/** A heading between groups of cards, like the section heads on the homepage. */
export function SectionHead({ id, eyebrow, title, description }: { id?: string; eyebrow?: ReactNode; title: string; description?: ReactNode }) {
  return (
    <div className="mb-4 mt-10 flex flex-wrap items-end justify-between gap-x-6 gap-y-2 sm:mb-5 sm:mt-14">
      <div className="min-w-0">
        {eyebrow ? <Eyebrow className="mb-2 text-coral">{eyebrow}</Eyebrow> : null}
        <h2 className="font-display text-[28px] font-extrabold leading-none tracking-[-0.05em] sm:text-[36px]" id={id}>{title}</h2>
      </div>
      {description ? <p className="max-w-md text-[13px] leading-5 text-ink/55 sm:text-right">{description}</p> : null}
    </div>
  );
}

export function Panel({ title, description, actions, children, className = "", padded = true, tone = "light" }: {
  title?: ReactNode; description?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; padded?: boolean; tone?: "light" | "ink";
}) {
  const dark = tone === "ink";
  return (
    <section className={`min-w-0 overflow-hidden ${dark ? "rounded-[22px] bg-ink text-paper sm:rounded-[26px]" : card} ${className}`}>
      {title ? (
        <div className={`flex flex-wrap items-start justify-between gap-3 px-5 pt-5 sm:px-7 sm:pt-6 ${padded ? "" : "pb-4 sm:pb-5"}`}>
          <div className="min-w-0">
            <h2 className="font-display text-[19px] font-bold leading-6 tracking-[-0.035em] sm:text-[21px]">{title}</h2>
            {description ? <p className={`mt-1 max-w-xl text-[12.5px] leading-[18px] sm:text-[13px] ${dark ? "text-paper/55" : "text-ink/50"}`}>{description}</p> : null}
          </div>
          {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      <div className={padded ? `px-5 pb-5 sm:px-7 sm:pb-7 ${title ? "pt-5" : "pt-5 sm:pt-7"}` : ""}>{children}</div>
    </section>
  );
}

type Delta = { label: string; direction: "up" | "down" | "flat" } | null;

function DeltaPill({ delta, dark }: { delta: NonNullable<Delta>; dark: boolean }) {
  const tone = delta.direction === "up" ? "bg-lime text-ink" : delta.direction === "down" ? "bg-coral text-ink" : dark ? "bg-paper/10 text-paper/70" : "bg-ink/[0.06] text-ink/60";
  return (
    <span className={`inline-flex h-[22px] items-center gap-1 rounded-full px-2 font-label text-[10.5px] font-medium tabular-nums tracking-[0.04em] ${tone}`}>
      <span aria-hidden="true">{delta.direction === "up" ? "↑" : delta.direction === "down" ? "↓" : "→"}</span>
      {delta.label.replace(/^[+-]/, "")}
      <span className="sr-only">{delta.direction === "up" ? "up" : delta.direction === "down" ? "down" : "unchanged"} on the previous period</span>
    </span>
  );
}

export function Stat({ label, value, note, delta, href, tone = "light" }: {
  label: string; value: ReactNode; note?: ReactNode; delta?: Delta; href?: string; tone?: "light" | "ink";
}) {
  const dark = tone === "ink";
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className={`font-label text-[10px] font-medium uppercase tracking-[0.16em] sm:text-[10.5px] ${dark ? "text-lime" : "text-ink/45"}`}>{label}</p>
        {href ? <span aria-hidden="true" className={`-mr-1 -mt-0.5 text-[15px] transition-transform group-hover:translate-x-0.5 ${dark ? "text-paper/40" : "text-ink/25"}`}>→</span> : null}
      </div>
      <div className="mt-auto pt-6 sm:pt-8">
        <div className="flex flex-wrap items-end gap-x-2.5 gap-y-1.5">
          <div className="min-w-0 max-w-full font-display text-[38px] font-extrabold leading-[0.85] tracking-[-0.06em] tabular-nums sm:text-[48px]">{value}</div>
          {delta ? <DeltaPill dark={dark} delta={delta} /> : null}
        </div>
        {note ? <p className={`mt-3 text-[12px] leading-[17px] sm:text-[12.5px] ${dark ? "text-paper/60" : "text-ink/50"}`}>{note}</p> : null}
      </div>
    </>
  );
  const className = `group flex min-h-[150px] min-w-0 flex-col px-4 py-4 sm:min-h-[184px] sm:px-6 sm:py-5 ${dark ? "rounded-[22px] bg-ink text-paper sm:rounded-[26px]" : card}`;
  return href
    ? <Link className={`${className} transition-shadow ${dark ? "hover:bg-[#1c1c1c]" : "hover:shadow-[0_0_0_1.5px_#0d0d0d]"} ${focusRing}`} href={href}>{body}</Link>
    : <div className={className}>{body}</div>;
}

const tones = {
  neutral: "bg-ink/[0.06] text-ink/70",
  ink: "bg-ink text-paper",
  good: "bg-[#e3f5d0] text-[#2c5a0f]",
  warn: "bg-[#fff1cc] text-[#6e4a00]",
  bad: "bg-coral/15 text-[#b32a1f]",
  coral: "bg-coral text-ink",
  sky: "bg-sky/55 text-[#1d3a66]",
  gold: "bg-[#e9c46a] text-ink",
} as const;
export type Tone = keyof typeof tones;

export function Badge({ tone = "neutral", children, dot = false }: { tone?: Tone; children: ReactNode; dot?: boolean }) {
  return (
    <span className={`inline-flex h-6 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-[11.5px] font-semibold ${tones[tone]}`}>
      {dot ? <span aria-hidden="true" className="size-1.5 rounded-full bg-current" /> : null}
      {children}
    </span>
  );
}

/** Plan colours follow /pricing: Plus is coral, Pro is gold on ink. */
export function PlanBadge({ plan }: { plan: "free" | "plus" | "pro" }) {
  if (plan === "pro") return <span className="inline-flex h-6 shrink-0 items-center gap-1 rounded-full bg-ink px-2.5 font-label text-[10px] font-medium uppercase tracking-[0.14em] text-[#e9c46a]">Pro</span>;
  if (plan === "plus") return <span className="inline-flex h-6 shrink-0 items-center rounded-full bg-coral px-2.5 font-label text-[10px] font-medium uppercase tracking-[0.14em] text-ink">Plus</span>;
  return <span className="inline-flex h-6 shrink-0 items-center rounded-full bg-ink/[0.06] px-2.5 font-label text-[10px] font-medium uppercase tracking-[0.14em] text-ink/55">Free</span>;
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 px-5 py-10 text-center">
      <span aria-hidden="true" className="grid size-10 place-items-center rounded-full bg-paper text-[16px] text-ink/35">∅</span>
      <p className="max-w-xs text-[13.5px] leading-5 text-ink/50">{children}</p>
    </div>
  );
}

export function KeyValues({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
      {items.map((item) => (
        <div className="flex min-w-0 items-baseline justify-between gap-4 border-b border-ink/[0.07] py-3 last:border-b-0 sm:[&:nth-last-child(2):nth-child(odd)]:border-b-0" key={item.label}>
          <dt className="shrink-0 text-[13px] text-ink/50">{item.label}</dt>
          <dd className="min-w-0 truncate text-right text-[13.5px] font-semibold tabular-nums">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** A labelled horizontal meter, for shares of a whole. */
export function Meter({ label, value, max, detail }: { label: ReactNode; value: number; max: number; detail?: ReactNode }) {
  const width = max > 0 ? Math.max(value > 0 ? 2 : 0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-[13.5px]">
        <span className="min-w-0 truncate font-semibold">{label}</span>
        <span className="shrink-0 tabular-nums text-ink/50">{detail ?? formatCount(value)}</span>
      </div>
      <div aria-hidden="true" className="mt-2 h-2 overflow-hidden rounded-full bg-ink/[0.06]">
        <div className="h-full rounded-full bg-ink" style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

/**
 * Daily single-series bars. Hover or focus a day for its value; the table underneath carries the
 * same numbers for screen readers. Today is drawn in coral.
 */
export function DailyBars({ label, points, tone = "light" }: { label: string; points: { date: string; value: number }[]; tone?: "light" | "ink" }) {
  const dark = tone === "ink";
  const max = Math.max(1, ...points.map((point) => point.value));
  const total = points.reduce((sum, point) => sum + point.value, 0);
  const last = points.length - 1;
  const ticks = [0, Math.floor(last / 2), last].filter((index, position, list) => list.indexOf(index) === position);
  return (
    <figure className="min-w-0">
      <figcaption className="flex items-end justify-between gap-3">
        <span>
          <span className={`block font-label text-[10px] font-medium uppercase tracking-[0.16em] ${dark ? "text-paper/50" : "text-ink/45"}`}>{label}</span>
          <span className={`mt-1 block text-[12px] ${dark ? "text-paper/45" : "text-ink/40"}`}>Peak {formatCount(max)} a day</span>
        </span>
        <span className="font-display text-[30px] font-extrabold leading-none tracking-[-0.055em] tabular-nums">{formatCount(total)}</span>
      </figcaption>
      <div aria-hidden="true" className={`relative mt-4 h-[132px] border-b ${dark ? "border-paper/20" : "border-ink/15"}`}>
        <div className={`pointer-events-none absolute inset-x-0 top-0 border-t border-dashed ${dark ? "border-paper/10" : "border-ink/[0.08]"}`} />
        <div className="absolute inset-0 flex items-end gap-[2px]">
          {points.map((point, index) => (
            <div className="group relative flex h-full min-w-0 flex-1 items-end" key={point.date}>
              <div
                className={`w-full rounded-t-[4px] transition-colors ${point.value
                  ? index === last ? "bg-coral" : dark ? "bg-paper group-hover:bg-lime" : "bg-ink group-hover:bg-coral"
                  : dark ? "bg-paper/10" : "bg-ink/[0.07]"}`}
                style={{ height: point.value ? `${Math.max(3, (point.value / max) * 100)}%` : "2px" }}
              />
              <div className={`pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold shadow-lg group-hover:block ${dark ? "bg-paper text-ink" : "bg-ink text-paper"}`}>
                {formatDay(point.date, true)} · {formatCount(point.value)}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div aria-hidden="true" className={`mt-2 flex justify-between font-label text-[10px] uppercase tracking-[0.08em] tabular-nums ${dark ? "text-paper/40" : "text-ink/40"}`}>
        {ticks.map((index) => <span key={index}>{index === last ? "Today" : formatDay(points[index]?.date, true)}</span>)}
      </div>
      <table className="sr-only">
        <caption>{label}</caption>
        <tbody>{points.map((point) => <tr key={point.date}><th>{point.date}</th><td>{point.value}</td></tr>)}</tbody>
      </table>
    </figure>
  );
}

/**
 * Daily bars of two series stacked (e.g. search and AI), with a legend. Same grammar as DailyBars:
 * hover a day for its values, and a table underneath for screen readers.
 */
export function StackedBars({ label, points, series }: {
  label: string;
  points: { date: string; values: [number, number] }[];
  series: [{ label: string; className: string }, { label: string; className: string }];
}) {
  const totals = points.map((point) => point.values[0] + point.values[1]);
  const max = Math.max(1, ...totals);
  const sums = [0, 1].map((index) => points.reduce((sum, point) => sum + point.values[index], 0));
  const last = points.length - 1;
  const ticks = [0, Math.floor(last / 2), last].filter((index, position, list) => list.indexOf(index) === position);
  return (
    <figure className="min-w-0">
      <figcaption className="flex flex-wrap items-end justify-between gap-3">
        <span className="font-label text-[10px] font-medium uppercase tracking-[0.16em] text-ink/45">{label}</span>
        <span className="flex flex-wrap gap-x-4 gap-y-1 text-[12.5px]">
          {series.map((item, index) => (
            <span className="flex items-center gap-2" key={item.label}><span aria-hidden="true" className={`size-2.5 rounded-full ${item.className}`} /><span className="text-ink/55">{item.label}</span><b className="tabular-nums">{formatCount(sums[index])}</b></span>
          ))}
        </span>
      </figcaption>
      <div aria-hidden="true" className="relative mt-4 h-[150px] border-b border-ink/15">
        <div className="pointer-events-none absolute inset-x-0 top-0 border-t border-dashed border-ink/[0.08]" />
        <div className="absolute inset-0 flex items-end gap-[2px]">
          {points.map((point, index) => (
            <div className="group relative flex h-full min-w-0 flex-1 flex-col justify-end" key={point.date}>
              {totals[index] ? <>
                <div className={`w-full rounded-t-[4px] ${series[1].className}`} style={{ height: `${(point.values[1] / max) * 100}%` }} />
                <div className={`w-full ${point.values[1] ? "" : "rounded-t-[4px]"} ${series[0].className}`} style={{ height: `${(point.values[0] / max) * 100}%` }} />
              </> : <div className="h-[2px] w-full bg-ink/[0.07]" />}
              <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-full bg-ink px-2.5 py-1 text-[11px] font-semibold text-paper shadow-lg group-hover:block">
                {formatDay(point.date, true)} · {series[0].label} {formatCount(point.values[0])} · {series[1].label} {formatCount(point.values[1])}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div aria-hidden="true" className="mt-2 flex justify-between font-label text-[10px] uppercase tracking-[0.08em] tabular-nums text-ink/40">
        {ticks.map((index) => <span key={index}>{index === last ? "Today" : formatDay(points[index]?.date, true)}</span>)}
      </div>
      <table className="sr-only">
        <caption>{label}</caption>
        <tbody>{points.map((point) => <tr key={point.date}><th>{point.date}</th><td>{series[0].label} {point.values[0]}</td><td>{series[1].label} {point.values[1]}</td></tr>)}</tbody>
      </table>
    </figure>
  );
}

/** The homepage's Mode switch: an ink pill with the current choice on paper. */
export function Segmented({ options, current, label = "Range" }: { options: { label: string; href: string; value: string }[]; current: string; label?: string }) {
  return (
    <nav aria-label={label} className="inline-flex rounded-full bg-ink p-1 text-paper">
      {options.map((option) => (
        <Link
          aria-current={option.value === current ? "page" : undefined}
          className={`inline-flex h-9 min-w-12 items-center justify-center rounded-full px-4 text-[13px] font-semibold transition-colors sm:h-10 ${focusRing} ${option.value === current ? "bg-paper text-ink" : "text-paper/65 hover:text-paper"}`}
          href={option.href}
          key={option.value}
          scroll={false}
        >
          {option.label}
        </Link>
      ))}
    </nav>
  );
}

/** Filters: a row of pills that scrolls sideways on phones rather than wrapping. */
export function Tabs({ options, current, label = "Filter" }: { options: { label: string; href: string; value: string; count?: number }[]; current: string; label?: string }) {
  return (
    <nav aria-label={label} className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
      <div className="flex min-w-max gap-1.5">
        {options.map((option) => {
          const active = option.value === current;
          return (
            <Link
              aria-current={active ? "page" : undefined}
              className={`inline-flex h-10 items-center gap-2 rounded-full px-4 text-[13px] font-semibold transition-colors ${focusRing} ${active ? "bg-ink text-paper" : "bg-white text-ink/65 shadow-[inset_0_0_0_1px_rgba(13,13,13,.1)] hover:text-ink hover:shadow-[inset_0_0_0_1px_rgba(13,13,13,.3)]"}`}
              href={option.href}
              key={option.value}
            >
              {option.label}
              {typeof option.count === "number" ? <span className={`rounded-full px-1.5 font-label text-[10.5px] tabular-nums ${active ? "bg-paper/15 text-paper" : "bg-ink/[0.06] text-ink/55"}`}>{formatCount(option.count)}</span> : null}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function Pager({ page, pageSize, total, href }: { page: number; pageSize: number; total: number; href: (page: number) => string }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-between gap-3 px-5 py-4 text-[12.5px] text-ink/50 sm:px-7">
      <span className="tabular-nums">Page {page} of {pages} <span className="hidden sm:inline">· {formatCount(total)} total</span></span>
      <div className="flex gap-2">
        {page > 1 ? <Link className={buttonClass("secondary")} href={href(page - 1)}><span aria-hidden="true">←</span> Previous</Link> : null}
        {page < pages ? <Link className={buttonClass("primary")} href={href(page + 1)}>Next <span aria-hidden="true">→</span></Link> : null}
      </div>
    </div>
  );
}

export function Th({ children, align = "left", className = "" }: { children?: ReactNode; align?: "left" | "right"; className?: string }) {
  return <th className={`whitespace-nowrap px-3 py-3 font-label text-[10px] font-medium uppercase tracking-[0.14em] text-ink/40 first:pl-5 last:pr-5 sm:first:pl-7 sm:last:pr-7 ${align === "right" ? "text-right" : "text-left"} ${className}`} scope="col">{children}</th>;
}

export function Td({ children, align = "left", className = "" }: { children?: ReactNode; align?: "left" | "right"; className?: string }) {
  return <td className={`px-3 py-3.5 align-middle text-[13.5px] first:pl-5 last:pr-5 sm:first:pl-7 sm:last:pr-7 ${align === "right" ? "text-right tabular-nums" : ""} ${className}`}>{children}</td>;
}

export function Table({ children, minWidth = 720 }: { children: ReactNode; minWidth?: number }) {
  return (
    <div className="overflow-x-auto border-t border-ink/[0.07]">
      <table className="w-full border-collapse" style={{ minWidth }}>{children}</table>
    </div>
  );
}

const INITIAL_TONES = ["bg-coral text-ink", "bg-lime text-ink", "bg-sky text-ink", "bg-ink text-paper", "bg-[#e9c46a] text-ink"];

/** A letter avatar. The colour comes from the name, so a member keeps theirs across pages. */
export function Initial({ name, large = false }: { name: string | null | undefined; large?: boolean }) {
  const source = (name ?? "?").trim();
  const letter = source.charAt(0).toUpperCase() || "?";
  const tone = INITIAL_TONES[[...source].reduce((sum, char) => sum + char.charCodeAt(0), 0) % INITIAL_TONES.length];
  return <span aria-hidden="true" className={`grid shrink-0 place-items-center rounded-full font-display font-extrabold tracking-[-0.04em] ${tone} ${large ? "size-16 text-[28px] sm:size-20 sm:text-[34px]" : "size-9 text-[14px]"}`}>{letter}</span>;
}

export function Notice({ tone = "neutral", children }: { tone?: "neutral" | "warn"; children: ReactNode }) {
  return (
    <div className={`flex gap-3 rounded-[18px] px-4 py-3.5 text-[12.5px] leading-[19px] sm:px-5 ${tone === "warn" ? "bg-[#fff1cc] text-[#5c3f00]" : "bg-ink/[0.045] text-ink/60"}`}>
      <span aria-hidden="true" className={`mt-[3px] size-2 shrink-0 rounded-full ${tone === "warn" ? "bg-[#e0a100]" : "bg-ink/30"}`} />
      <p className="min-w-0">{children}</p>
    </div>
  );
}
