import Link from "next/link";

import { MeetMark } from "./brand";

const columns = [
  {
    title: "Product",
    links: [
      { href: "/#modes", label: "Modes" },
      { href: "/#share", label: "Share & Connect" },
      { href: "/#connections", label: "Connections" },
      { href: "/#passport", label: "Passport" },
    ],
  },
  {
    title: "Setuvara for",
    links: [
      { href: "/events", label: "Events" },
      { href: "/teams", label: "Teams" },
      { href: "/pricing", label: "Pricing" },
    ],
  },
  {
    title: "Account",
    links: [
      { href: "/signup", label: "Get Setuvara" },
      { href: "/login", label: "Log in" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="overflow-hidden bg-ink text-paper">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-14 px-5 pb-8 pt-16 sm:px-8 sm:pt-20 lg:px-14 lg:pt-24">
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div className="col-span-2 flex flex-col gap-4 lg:col-span-1">
            <MeetMark className="size-14 text-coral" />
            <p className="max-w-60 text-[15px] leading-6 text-paper/70">Your identity. Your connections.</p>
          </div>
          <nav aria-label="Footer navigation" className="contents">
            {columns.map((column) => (
              <div className="flex flex-col" key={column.title}>
                <p className="mb-2 font-label text-[11px] uppercase tracking-[0.16em] text-paper/50">{column.title}</p>
                {column.links.map((link) => (
                  <Link className="min-h-11 content-center text-[15px] text-paper/85 transition-colors hover:text-coral focus-visible:outline-2 focus-visible:outline-coral" href={link.href} key={link.href}>
                    {link.label}
                  </Link>
                ))}
              </div>
            ))}
          </nav>
        </div>
        <p aria-hidden="true" className="-mb-2 select-none font-display text-[clamp(84px,21vw,312px)] font-extrabold leading-[0.78] tracking-[-0.065em]">setuvara</p>
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-paper/15 pt-6 text-[13px] text-paper/60">
          <p>© {new Date().getFullYear()} Setuvara</p>
          <p className="font-label text-[11px] uppercase tracking-[0.16em]">Meet once. Stay connected.</p>
        </div>
      </div>
    </footer>
  );
}
