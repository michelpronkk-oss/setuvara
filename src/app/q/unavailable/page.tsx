import Link from "next/link";

export default function QuickShareUnavailablePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f5f4ef] px-6 text-[#0d0d0d]">
      <section className="w-full max-w-md text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#ff5a4f]">Setuvara Quick Share</p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">This share link isn’t available.</h1>
        <p className="mt-3 text-sm leading-6 text-black/65">The profile or Mode may be unavailable. Ask the owner for an updated link.</p>
        <Link className="mt-7 inline-flex min-h-11 items-center justify-center rounded-full bg-[#0d0d0d] px-6 text-sm font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff5a4f]" href="/">
          Go to Setuvara
        </Link>
      </section>
    </main>
  );
}
