import Link from "next/link";

import { AuthForm } from "@/components/auth-form";

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ claim?: string }> }) {
  const query = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-12">
      <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-7 shadow-sm sm:p-9">
        <Link className="inline-flex min-h-11 items-center text-sm font-semibold uppercase tracking-[0.2em] text-emerald-800" href="/">
          Setuvara
        </Link>
        <h1 className="mt-8 text-3xl font-semibold tracking-tight text-slate-950">Create your identity</h1>
        <p className="mt-2 mb-8 text-slate-600">Start with a name and a username people can find.</p>
        {query.claim === "1" && <p className="mb-6 rounded-2xl bg-[#f5f4ef] px-4 py-3 text-sm leading-6 text-[#0d0d0d]">Create your Setuvara and confirm the same email you used to connect. Your connection will be waiting for you.</p>}
        <AuthForm mode="signup" />
      </section>
    </main>
  );
}
