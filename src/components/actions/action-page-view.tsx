import Link from "next/link";
import type { ReactNode } from "react";

import { actionWindow, ACTION_KIND_NAME, type PublicAction } from "@/lib/actions/model";
import { actionThemeVars, type ActionTheme } from "@/lib/actions/theme";
import { shortDate } from "./action-card";

function fullDate(iso: string) {
  return new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC", timeZoneName: "short" });
}

/**
 * One Action's page, in its Mode's Appearance: the page's base and ink, a wash of the Mode's own photo,
 * the title in the name's typeface, the terms, then whatever goes below (the form, or a closed note).
 * The public page and the editor's phone preview both draw it, so the preview is the page.
 */
export function ActionPageView({ action, theme, name, photoUrl, coverUrl, backHref, children, contained = false }: {
  action: PublicAction;
  theme: ActionTheme;
  name: string;
  photoUrl: string | null;
  coverUrl: string | null;
  backHref?: string;
  children: ReactNode;
  /** Inside the editor's phone: fills the frame instead of the window. */
  contained?: boolean;
}) {
  const back = <span aria-hidden="true" className="text-[22px] leading-none">←</span>;
  return (
    <div className={`relative isolate font-brand ${contained ? "min-h-full" : "min-h-dvh"}`} data-action-page={action.kind} style={actionThemeVars(theme)}>
      {/* The Mode's photo as a soft wash behind the top of the page, never a second portrait. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] overflow-hidden">
        {photoUrl
          // eslint-disable-next-line @next/next/no-img-element -- decorative wash of the Mode's own public photo
          ? <img alt="" className="absolute -inset-[12%] size-[124%] max-w-none object-cover" src={photoUrl} style={{ filter: `blur(48px) saturate(1.3) brightness(${theme.light ? 1.1 : 0.6})`, opacity: theme.light ? 0.55 : 0.75 }} />
          : <div className="absolute inset-0" style={{ background: `radial-gradient(90% 70% at 50% 0%, color-mix(in srgb, ${theme.accent} 45%, transparent), transparent)` }} />}
        <div className="absolute inset-0" style={{ background: `linear-gradient(180deg, color-mix(in srgb, ${theme.bg} 20%, transparent), ${theme.bg} 92%)` }} />
      </div>
      <div className={`mx-auto flex w-full max-w-[600px] flex-col px-5 pb-[calc(24px+env(safe-area-inset-bottom))] ${contained ? "min-h-full pt-12" : "min-h-dvh pt-[calc(16px+env(safe-area-inset-top))]"}`}>
        <header className="grid grid-cols-[44px_1fr_44px] items-center">
          {backHref
            ? <Link aria-label={`Back to ${name}`} className="grid size-11 place-items-center rounded-full transition hover:bg-[var(--av-line)] focus-visible:outline-2" href={backHref}>{back}</Link>
            : <span className="grid size-11 place-items-center opacity-80">{back}</span>}
          <p className="truncate text-center text-[16px] font-semibold">{name}</p>
        </header>
        {coverUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- public profile media
          <img alt="" className="mt-5 aspect-[16/9] w-full object-cover shadow-[0_24px_60px_-30px_rgba(0,0,0,.6)]" src={coverUrl} style={{ borderRadius: Math.min(theme.radius, 24) }} />
        )}
        <p className="mt-7 flex items-center gap-2 font-label text-[11px] uppercase tracking-[0.18em] text-[var(--av-muted)]"><span aria-hidden="true" className="size-1.5 rounded-full" style={{ background: theme.accent }} />{ACTION_KIND_NAME[action.kind]}</p>
        <h1 className="mt-3 text-balance text-[42px] md:text-[52px]" style={{ ...theme.heading, lineHeight: 0.95 }}>{action.title}</h1>
        {action.intro && <p className="mt-4 whitespace-pre-line text-[16px] leading-[1.55] text-[var(--av-muted)]">{action.intro}</p>}
        <Terms action={action} />
        {children}
      </div>
    </div>
  );
}

/** Not open: closed, or opening later. */
export type GiveawayAnnouncement = { names: string[]; eligible_count: number; drawn_at: string };

export function ActionClosed({ action, backHref, name, winners = null }: { action: PublicAction; backHref?: string; name: string; /** An announced giveaway draw. */ winners?: GiveawayAnnouncement | null }) {
  const when = actionWindow(action);
  return (
    <div className="mt-8 rounded-[22px] bg-[var(--av-panel)] p-6 shadow-[inset_0_0_0_1px_var(--av-line)]" data-closed={winners ? "announced" : when}>
      {winners ? (
        <>
          <p className="font-label text-[11px] uppercase tracking-[0.18em]" style={{ color: "var(--av-accent)" }}>{winners.names.length === 1 ? "The winner" : "The winners"}</p>
          <ul className="mt-3 flex flex-col gap-1.5">{winners.names.map((winner, index) => <li className="text-[26px] font-bold leading-tight tracking-[-0.03em]" key={`${winner}-${index}`}>{winner}</li>)}</ul>
          <p className="mt-3 text-[14px] text-[var(--av-muted)]">Drawn {shortDate(winners.drawn_at)} at random from {winners.eligible_count} confirmed {winners.eligible_count === 1 ? "entry" : "entries"}. Thanks to everyone who entered.</p>
        </>
      ) : <p className="text-[17px] font-semibold">{when === "ended" ? "This has closed." : `This opens ${action.starts_at ? shortDate(action.starts_at) : "soon"}.`}</p>}
      {backHref && <Link className="mt-4 inline-flex min-h-11 items-center rounded-full px-[18px] text-[15px] font-semibold" href={backHref} style={{ background: "var(--av-btn-bg)", color: "var(--av-btn-fg)", boxShadow: "var(--av-btn-ring)" }}>Back to {name}</Link>}
    </div>
  );
}

function Terms({ action }: { action: PublicAction }) {
  const { config } = action;
  if (action.kind === "newsletter" && (config.promise || config.frequency || config.sender)) {
    const facts = [["You get", config.promise], ["How often", config.frequency], ["From", config.sender]].filter((row): row is [string, string] => Boolean(row[1]));
    return (
      <dl className="mt-6 grid gap-3 border-y border-[var(--av-line)] py-4 sm:grid-cols-2">
        {facts.map(([key, value]) => <div key={key}><dt className="font-label text-[10.5px] uppercase tracking-[0.16em] text-[var(--av-muted)]">{key}</dt><dd className="mt-1 text-[15px] font-semibold">{value}</dd></div>)}
      </dl>
    );
  }
  if (action.kind === "booking" && (config.details || config.priceNote)) {
    return (
      <div className="mt-5 flex flex-col gap-2 border-y border-[var(--av-line)] py-4">
        {config.details && <p className="whitespace-pre-line text-[15px] leading-[1.55]">{config.details}</p>}
        {config.priceNote && <p className="text-[15px] font-semibold">{config.priceNote}</p>}
      </div>
    );
  }
  if (action.kind !== "giveaway") return null;
  const facts = [
    ["Prize", config.prize],
    ["Ends", action.ends_at ? fullDate(action.ends_at) : null],
    ["Who can enter", [config.minAge ? `${config.minAge}+` : null, config.eligibility].filter(Boolean).join(" · ") || null],
    ["Run by", config.sponsor],
  ].filter((row): row is [string, string] => Boolean(row[1]));
  return (
    <div className="mt-5">
      <dl className="grid gap-3 border-y border-[var(--av-line)] py-4 sm:grid-cols-2">
        {facts.map(([key, value]) => <div key={key}><dt className="font-label text-[10.5px] uppercase tracking-[0.16em] text-[var(--av-muted)]">{key}</dt><dd className="mt-1 text-[15px] font-semibold">{value}</dd></div>)}
      </dl>
      <details className="mt-3 rounded-[18px] bg-[var(--av-panel)] p-4 shadow-[inset_0_0_0_1px_var(--av-line)] open:pb-5">
        <summary className="cursor-pointer text-[15px] font-semibold">Official rules</summary>
        <p className="mt-3 whitespace-pre-line text-[14px] leading-[1.6] text-[var(--av-muted)]">{config.rules || "No purchase necessary. One entry per person, confirmed by email. After the end date the winner is drawn at random from confirmed entries and contacted by email."}</p>
        <p className="mt-3 text-[13px] text-[var(--av-muted)]">Setuvara hosts this page and is not the sponsor of this giveaway.</p>
      </details>
    </div>
  );
}
