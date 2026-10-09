"use client";

export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="grid min-h-[65vh] place-items-center px-5 py-12 text-[#0d0d0d]">
      <section className="w-full max-w-md rounded-[2rem] border border-black/10 bg-white p-7 sm:p-9">
        <p className="text-[10px] font-bold tracking-[0.2em] text-black/45">A SMALL PAUSE</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.05em]">Your Setuvara is taking a moment.</h1>
        <p className="mt-3 text-sm leading-6 text-black/55">Your saved identity stays safe. Try loading this part again.</p>
        <button className="mt-6 inline-flex min-h-12 items-center rounded-full bg-[#ff5a4f] px-5 text-sm font-semibold focus-visible:outline-2" onClick={reset} type="button">Try again</button>
      </section>
    </div>
  );
}
