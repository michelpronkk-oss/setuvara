"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { CharacterAvatar } from "@/components/avatar/character-avatar";
import { createClient } from "@/lib/supabase/client";

import { AuthHeading, AuthLayout, fieldClass, Spinner } from "./auth-layout";
import { PasswordInput } from "./password-input";

export function LoginForm({ next = "/app", notice }: { next?: string; notice?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!email.trim()) return setError("Enter your email.");
    if (!password) return setError("Enter your password.");
    setBusy(true);
    try {
      const { error: signInError } = await createClient().auth.signInWithPassword({ email: email.trim(), password });
      if (signInError) return setError("That email and password don’t match. Try again.");
      router.replace(next);
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout aside={<LoginAside />} switchCta="Create yours" switchHref="/signup" switchLead="New here?">
      <form className="flex flex-col gap-6" noValidate onSubmit={submit}>
        <AuthHeading title="Log in.">Your identity and connections, right where you left them.</AuthHeading>
        {notice ? <p className="rounded-2xl bg-white px-4 py-3 text-[14px] leading-6 shadow-[inset_0_0_0_1px_rgba(13,13,13,.08)]" role="alert">{notice}</p> : null}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-[14px] font-semibold" htmlFor="login-email">Email</label>
            <input autoComplete="email" autoFocus className={fieldClass} id="login-email" onChange={(event) => { setEmail(event.target.value); setError(""); }} placeholder="you@example.com" required type="email" value={email} />
          </div>
          <PasswordInput autoComplete="current-password" id="login-password" invalid={Boolean(error) && Boolean(password)} label="Password" onChange={(value) => { setPassword(value); setError(""); }} placeholder="Password" value={password} />
        </div>
        {error ? <p aria-live="assertive" className="text-[14px] text-[#c22f25]" role="alert">{error}</p> : null}
        <button className="flex h-[60px] items-center justify-center gap-2.5 rounded-full bg-coral text-[17px] font-semibold text-ink transition-colors hover:bg-[#f34c42] disabled:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink" disabled={busy} type="submit">
          {busy ? <Spinner /> : null}{busy ? "Checking…" : "Log in"}
        </button>
        <p className="text-center text-[14px] text-ink/65">New to Setuvara? <Link className="font-semibold text-ink underline underline-offset-4" href="/signup">Claim your name</Link></p>
      </form>
    </AuthLayout>
  );
}

function LoginAside() {
  return (
    <>
      <h2 className="font-display text-[clamp(48px,5.6vw,92px)] font-extrabold leading-[0.86] tracking-[-0.06em]">Welcome back.</h2>
      <div aria-hidden="true" className="flex max-w-[380px] flex-col gap-3">
        <p className="font-label text-[11px] uppercase tracking-[0.14em] text-paper/55">Inside your Setuvara</p>
        <div className="flex items-center gap-3.5 rounded-[22px] bg-[#1a1a1a] p-5 shadow-[inset_0_0_0_1px_rgba(245,244,239,.08)]">
          <CharacterAvatar className="size-11 shrink-0 rounded-full" seed="Marco Silva" />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-3"><span className="font-display text-[20px] font-bold tracking-[-0.03em]">Marco Silva</span><span className="font-label text-[10px] uppercase tracking-[0.12em] text-coral">Business</span></div>
            <p className="mt-0.5 truncate text-[13px] text-paper/65">You met at TNW Conference · Amsterdam</p>
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 rounded-[22px] bg-[#1a1a1a] p-5 shadow-[inset_0_0_0_1px_rgba(245,244,239,.08)]">
          <span className="text-[14px] text-paper/70">Passport · Signal 50</span>
          <span className="flex items-center gap-2 text-[13px] font-semibold"><span className="size-2 rounded-full bg-coral" />3 to go</span>
        </div>
      </div>
    </>
  );
}
