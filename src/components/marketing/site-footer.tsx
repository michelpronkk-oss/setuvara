import Link from "next/link";
import { siInstagram } from "simple-icons";

import { CookieSettingsButton } from "@/components/consent/cookie-consent";

import { MeetMark } from "./brand";
import { getMessages } from "@/lib/i18n/messages";

export function SiteFooter() {
  const copy = getMessages("en").marketing;
  const home = "/";
  const columns = [
    { title: copy.product, links: [
      { href: "/modes", label: copy.modes },
      { href: `${home}#share`, label: copy.shareConnect },
      { href: `${home}#connections`, label: copy.connections },
      { href: `${home}#passport`, label: copy.passport },
      { href: "/roadmap", label: copy.roadmap },
    ] },
    { title: copy.setuvaraFor, links: [
      { href: "/events", label: copy.events },
      { href: "/teams", label: copy.teams },
      { href: "/pricing", label: copy.pricing },
    ] },
    { title: copy.account, links: [
      { href: "/signup", label: copy.getSetuvara },
      { href: "/login", label: copy.login },
    ] },
  ];
  return (
    <footer className="overflow-hidden bg-ink text-paper">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-14 px-5 pb-8 pt-16 sm:px-8 sm:pt-20 lg:px-14 lg:pt-24">
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div className="col-span-2 flex flex-col gap-4 lg:col-span-1">
            <MeetMark className="size-14 text-coral" />
            <p className="max-w-60 text-[15px] leading-6 text-paper/70">{copy.yourIdentity}</p>
            <a aria-label="Setuvara on Instagram (@setuvara.app)" className="mt-1 inline-flex min-h-11 items-center gap-2.5 self-start rounded-full bg-paper/[0.07] py-1.5 pl-1.5 pr-4 text-[14px] text-paper/85 transition-colors hover:bg-paper/[0.12] hover:text-paper focus-visible:outline-2 focus-visible:outline-coral" href="https://instagram.com/setuvara.app" rel="noopener noreferrer" target="_blank">
              <span className="grid size-8 place-items-center rounded-full bg-paper text-ink"><svg aria-hidden="true" className="size-4" fill="currentColor" viewBox="0 0 24 24"><path d={siInstagram.path} /></svg></span>
              @setuvara.app
            </a>
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
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
            <p>© {new Date().getFullYear()} Setuvara</p>
            <Link className="min-h-11 content-center transition-colors hover:text-coral focus-visible:outline-2 focus-visible:outline-coral" href="/privacy">Privacy</Link>
            <Link className="min-h-11 content-center transition-colors hover:text-coral focus-visible:outline-2 focus-visible:outline-coral" href="/terms">Terms</Link>
            <Link className="min-h-11 content-center transition-colors hover:text-coral focus-visible:outline-2 focus-visible:outline-coral" href="/refunds">Refunds</Link>
            <Link className="min-h-11 content-center transition-colors hover:text-coral focus-visible:outline-2 focus-visible:outline-coral" href="/cookies">Cookies</Link>
            <CookieSettingsButton className="min-h-11 content-center transition-colors hover:text-coral focus-visible:outline-2 focus-visible:outline-coral" />
          </div>
          <p className="font-label text-[11px] uppercase tracking-[0.16em]">{copy.meetOnce}</p>
        </div>
      </div>
    </footer>
  );
}
