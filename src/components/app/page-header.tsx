import type { ReactNode } from "react";

/**
 * The one header for the app's own pages (Analytics, Connections, Passport, Settings): a small
 * label, a plain title and an optional line, with actions on the right on wide screens.
 */
export function AppPageHeader({ eyebrow, title, sub, actions, id }: { eyebrow?: ReactNode; title: ReactNode; sub?: ReactNode; actions?: ReactNode; id?: string }) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between sm:gap-6" data-app-page-header>
      <div className="min-w-0">
        {eyebrow && <p className="font-label text-[11px] font-bold uppercase tracking-[0.18em] text-black/50">{eyebrow}</p>}
        <h1 className="mt-2 font-display text-[34px] font-bold leading-none tracking-[-0.045em] outline-none md:text-[44px]" id={id} tabIndex={id ? -1 : undefined}>{title}</h1>
        {sub && <p className="mt-2.5 max-w-xl text-[14.5px] leading-[1.5] text-black/60">{sub}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2.5">{actions}</div>}
    </header>
  );
}
