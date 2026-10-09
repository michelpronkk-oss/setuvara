import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-[#0d0d0d]/15">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-5 py-8 sm:px-8 md:flex-row md:items-center md:justify-between">
        <div>
          <Link className="inline-flex min-h-11 items-center text-sm font-bold lowercase tracking-[0.18em]" href="/">setuvara</Link>
          <p className="mt-1 text-sm text-[#0d0d0d]/60">Your identity. Your connections.</p>
        </div>
        <nav aria-label="Footer navigation" className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-[#0d0d0d]/70">
          <Link className="min-h-11 content-center hover:text-[#0d0d0d]" href="/pricing">Pricing</Link>
          <Link className="min-h-11 content-center hover:text-[#0d0d0d]" href="/events">Events</Link>
          <Link className="min-h-11 content-center hover:text-[#0d0d0d]" href="/teams">Teams</Link>
          <Link className="min-h-11 content-center hover:text-[#0d0d0d]" href="/login">Log in</Link>
        </nav>
        <p className="text-xs text-[#0d0d0d]/50">© {new Date().getFullYear()} Setuvara</p>
      </div>
    </footer>
  );
}
