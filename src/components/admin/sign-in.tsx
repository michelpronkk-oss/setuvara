"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";

import { MeetMark } from "@/components/marketing/brand";
import { createClient } from "@/lib/supabase/client";

type Step = "signed_out" | "no_access" | "mfa_enroll" | "mfa_verify";

const field = "h-11 w-full rounded-[10px] bg-white px-3.5 text-[14px] shadow-[inset_0_0_0_1px_rgba(13,13,13,.14)] outline-none transition-shadow placeholder:text-ink/35 focus:shadow-[inset_0_0_0_2px_#0d0d0d]";
const primary = "flex h-11 w-full items-center justify-center rounded-[10px] bg-ink text-[14px] font-semibold text-paper transition-opacity hover:opacity-90 disabled:cursor-wait disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";
const quiet = "text-[12.5px] font-semibold text-ink/55 underline-offset-4 hover:text-ink hover:underline";

function Frame({ step, title, lead, children }: { step?: string; title: string; lead: ReactNode; children: ReactNode }) {
  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-[380px]">
        <div className="flex items-center gap-2.5">
          <MeetMark className="size-7 text-ink" />
          <span className="text-[16px] font-semibold tracking-[-0.02em]">Setuvara</span>
          <span className="rounded-md bg-ink px-1.5 py-0.5 font-label text-[9.5px] font-medium uppercase tracking-[0.14em] text-paper">Admin</span>
        </div>
        <section className="mt-6 rounded-[16px] bg-white p-6 shadow-[0_0_0_1px_rgba(13,13,13,.07),0_12px_40px_-18px_rgba(13,13,13,.25)]">
          {step ? <p className="font-label text-[10.5px] uppercase tracking-[0.14em] text-ink/45">{step}</p> : null}
          <h1 className="mt-1.5 font-display text-[24px] font-bold leading-tight tracking-[-0.04em]">{title}</h1>
          <p className="mt-1.5 text-[13px] leading-5 text-ink/60">{lead}</p>
          <div className="mt-5">{children}</div>
        </section>
        <p className="mt-4 text-center text-[11.5px] leading-4 text-ink/45">Internal tool. Every sign-in and action is recorded.</p>
      </div>
    </main>
  );
}

function ErrorLine({ message }: { message: string }) {
  return message ? <p aria-live="assertive" className="mt-3 text-[13px] text-[#b3261e]" role="alert">{message}</p> : null;
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
        <label className="flex flex-col gap-1.5 text-[12.5px] font-semibold">Email
          <input autoComplete="email" autoFocus className={field} onChange={(event) => setEmail(event.target.value)} type="email" value={email} />
        </label>
        <label className="flex flex-col gap-1.5 text-[12.5px] font-semibold">Password
          <input autoComplete="current-password" className={field} onChange={(event) => setPassword(event.target.value)} type="password" value={password} />
        </label>
        <ErrorLine message={error} />
        <button className={`${primary} mt-1`} disabled={busy} type="submit">{busy ? "Checking…" : "Continue"}</button>
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
        <div className="grid place-items-center rounded-[12px] bg-[#f6f5f1] p-4">
          {factor ? (
            // eslint-disable-next-line @next/next/no-img-element -- Supabase returns the QR as an SVG data URL.
            <img alt="Authenticator QR code" className="size-[168px]" height={168} src={factor.qr} width={168} />
          ) : <div aria-label="Preparing QR code" className="size-[168px] animate-pulse rounded-lg bg-ink/[0.06]" role="status" />}
        </div>
        {factor ? (
          <details className="text-[12px] text-ink/60">
            <summary className="cursor-pointer font-semibold">Can’t scan? Enter the key</summary>
            <code className="mt-2 block break-all rounded-md bg-ink/[0.04] px-2 py-1.5 font-label text-[12px] text-ink" data-testid="totp-secret">{factor.secret}</code>
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
