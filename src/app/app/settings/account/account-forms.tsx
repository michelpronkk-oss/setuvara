"use client";

import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent } from "react";

import { fieldClass } from "@/components/auth/auth-layout";
import { PasswordInput } from "@/components/auth/password-input";
import { createClient } from "@/lib/supabase/client";

const card = "mt-5 rounded-[22px] bg-white px-5 py-5 shadow-[inset_0_0_0_1px_rgba(13,13,13,.1)] sm:px-6";
const primary = "inline-flex min-h-12 w-full items-center justify-center rounded-full bg-[#0d0d0d] px-6 text-[15px] font-semibold text-[#f5f4ef] transition hover:bg-black focus-visible:outline-2 focus-visible:outline-offset-4 disabled:opacity-40 sm:w-auto";
const quiet = "inline-flex min-h-11 items-center rounded-full bg-[#f5f4ef] px-4 text-sm font-semibold hover:bg-[#ecebe4] focus-visible:outline-2 focus-visible:outline-offset-2";
const isEmail = (value: string) => value.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

/** Supabase Auth error codes, as people should read them. */
function authMessage(error: { code?: string; message?: string } | null, fallback: string) {
  switch (error?.code) {
    case "email_exists": return "Another account already uses that email.";
    case "same_password": return "That’s your current password. Pick a new one.";
    case "weak_password": return "Pick a stronger password: 8+ characters, a passphrase works best.";
    case "over_email_send_rate_limit": case "over_request_rate_limit": return "Too many tries. Wait a few minutes and try again.";
    case "email_address_invalid": return "That email doesn’t look right.";
    case "reauthentication_needed": return "Sign out and back in, then try again.";
    default: return fallback;
  }
}

/** Checks the current password by signing in again; a wrong one changes nothing. */
async function checkPassword(email: string, password: string) {
  const { error } = await createClient().auth.signInWithPassword({ email, password });
  if (!error) return null;
  return error.code === "invalid_credentials" || /invalid login/i.test(error.message) ? "That password isn’t right." : authMessage(error, "We couldn’t check your password. Try again.");
}

export function EmailForm({ current, pending }: { current: string; pending: string | null }) {
  const router = useRouter();
  const emailId = useId();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const next = email.trim().toLowerCase();

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!isEmail(next)) return setError("That email doesn’t look right.");
    if (next === current.toLowerCase()) return setError("That’s already your email.");
    setBusy(true);
    const wrong = await checkPassword(current, password);
    if (wrong) { setBusy(false); return setError(wrong); }
    const redirect = new URL("/auth/confirm", window.location.origin);
    redirect.searchParams.set("next", "/app/settings/account");
    const { error: updateError } = await createClient().auth.updateUser({ email: next }, { emailRedirectTo: redirect.toString() });
    setBusy(false);
    if (updateError) return setError(authMessage(updateError, "We couldn’t change your email. Try again."));
    setSent(next);
    setOpen(false);
    setEmail("");
    setPassword("");
    router.refresh();
  }

  const waiting = sent ?? pending;
  return <section aria-labelledby="email-title" className={card} data-account-email>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-[17px] font-semibold tracking-[-0.01em]" id="email-title">Email</h2>
        <p className="mt-1 truncate text-[15px] text-black/70">{current}</p>
      </div>
      {!open && <button className={quiet} onClick={() => { setOpen(true); setSent(null); }} type="button">Change email</button>}
    </div>
    {waiting && !open && <p className="mt-3 rounded-2xl bg-[#f5f4ef] px-4 py-3 text-[14px] leading-5 text-black/70" data-email-pending role="status">
      Open the confirmation link we sent to <b className="font-semibold text-black">{waiting}</b> (and to {current}, if one arrives there too). Until then, sign in with {current}.
    </p>}
    {open && <form className="mt-4 flex flex-col gap-4" noValidate onSubmit={(event) => void submit(event)}>
      <div className="flex min-w-0 flex-col gap-2">
        <label className="text-[14px] font-semibold" htmlFor={emailId}>New email</label>
        <input autoCapitalize="none" autoComplete="email" className={fieldClass} id={emailId} inputMode="email" onChange={(event) => { setEmail(event.target.value); setError(null); }} placeholder="you@example.com" required type="email" value={email} />
      </div>
      <PasswordInput autoComplete="current-password" id="email-current-password" label="Current password" onChange={(value) => { setPassword(value); setError(null); }} placeholder="Your password" value={password} />
      <p className="text-[13.5px] leading-5 text-black/55">We’ll email a confirmation link. Your email only changes once you open it.</p>
      {error && <p className="text-[14px] font-medium text-[#b3261e]" role="alert">{error}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <button className={primary} disabled={busy || !next || !password} type="submit">{busy ? "Sending…" : "Send confirmation link"}</button>
        <button className="text-[14px] font-semibold text-black/60 underline underline-offset-4 hover:text-black" onClick={() => { setOpen(false); setError(null); }} type="button">Cancel</button>
      </div>
    </form>}
  </section>;
}

export function PasswordForm({ email }: { email: string }) {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const clear = () => { setCurrent(""); setNext(""); setRepeat(""); setError(null); };

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (next.length < 8) return setError("Your new password needs at least 8 characters.");
    if (next !== repeat) return setError("The new passwords don’t match.");
    if (next === current) return setError("That’s your current password. Pick a new one.");
    setBusy(true);
    const wrong = await checkPassword(email, current);
    if (wrong) { setBusy(false); return setError(wrong); }
    const { error: updateError } = await createClient().auth.updateUser({ password: next });
    setBusy(false);
    if (updateError) return setError(authMessage(updateError, "We couldn’t change your password. Try again."));
    clear();
    setOpen(false);
    setDone(true);
  }

  return <section aria-labelledby="password-title" className={card} data-account-password>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-[17px] font-semibold tracking-[-0.01em]" id="password-title">Password</h2>
        <p className="mt-1 text-[15px] tracking-[0.2em] text-black/70" aria-label="Password set">••••••••••</p>
      </div>
      {!open && <button className={quiet} onClick={() => { setOpen(true); setDone(false); }} type="button">Change password</button>}
    </div>
    {done && <p className="mt-3 rounded-2xl bg-[#2BB673]/[0.12] px-4 py-3 text-[14px] font-medium text-[#17713f]" data-password-changed role="status">Password changed. Use the new one next time you sign in.</p>}
    {open && <form className="mt-4 flex flex-col gap-4" noValidate onSubmit={(event) => void submit(event)}>
      <PasswordInput autoComplete="current-password" id="password-current" label="Current password" onChange={(value) => { setCurrent(value); setError(null); }} placeholder="Your password" value={current} />
      <PasswordInput autoComplete="new-password" id="password-new" label="New password" meter onChange={(value) => { setNext(value); setError(null); }} placeholder="At least 8 characters" value={next} />
      <PasswordInput autoComplete="new-password" id="password-repeat" invalid={Boolean(repeat) && repeat !== next} label="Repeat new password" onChange={(value) => { setRepeat(value); setError(null); }} placeholder="Type it again" value={repeat} />
      {error && <p className="text-[14px] font-medium text-[#b3261e]" role="alert">{error}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <button className={primary} disabled={busy || !current || !next || !repeat} type="submit">{busy ? "Saving…" : "Change password"}</button>
        <button className="text-[14px] font-semibold text-black/60 underline underline-offset-4 hover:text-black" onClick={() => { clear(); setOpen(false); }} type="button">Cancel</button>
      </div>
    </form>}
  </section>;
}
