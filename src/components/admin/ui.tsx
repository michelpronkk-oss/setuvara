import Link from "next/link";
import type { ReactNode } from "react";

import { formatCount, formatDay } from "@/lib/admin/format";

/* Admin building blocks: paper canvas, white panels, ink type, mono labels. Dense but calm. */

export const labelClass = "font-label text-[10.5px] font-medium uppercase tracking-[0.14em] text-ink/50";

export function PageHeader({ title, description, actions, eyebrow }: { title: string; description?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4 pb-5">
      <div className="min-w-0">
        {eyebrow ? <div className="mb-2">{eyebrow}</div> : null}
        <h1 className="font-display text-[28px] font-bold leading-none tracking-[-0.045em] sm:text-[32px]">{title}</h1>
        {description ? <p className="mt-2 max-w-2xl text-[13.5px] leading-5 text-ink/60">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function Panel({ title, description, actions, children, className = "", padded = true }: {
  title?: ReactNode; description?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; padded?: boolean;
}) {
  return (
    <section className={`min-w-0 rounded-[14px] bg-white shadow-[0_0_0_1px_rgba(13,13,13,.07),0_1px_2px_rgba(13,13,13,.04)] ${className}`}>
      {title ? (
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-ink/[0.07] px-4 py-3.5 sm:px-5">
          <div className="min-w-0">
            <h2 className="text-[14px] font-semibold tracking-[-0.01em]">{title}</h2>
            {description ? <p className="mt-0.5 text-[12.5px] leading-[18px] text-ink/55">{description}</p> : null}
          </div>
          {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      <div className={padded ? "px-4 py-4 sm:px-5" : ""}>{children}</div>
    </section>
  );
}

export function Stat({ label, value, note, delta, href }: {
  label: string; value: ReactNode; note?: ReactNode; delta?: { label: string; direction: "up" | "down" | "flat" } | null; href?: string;
}) {
  const body = (
    <>
      <p className={labelClass}>{label}</p>
      <div className="mt-3 flex items-baseline gap-2">
        <p className="font-display text-[30px] font-bold leading-none tracking-[-0.05em] tabular-nums">{value}</p>
        {delta ? (
          <span className={`rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${delta.direction === "up" ? "bg-[#e7f6ea] text-[#1d6b34]" : delta.direction === "down" ? "bg-[#fdecea] text-[#a2281f]" : "bg-ink/[0.06] text-ink/60"}`}>
            {delta.label}
          </span>
        ) : null}
      </div>
      {note ? <p className="mt-2 text-[12px] leading-4 text-ink/55">{note}</p> : null}
    </>
  );
  const className = "block min-w-0 rounded-[14px] bg-white px-4 py-4 shadow-[0_0_0_1px_rgba(13,13,13,.07),0_1px_2px_rgba(13,13,13,.04)] sm:px-5";
  return href
    ? <Link className={`${className} transition-shadow hover:shadow-[0_0_0_1px_rgba(13,13,13,.16)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink`} href={href}>{body}</Link>
    : <div className={className}>{body}</div>;
}

const tones = {
  neutral: "bg-ink/[0.06] text-ink/70",
  ink: "bg-ink text-paper",
  good: "bg-[#e7f6ea] text-[#1d6b34]",
  warn: "bg-[#fff3d6] text-[#7a5300]",
  bad: "bg-[#fdecea] text-[#a2281f]",
  coral: "bg-coral/15 text-[#b8352b]",
  sky: "bg-sky/45 text-[#21406f]",
} as const;
export type Tone = keyof typeof tones;

export function Badge({ tone = "neutral", children, dot = false }: { tone?: Tone; children: ReactNode; dot?: boolean }) {
  return (
    <span className={`inline-flex h-[22px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2 text-[11.5px] font-semibold ${tones[tone]}`}>
      {dot ? <span aria-hidden="true" className="size-1.5 rounded-full bg-current" /> : null}
      {children}
    </span>
  );
}

export function PlanBadge({ plan }: { plan: "free" | "plus" | "pro" }) {
  if (plan === "pro") return <Badge tone="ink">Pro</Badge>;
  if (plan === "plus") return <Badge tone="coral">Plus</Badge>;
  return <Badge>Free</Badge>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="py-6 text-center text-[13px] text-ink/50">{children}</p>;
}

export function KeyValues({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
      {items.map((item) => (
        <div className="flex min-w-0 items-baseline justify-between gap-4 border-b border-ink/[0.06] py-2.5 last:border-b-0 sm:[&:nth-last-child(2):nth-child(odd)]:border-b-0" key={item.label}>
          <dt className="shrink-0 text-[12.5px] text-ink/55">{item.label}</dt>
          <dd className="min-w-0 truncate text-right text-[13px] font-medium tabular-nums">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** A labelled horizontal meter, for shares of a whole. */
export function Meter({ label, value, max, detail }: { label: ReactNode; value: number; max: number; detail?: ReactNode }) {
  const width = max > 0 ? Math.max(value > 0 ? 1.5 : 0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-[13px]">
        <span className="min-w-0 truncate font-medium">{label}</span>
        <span className="shrink-0 tabular-nums text-ink/60">{detail ?? formatCount(value)}</span>
      </div>
      <div aria-hidden="true" className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-ink/[0.06]">
        <div className="h-full rounded-full bg-ink" style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

/**
 * Daily single-series bars. Hover or focus a day for its value; the table underneath carries the
 * same numbers for screen readers.
 */
export function DailyBars({ label, points }: { label: string; points: { date: string; value: number }[] }) {
  const max = Math.max(1, ...points.map((point) => point.value));
  const total = points.reduce((sum, point) => sum + point.value, 0);
  const ticks = [0, Math.floor((points.length - 1) / 2), points.length - 1].filter((index, position, list) => list.indexOf(index) === position);
  return (
    <figure className="min-w-0">
      <figcaption className="flex items-baseline justify-between gap-3">
        <span className="text-[12.5px] text-ink/55">{label} <span className="text-ink/35">· peak {formatCount(max)} a day</span></span>
        <span className="font-display text-[20px] font-bold tracking-[-0.04em] tabular-nums">{formatCount(total)}</span>
      </figcaption>
      <div aria-hidden="true" className="relative mt-3 h-[120px] border-b border-ink/15">
        <div className="pointer-events-none absolute inset-x-0 top-0 border-t border-dashed border-ink/[0.08]" />
        <div className="absolute inset-0 flex items-end gap-[2px]">
          {points.map((point) => (
            <div className="group relative flex h-full min-w-0 flex-1 items-end" key={point.date} tabIndex={-1}>
              <div
                className={`w-full rounded-t-[3px] ${point.value ? "bg-ink group-hover:bg-coral" : "bg-ink/[0.07]"}`}
                style={{ height: point.value ? `${Math.max(3, (point.value / max) * 100)}%` : "2px" }}
              />
              <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-ink px-2 py-1 text-[11px] font-medium text-paper shadow-lg group-hover:block">
                {formatDay(point.date, true)} · {formatCount(point.value)}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div aria-hidden="true" className="mt-1.5 flex justify-between text-[10.5px] tabular-nums text-ink/45">
        {ticks.map((index) => <span key={index}>{formatDay(points[index]?.date, true)}</span>)}
      </div>
      <table className="sr-only">
        <caption>{label}</caption>
        <tbody>{points.map((point) => <tr key={point.date}><th>{point.date}</th><td>{point.value}</td></tr>)}</tbody>
      </table>
    </figure>
  );
}

export function Segmented({ options, current }: { options: { label: string; href: string; value: string }[]; current: string }) {
  return (
    <nav aria-label="Range" className="inline-flex rounded-full bg-white p-1 shadow-[0_0_0_1px_rgba(13,13,13,.08)]">
      {options.map((option) => (
        <Link
          aria-current={option.value === current ? "page" : undefined}
          className={`inline-flex h-8 items-center rounded-full px-3.5 text-[12.5px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${option.value === current ? "bg-ink text-paper" : "text-ink/60 hover:text-ink"}`}
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

export function Tabs({ options, current }: { options: { label: string; href: string; value: string; count?: number }[]; current: string }) {
  return (
    <nav className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <div className="flex min-w-max gap-1 border-b border-ink/10">
        {options.map((option) => (
          <Link
            aria-current={option.value === current ? "page" : undefined}
            className={`-mb-px inline-flex h-10 items-center gap-2 border-b-2 px-3 text-[13px] font-semibold transition-colors ${option.value === current ? "border-ink text-ink" : "border-transparent text-ink/50 hover:text-ink"}`}
            href={option.href}
            key={option.value}
          >
            {option.label}
            {typeof option.count === "number" ? <span className="rounded-full bg-ink/[0.07] px-1.5 text-[11px] tabular-nums text-ink/60">{formatCount(option.count)}</span> : null}
          </Link>
        ))}
      </div>
    </nav>
  );
}

export function Pager({ page, pageSize, total, href }: { page: number; pageSize: number; total: number; href: (page: number) => string }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  const linkClass = "inline-flex h-8 items-center rounded-full px-3 text-[12.5px] font-semibold shadow-[0_0_0_1px_rgba(13,13,13,.12)] hover:bg-ink/[0.03]";
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 text-[12.5px] text-ink/55 sm:px-5">
      <span>Page {page} of {pages} · {formatCount(total)} total</span>
      <div className="flex gap-2">
        {page > 1 ? <Link className={linkClass} href={href(page - 1)}>Previous</Link> : null}
        {page < pages ? <Link className={linkClass} href={href(page + 1)}>Next</Link> : null}
      </div>
    </div>
  );
}

export function Th({ children, align = "left", className = "" }: { children?: ReactNode; align?: "left" | "right"; className?: string }) {
  return <th className={`whitespace-nowrap px-3 py-2.5 font-label text-[10.5px] font-medium uppercase tracking-[0.12em] text-ink/45 first:pl-4 last:pr-4 sm:first:pl-5 sm:last:pr-5 ${align === "right" ? "text-right" : "text-left"} ${className}`} scope="col">{children}</th>;
}

export function Td({ children, align = "left", className = "" }: { children?: ReactNode; align?: "left" | "right"; className?: string }) {
  return <td className={`px-3 py-3 align-middle text-[13px] first:pl-4 last:pr-4 sm:first:pl-5 sm:last:pr-5 ${align === "right" ? "text-right tabular-nums" : ""} ${className}`}>{children}</td>;
}

export function Table({ children, minWidth = 720 }: { children: ReactNode; minWidth?: number }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse" style={{ minWidth }}>{children}</table>
    </div>
  );
}

export function Initial({ name, large = false }: { name: string | null | undefined; large?: boolean }) {
  const letter = (name ?? "?").trim().charAt(0).toUpperCase() || "?";
  return <span aria-hidden="true" className={`grid shrink-0 place-items-center rounded-full bg-ink/[0.06] font-semibold text-ink/70 ${large ? "size-12 text-[18px]" : "size-8 text-[12.5px]"}`}>{letter}</span>;
}

export function Notice({ tone = "neutral", children }: { tone?: "neutral" | "warn"; children: ReactNode }) {
  return (
    <p className={`rounded-[12px] px-4 py-3 text-[12.5px] leading-[18px] ${tone === "warn" ? "bg-[#fff3d6] text-[#5c3f00]" : "bg-ink/[0.04] text-ink/65"}`}>
      {children}
    </p>
  );
}
