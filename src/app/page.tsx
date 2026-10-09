import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen items-center px-6 py-16">
      <section className="mx-auto w-full max-w-5xl">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">Setuvara</p>
        <div className="mt-8 max-w-3xl">
          <h1 className="text-5xl font-semibold tracking-tight text-slate-950 sm:text-7xl">
            Your identity, ready to connect.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600 sm:text-xl">
            One identity that moves with you. Share the right context, meet people in real life, and stay connected.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link className="rounded-xl bg-emerald-800 px-5 py-3 font-semibold text-white hover:bg-emerald-900" href="/signup">
              Create your identity
            </Link>
            <Link className="rounded-xl border border-slate-300 bg-white px-5 py-3 font-semibold text-slate-800 hover:bg-slate-50" href="/login">
              Sign in
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
