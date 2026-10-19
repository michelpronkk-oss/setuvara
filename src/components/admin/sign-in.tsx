"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";

import { MeetMark, Wordmark } from "@/components/marketing/brand";
import { createClient } from "@/lib/supabase/client";

type Step = "signed_out" | "no_access" | "mfa_enroll" | "mfa_verify";

const field = "h-[52px] w-full rounded-full bg-white px-5 text-[15px] shadow-[inset_0_0_0_1.5px_rgba(13,13,13,.2)] outline-none transition-shadow placeholder:text-ink/35 focus:shadow-[inset_0_0_0_2.5px_#0d0d0d]";
const primary = "flex h-[52px] w-full items-center justify-center gap-2 rounded-full bg-ink text-[15px] font-semibold text-paper transition-colors hover:bg-[#262626] disabled:cursor-wait disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral";
const quiet = "mx-auto h-10 rounded-full px-4 text-[13px] font-semibold text-ink/55 underline-offset-4 hover:text-ink hover:underline";

function Frame({ step, title, lead, children }: { step?: string; title: string; lead: ReactNode; children: ReactNode }) {
  return (
    <main className="min-h-dvh lg:grid lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      {/* The ink side carries the brand, like the homepage's dark cards */}
      <section className="relative overflow-hidden bg-ink px-6 pb-10 pt-6 text-paper sm:px-10 lg:flex lg:min-h-dvh lg:flex-col lg:px-14 lg:pb-14 lg:pt-10">
        <MeetMark className="pointer-events-none absolute -bottom-24 -right-20 size-[340px] text-paper/[0.04] sm:size-[520px] lg:-bottom-40 lg:-right-32 lg:size-[720px]" />
        <div className="relative flex items-center gap-2.5">
          <MeetMark className="size-[26px] text-paper" />
          <Wordmark className="text-[22px] leading-none" />
        </div>
        <div className="relative mt-12 lg:mt-auto">
          <p className="font-label text-[10.5px] font-medium uppercase tracking-[0.2em] text-coral sm:text-[11px]">Internal · admin.setuvara.com</p>
          <p className="mt-4 font-display text-[48px] font-extrabold leading-[0.88] tracking-[-0.06em] sm:text-[72px] lg:text-[96px]">Control<br />center<span className="text-coral">.</span></p>
          <p className="mt-5 max-w-sm text-[14px] leading-[21px] text-paper/55 sm:text-[15px]">Members, billing, support and platform health, in one place. Every sign-in and action is recorded.</p>
        </div>
      </section>

      <section className="grid place-items-center px-5 py-10 sm:px-10 lg:min-h-dvh">
        <div className="w-full max-w-[400px]">
          {step ? <p className="font-label text-[10.5px] font-medium uppercase tracking-[0.18em] text-coral">{step}</p> : null}
          <h1 className="mt-3 font-display text-[34px] font-extrabold leading-[0.95] tracking-[-0.055em] sm:text-[42px]">{title}</h1>
          <p className="mt-3 text-[14px] leading-[21px] text-ink/60">{lead}</p>
          <div className="mt-7">{children}</div>
        </div>
      </section>
    </main>
  );
}

function ErrorLine({ message }: { message: string }) {
  return message ? <p aria-live="assertive" className="rounded-full bg-coral/15 px-4 py-2.5 text-[13px] font-medium text-[#b32a1f]" role="alert">{message}</p> : null;
}

function CodeInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <input
      aria-label="Six-digit code"
      autoComplete="one-time-code"
      autoFocus
      className={`${field} text-center font-label text-[20px] tracking-[0.4em]`}
      inputMode="numeric"
      maxLength={6}
      onChange={(event) => onChange(event.target.value.replace(/\D/g, "").slice(0, 6))}
      pattern="[0-9]{6}"
      placeholder="000000"
      value={value}
    />
  );
}

export function AdminSignIn({ step, email }: { step: Step; email: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const finish = useCallback(async () => {
    // Recorded server-side once the session is fully verified.
    await fetch("/api/admin/session", { method: "POST", headers: { accept: "application/json" } }).catch(() => undefined);
    router.replace("/");
    router.refresh();
  }, [router]);

  const signOut = useCallback(async () => {
    await createClient().auth.signOut();
    router.refresh();
  }, [router]);

  if (step === "no_access") {
    return (
      <Frame title="No admin access." lead={<>Signed in as <strong className="font-semibold text-ink">{email}</strong>. This account isn’t on the admin list.</>}>
        <button className={primary} onClick={() => void signOut()} type="button">Use another account</button>
      </Frame>
    );
  }

  if (step === "signed_out") return <PasswordStep busy={busy} error={error} setBusy={setBusy} setError={setError} onDone={() => router.refresh()} />;
  if (step === "mfa_enroll") return <EnrollStep email={email} onDone={finish} onSignOut={signOut} />;
  return <VerifyStep email={email} onDone={finish} onSignOut={signOut} />;
}

function PasswordStep({ busy, error, setBusy, setError, onDone }: {
  busy: boolean; error: string; setBusy: (value: boolean) => void; setError: (value: string) => void; onDone: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!email.trim() || !password) return setError("Enter your email and password.");
    setBusy(true);
    try {
      const { error: signInError } = await createClient().auth.signInWithPassword({ email: email.trim(), password });
      if (signInError) return setError("That email and password don’t match.");
      onDone();
    } catch {
      setError("Sign-in is unavailable right now.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Frame lead="Use your Setuvara account. Admin access is granted per account." step="Step 1 of 2" title="Sign in to Admin">
      <form className="flex flex-col gap-3" noValidate onSubmit={submit}>
        <label className="flex flex-col gap-2 font-label text-[10.5px] font-medium uppercase tracking-[0.14em] text-ink/55"><span className="px-5">Email</span>
          <input autoComplete="email" autoFocus className={field} onChange={(event) => setEmail(event.target.value)} type="email" value={email} />
        </label>
        <label className="flex flex-col gap-2 font-label text-[10.5px] font-medium uppercase tracking-[0.14em] text-ink/55"><span className="px-5">Password</span>
          <input autoComplete="current-password" className={field} onChange={(event) => setPassword(event.target.value)} type="password" value={password} />
        </label>
        <ErrorLine message={error} />
        <button className={`${primary} mt-2`} disabled={busy} type="submit">{busy ? "Checking…" : <>Continue <span aria-hidden="true">→</span></>}</button>
      </form>
    </Frame>
  );
}

function EnrollStep({ email, onDone, onSignOut }: { email: string | null; onDone: () => Promise<void>; onSignOut: () => Promise<void> }) {
  const [factor, setFactor] = useState<{ id: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      // A setup left unfinished earlier blocks a new one with the same name, so clear it first.
      const { data: listed } = await supabase.auth.mfa.listFactors();
      for (const stale of listed?.all ?? []) {
        if (stale.factor_type === "totp" && stale.status !== "verified") await supabase.auth.mfa.unenroll({ factorId: stale.id });
      }
      const { data, error: enrollError } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "Setuvara Admin" });
      if (cancelled) return;
      if (enrollError || !data) return setError("Two-step setup couldn’t start. Reload to try again.");
      setFactor({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
    })().catch(() => { if (!cancelled) setError("Two-step setup couldn’t start. Reload to try again."); });
    return () => { cancelled = true; };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!factor || code.length !== 6) return setError("Enter the six-digit code from your app.");
    setBusy(true);
    setError("");
    const { error: verifyError } = await createClient().auth.mfa.challengeAndVerify({ factorId: factor.id, code });
    if (verifyError) {
      setBusy(false);
      return setError("That code didn’t match. Codes change every 30 seconds.");
    }
    await onDone();
  }

  return (
    <Frame
      lead={<>Admin needs a second step for <strong className="font-semibold text-ink">{email}</strong>. Scan this with an authenticator app (1Password, Google Authenticator, Authy), then enter the code.</>}
      step="Step 2 of 2 · First time"
      title="Set up two-step sign-in"
    >
      <form className="flex flex-col gap-3" noValidate onSubmit={submit}>
        <div className="grid place-items-center rounded-[26px] bg-white p-5 shadow-[0_0_0_1px_rgba(13,13,13,.08)]">
          {factor ? (
            // eslint-disable-next-line @next/next/no-img-element -- Supabase returns the QR as an SVG data URL.
            <img alt="Authenticator QR code" className="size-[168px]" height={168} src={factor.qr} width={168} />
          ) : <div aria-label="Preparing QR code" className="size-[168px] animate-pulse rounded-lg bg-ink/[0.06]" role="status" />}
        </div>
        {factor ? (
          <details className="px-1 text-[12.5px] text-ink/60">
            <summary className="cursor-pointer font-semibold">Can’t scan? Enter the key</summary>
            <code className="mt-2 block break-all rounded-[14px] bg-white px-3 py-2 font-label text-[12px] text-ink shadow-[0_0_0_1px_rgba(13,13,13,.08)]" data-testid="totp-secret">{factor.secret}</code>
          </details>
        ) : null}
        <CodeInput onChange={(value) => { setCode(value); setError(""); }} value={code} />
        <ErrorLine message={error} />
        <button className={primary} disabled={busy || !factor} type="submit">{busy ? "Verifying…" : "Verify and continue"}</button>
        <button className={quiet} onClick={() => void onSignOut()} type="button">Sign out</button>
      </form>
    </Frame>
  );
}

function VerifyStep({ email, onDone, onSignOut }: { email: string | null; onDone: () => Promise<void>; onSignOut: () => Promise<void> }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (code.length !== 6) return setError("Enter the six-digit code from your app.");
    setBusy(true);
    setError("");
    try {
      const supabase = createClient();
      const { data } = await supabase.auth.mfa.listFactors();
      const factor = data?.totp[0];
      if (!factor) throw new Error("no_factor");
      const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
      if (verifyError) {
        setBusy(false);
        return setError("That code didn’t match. Codes change every 30 seconds.");
      }
      await onDone();
    } catch {
      setBusy(false);
      setError("Verification is unavailable right now.");
    }
  }

  return (
    <Frame lead={<>Enter the code from your authenticator app for <strong className="font-semibold text-ink">{email}</strong>.</>} step="Step 2 of 2" title="Two-step sign-in">
      <form className="flex flex-col gap-3" noValidate onSubmit={submit}>
        <CodeInput onChange={(value) => { setCode(value); setError(""); }} value={code} />
        <ErrorLine message={error} />
        <button className={primary} disabled={busy} type="submit">{busy ? "Verifying…" : "Continue"}</button>
        <button className={quiet} onClick={() => void onSignOut()} type="button">Sign out</button>
      </form>
    </Frame>
  );
}
