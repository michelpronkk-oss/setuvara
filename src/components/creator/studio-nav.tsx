"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { label: "Profile", href: "/app/identity?mode=creator" },
  { label: "Work", href: "/app/identity/creator/work" },
  { label: "Commerce", href: "/app/identity/creator/commerce" },
  { label: "Actions", href: "/app/identity/creator/actions" },
  { label: "Media kit", href: "/app/identity/creator/kit" },
  { label: "Insights", href: "/app/identity/creator/insights" },
  { label: "Settings", href: "/app/identity/creator/settings" },
] as const;

/** The Creator studio row inside Identity. Profile opens the Identity editor on Creator Mode. */
export function StudioNav({ shareUrl, needsYou }: { shareUrl: string | null; needsYou: number }) {
  const pathname = usePathname();
  const display = shareUrl?.replace(/^https?:\/\//, "") ?? null;
  return (
    <div className="flex flex-col gap-3 px-3.5 pt-1 md:flex-row md:items-center md:justify-between md:px-8 md:pt-2">
      <nav aria-label="Creator studio" className="-mx-3.5 flex items-center gap-1 overflow-x-auto px-3.5 [scrollbar-width:none] md:mx-0 md:px-0 [&::-webkit-scrollbar]:hidden">
        <span className="mr-2 hidden shrink-0 items-center gap-2 font-label text-[11px] tracking-[0.16em] text-black/60 lg:flex"><span aria-hidden="true" className="size-[7px] rounded-full bg-[#B79CFF]" />CREATOR STUDIO</span>
        {TABS.map((tab) => {
          const on = tab.href.startsWith("/app/identity/creator") && (pathname === tab.href || pathname.startsWith(`${tab.href}/`));
          return (
            <Link aria-current={on ? "page" : undefined} className={`relative inline-flex min-h-10 shrink-0 items-center rounded-full px-4 text-[15px] font-semibold transition-colors focus-visible:outline-2 ${on ? "bg-[#0D0D0D] text-[#F5F4EF]" : "text-[#0D0D0D] hover:bg-black/[0.05]"}`} href={tab.href} key={tab.label}>
              {tab.label}
              {tab.label === "Actions" && needsYou > 0 && <span className="ml-1.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-[#FF5A4F] px-1 text-[10px] font-bold text-[#0D0D0D]" aria-label={`${needsYou} new`}>{needsYou}</span>}
            </Link>
          );
        })}
      </nav>
      {shareUrl && (
        <div className="hidden shrink-0 items-center gap-3 md:flex">
          <a className="inline-flex min-h-10 items-center gap-1.5 rounded-full px-2 text-[15px] font-semibold hover:text-[#FF5A4F] focus-visible:outline-2" href={shareUrl} rel="noreferrer" target="_blank">{display}<span aria-hidden="true">↗</span></a>
          <Link className="inline-flex min-h-10 items-center rounded-full bg-[#FF5A4F] px-[18px] text-[15px] font-semibold text-[#0D0D0D] hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2" href="/app/identity?mode=creator&section=share">Share page</Link>
        </div>
      )}
    </div>
  );
}
