import Link from "next/link";

import { AuthForm } from "@/components/auth-form";

type LoginPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const query = await searchParams;
  const authError =
    query.error === "confirmation_failed"
      ? "This confirmation link is invalid or expired. Use the latest confirmation email, or sign in below if your email is already confirmed."
      : query.error === "auth_callback"
        ? "We couldn’t complete that sign-in link. Try opening a fresh link or sign in below."
        : undefined;

  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-12">
      <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-7 shadow-sm sm:p-9">
        <Link className="inline-flex min-h-11 items-center text-sm font-semibold uppercase tracking-[0.2em] text-emerald-800" href="/">
          Setuvara
        </Link>
        <h1 className="mt-8 text-3xl font-semibold tracking-tight text-slate-950">Welcome back</h1>
        <p className="mt-2 mb-8 text-slate-600">Sign in to continue to your identity.</p>
        {authError && (
          <p aria-live="polite" className="mb-6 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900" role="alert">
            {authError}
          </p>
        )}
        <AuthForm mode="login" />
      </section>
    </main>
  );
}
