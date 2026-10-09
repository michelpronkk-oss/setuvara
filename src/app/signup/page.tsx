import Link from "next/link";

import { AuthForm } from "@/components/auth-form";

export default function SignupPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-12">
      <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-7 shadow-sm sm:p-9">
        <Link className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-800" href="/">
          Setuvara
        </Link>
        <h1 className="mt-8 text-3xl font-semibold tracking-tight text-slate-950">Create your identity</h1>
        <p className="mt-2 mb-8 text-slate-600">Start with a name and a username people can find.</p>
        <AuthForm mode="signup" />
      </section>
    </main>
  );
}
