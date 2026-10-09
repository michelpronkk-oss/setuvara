import Link from "next/link";

import { AuthForm } from "@/components/auth-form";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-12">
      <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-7 shadow-sm sm:p-9">
        <Link className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-800" href="/">
          Setuvara
        </Link>
        <h1 className="mt-8 text-3xl font-semibold tracking-tight text-slate-950">Welcome back</h1>
        <p className="mt-2 mb-8 text-slate-600">Sign in to continue to your identity.</p>
        <AuthForm mode="login" />
      </section>
    </main>
  );
}
