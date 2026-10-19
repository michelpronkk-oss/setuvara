import Link from "next/link";

export default function AdminNotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <div className="text-center">
        <p className="font-label text-[11px] uppercase tracking-[0.16em] text-ink/45">404</p>
        <h1 className="mt-2 font-display text-[28px] font-bold tracking-[-0.045em]">Nothing here.</h1>
        <Link className="mt-5 inline-flex h-10 items-center rounded-full bg-ink px-5 text-[13px] font-semibold text-paper" href="/">Back to overview</Link>
      </div>
    </main>
  );
}
