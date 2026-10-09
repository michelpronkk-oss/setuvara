"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { CharacterAvatar } from "@/components/avatar/character-avatar";
import { createClient } from "@/lib/supabase/client";
import { isAllowedUsername, isReservedUsername, normalizeUsername } from "@/lib/usernames";

import { AuthHeading, AuthLayout, fieldClass, Spinner } from "./auth-layout";
import { PasswordInput } from "./password-input";

type HandleStatus = "empty" | "short" | "invalid" | "checking" | "taken" | "ok" | "error";

const headlines = ["Claim your name.", "Make it yours.", "One last check."];

const handleMessages: Record<HandleStatus, string> = {
  empty: "Lowercase letters, numbers and underscores.",
  short: "At least 3 characters.",
  invalid: "Use 3–24 lowercase letters, numbers or underscores.",
  checking: "Checking…",
  taken: "Already taken. Try one of these:",
  ok: "Available. It’s yours if you want it.",
  error: "We couldn’t check that right now.",
};

function cleanHandle(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 24);
}

// Resolves true/false for availability, or null if Supabase is unreachable or
// unconfigured. Never throws and never hangs, so the UI can always settle.
async function checkAvailability(candidate: string): Promise<boolean | null> {
  try {
    const request = createClient().rpc("is_username_available", { candidate_username: candidate });
    const timeout = new Promise<null>((resolve) => window.setTimeout(() => resolve(null), 8000));
    const result = await Promise.race([request, timeout]);
    if (!result || result.error) return null;
    return Boolean(result.data);
  } catch {
    return null;
  }
}

function suggestionsFor(handle: string) {
  return [`${handle}_`, `the${handle}`, `${handle}26`, `${handle}_hq`].map(cleanHandle).filter((value) => isAllowedUsername(value) && value !== handle).slice(0, 4);
}

export function SignupFlow({ initialHandle, claimGuest }: { initialHandle: string; claimGuest: boolean }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [handle, setHandle] = useState(cleanHandle(initialHandle));
  const [attempt, setAttempt] = useState(0);
  const [remote, setRemote] = useState<{ candidate: string; result: "ok" | "taken" | "error" } | null>(null);
  const [suggested, setSuggested] = useState<{ candidate: string; list: string[] } | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [notice, setNotice] = useState("");
  const headingRef = useRef<HTMLDivElement>(null);

  // Format checks are derived; availability comes from the real Setuvara username RPC.
  const candidate = normalizeUsername(handle);
  const localStatus: HandleStatus | null = !candidate ? "empty"
    : candidate.length < 3 ? "short"
      : !isAllowedUsername(candidate) ? (isReservedUsername(candidate) ? "taken" : "invalid")
        : null;
  const status: HandleStatus = localStatus ?? (remote?.candidate === candidate ? remote.result : "checking");
  const suggestions = status === "taken" && suggested?.candidate === candidate ? suggested.list : [];

  useEffect(() => {
    if (step !== 0 || localStatus) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      const available = await checkAvailability(candidate);
      if (!cancelled) setRemote({ candidate, result: available === null ? "error" : available ? "ok" : "taken" });
    }, 350);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [candidate, localStatus, step, attempt]);

  useEffect(() => {
    if (status !== "taken") return;
    let cancelled = false;
    (async () => {
      const checks = await Promise.all(suggestionsFor(candidate).map(async (option) => ((await checkAvailability(option)) ? option : null)));
      if (!cancelled) setSuggested({ candidate, list: checks.filter((value): value is string => Boolean(value)).slice(0, 3) });
    })();
    return () => { cancelled = true; };
  }, [status, candidate]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  // Move focus to each new step's heading (not on first load, where the handle input autofocuses).
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    headingRef.current?.querySelector<HTMLElement>("[tabindex='-1']")?.focus();
  }, [step]);

  function submitHandle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "ok") { setError(""); setStep(1); }
  }

  async function submitAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const displayName = name.trim();
    if (!displayName || displayName.length > 80) return setError("Add your name. It leads every Mode.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError("That email doesn’t look right.");
    if (password.length < 8) return setError("Your password needs at least 8 characters.");

    setBusy(true);
    try {
      const supabase = createClient();
      const username = normalizeUsername(handle);
      const { data: available, error: availabilityError } = await supabase.rpc("is_username_available", { candidate_username: username });
      if (availabilityError) return setError("Username availability is temporarily unavailable. Try again shortly.");
      if (!available) {
        setRemote({ candidate: username, result: "taken" });
        setStep(0);
        return;
      }

      const confirmationUrl = new URL("/auth/confirm", window.location.origin);
      confirmationUrl.searchParams.set("next", "/app/identity");
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { username, display_name: displayName }, emailRedirectTo: confirmationUrl.toString() },
      });
      if (signUpError) return setError("We couldn’t create the account. Check your details and try again.");

      if (data.session) {
        router.replace("/app/identity");
        router.refresh();
        return;
      }
      setStep(2);
      setCooldown(30);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    if (cooldown > 0) return;
    setNotice("");
    const confirmationUrl = new URL("/auth/confirm", window.location.origin);
    confirmationUrl.searchParams.set("next", "/app/identity");
    let failed = true;
    try {
      const { error: resendError } = await createClient().auth.resend({ type: "signup", email: email.trim(), options: { emailRedirectTo: confirmationUrl.toString() } });
      failed = Boolean(resendError);
    } catch {
      failed = true;
    }
    setNotice(failed ? "We couldn’t resend just yet. Try again in a moment." : "Sent again. Check your inbox.");
    setCooldown(30);
  }

  const preview = handle || "yourname";
  const blocked = status !== "ok";
  const ring = status === "taken" || status === "invalid" ? "shadow-[inset_0_0_0_1.5px_#d9372c]" : status === "ok" ? "shadow-[inset_0_0_0_1.5px_#0d0d0d]" : "shadow-[inset_0_0_0_1px_rgba(13,13,13,.15)]";
  const dot = status === "ok" ? "bg-lime shadow-[0_0_0_1px_rgba(13,13,13,.2)]" : status === "taken" || status === "invalid" ? "bg-coral" : status === "checking" ? "animate-pulse bg-ink/25" : "bg-ink/10";

  return (
    <AuthLayout
      aside={<SignupPreview handle={preview} headline={headlines[step]} name={name.trim()} />}
      switchCta="Log in"
      switchHref="/login"
      switchLead="Already have a Setuvara?"
    >
      <div className="flex items-center gap-1.5">
        {[0, 1, 2].map((bar) => <span className={`h-[3px] flex-1 rounded-full transition-colors duration-300 ${bar <= step ? "bg-ink" : "bg-ink/10"}`} key={bar} />)}
        <span className="ml-2.5 shrink-0 font-label text-[11px] uppercase tracking-[0.12em] text-ink/60">Step {step + 1} / 3</span>
      </div>

      {claimGuest && step < 2 ? <p className="rounded-2xl bg-white px-4 py-3 text-[14px] leading-6 shadow-[inset_0_0_0_1px_rgba(13,13,13,.08)]">Use the same email you connected with. Your connection will be waiting for you.</p> : null}

      {step === 0 ? (
        <form className="flex flex-col gap-6" noValidate onSubmit={submitHandle}>
          <div ref={headingRef}><AuthHeading title={<span className="outline-none" tabIndex={-1}>Pick your handle.</span>}>This is the link people tap, scan and remember.</AuthHeading></div>
          <div className="flex flex-col gap-2.5">
            <label className={`flex h-[62px] items-center gap-0.5 rounded-[18px] bg-white px-[18px] transition-shadow duration-200 focus-within:shadow-[inset_0_0_0_2px_#0d0d0d] ${ring}`}>
              <span aria-hidden="true" className="shrink-0 font-label text-[16px] text-ink/50">setuvara.com/</span>
              <input
                aria-describedby="handle-message"
                aria-label="Username"
                autoCapitalize="none"
                autoComplete="username"
                autoFocus
                className="w-full min-w-0 flex-1 bg-transparent font-label text-[16px] font-medium outline-none placeholder:text-ink/35"
                maxLength={24}
                onChange={(event) => setHandle(cleanHandle(event.target.value))}
                placeholder="yourname"
                spellCheck={false}
                value={handle}
              />
              <span aria-hidden="true" className={`size-2.5 shrink-0 rounded-full transition-colors duration-200 ${dot}`} />
            </label>
            <p aria-live="polite" className={`min-h-5 text-[14px] ${status === "taken" || status === "invalid" || status === "error" ? "text-[#c22f25]" : "text-ink/65"}`} id="handle-message">{handleMessages[status]}{status === "error" ? <> <button className="font-semibold text-ink underline underline-offset-4" onClick={() => { setRemote(null); setAttempt((value) => value + 1); }} type="button">Try again</button></> : null}</p>
            {suggestions.length ? (
              <div className="flex flex-wrap gap-2">
                {suggestions.map((suggestion) => (
                  <button className="min-h-9 rounded-full bg-white px-3 font-label text-[13px] shadow-[inset_0_0_0_1px_rgba(13,13,13,.15)] hover:shadow-[inset_0_0_0_1.5px_#0d0d0d] focus-visible:outline-2 focus-visible:outline-coral" key={suggestion} onClick={() => setHandle(suggestion)} type="button">{suggestion}</button>
                ))}
              </div>
            ) : null}
          </div>
          <button className={`h-[60px] truncate rounded-full px-6 text-[17px] font-semibold transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${blocked ? "cursor-not-allowed bg-ink/10 text-ink/45" : "bg-coral text-ink hover:bg-[#f34c42]"}`} disabled={blocked} type="submit">
            Claim @{preview}
          </button>
        </form>
      ) : null}

      {step === 1 ? (
        <form className="flex flex-col gap-6" noValidate onSubmit={submitAccount}>
          <div ref={headingRef}>
            <AuthHeading title={<span className="outline-none" tabIndex={-1}>It’s yours. Now secure it.</span>}>
              Create your account to claim setuvara.com/<b className="font-semibold text-ink">{handle}</b>.{" "}
              <button className="font-semibold text-ink underline underline-offset-4" onClick={() => setStep(0)} type="button">Change</button>
            </AuthHeading>
          </div>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-[14px] font-semibold" htmlFor="signup-name">Your name</label>
              <input autoComplete="name" className={fieldClass} id="signup-name" maxLength={80} onChange={(event) => setName(event.target.value)} placeholder="Aanya Rao" required value={name} />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[14px] font-semibold" htmlFor="signup-email">Email</label>
              <input autoComplete="email" className={fieldClass} id="signup-email" onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required type="email" value={email} />
            </div>
            <PasswordInput autoComplete="new-password" id="signup-password" label="Password" meter onChange={setPassword} placeholder="At least 8 characters" value={password} />
          </div>
          {error ? <p aria-live="assertive" className="text-[14px] text-[#c22f25]" role="alert">{error}</p> : null}
          <button className="flex h-[60px] items-center justify-center gap-2.5 rounded-full bg-ink text-[17px] font-semibold text-paper transition-colors hover:bg-[#262626] disabled:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral" disabled={busy} type="submit">
            {busy ? <Spinner /> : null}{busy ? "Creating…" : "Create my Setuvara"}
          </button>
          <p className="text-[13px] leading-[1.5] text-ink/60">Your private notes and Passport are only ever visible to you.</p>
        </form>
      ) : null}

      {step === 2 ? (
        <div className="flex flex-col gap-6">
          <div ref={headingRef}>
            <AuthHeading title={<span className="outline-none" tabIndex={-1}>Check your inbox.</span>}>
              Check your email to confirm your account. We sent a link to <b className="font-semibold text-ink">{email.trim()}</b>. Open it to finish claiming setuvara.com/<b className="font-semibold text-ink">{handle}</b>.
            </AuthHeading>
          </div>
          <div className="flex items-center gap-4 rounded-[22px] bg-white p-5 shadow-[inset_0_0_0_1px_rgba(13,13,13,.08)]">
            <span aria-hidden="true" className="grid size-12 shrink-0 place-items-center rounded-2xl bg-coral">
              <svg className="size-6" fill="none" viewBox="0 0 24 24"><rect height="14" rx="2.5" stroke="#0d0d0d" strokeWidth="1.8" width="18" x="3" y="5" /><path d="m4 7 8 6 8-6" stroke="#0d0d0d" strokeLinejoin="round" strokeWidth="1.8" /></svg>
            </span>
            <p className="text-[14px] leading-[1.5] text-ink/70">The link signs you in and opens your identity editor. It can take a minute to arrive.</p>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 text-[14px]">
            <span aria-live="polite" className="text-ink/65">{notice || "Didn’t get it? Check spam, or resend."}</span>
            <button className="min-h-11 font-semibold underline underline-offset-4 disabled:text-ink/45 disabled:no-underline" disabled={cooldown > 0} onClick={resend} type="button">{cooldown > 0 ? `Resend in ${cooldown}s` : "Resend link"}</button>
          </div>
          <button className="min-h-11 self-start text-[14px] text-ink/65 hover:text-ink" onClick={() => { setStep(1); setNotice(""); }} type="button">← Use a different email</button>
        </div>
      ) : null}
    </AuthLayout>
  );
}

function SignupPreview({ headline, name, handle }: { headline: string; name: string; handle: string }) {
  return (
    <>
      <h2 className="text-balance font-display text-[clamp(48px,5.6vw,92px)] font-extrabold leading-[0.86] tracking-[-0.06em]">{headline}</h2>
      <div aria-hidden="true" className="flex max-w-[380px] flex-col gap-5 rounded-[26px] bg-paper p-6 text-ink [clip-path:polygon(0_0,calc(100%-46px)_0,100%_80px,100%_100%,0_100%)]">
        <div className="flex items-center gap-3.5">
          <CharacterAvatar className="size-[58px] shrink-0 rounded-full" seed={handle} />
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className={`font-display text-[24px] font-bold leading-[1.05] tracking-[-0.035em] ${name ? "" : "text-ink/35"}`}>{name || "Your name"}</span>
            <span className="truncate font-label text-[13px] text-ink/65">setuvara.com/<span className="font-medium text-ink">{handle}</span></span>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5 font-label text-[11px] uppercase tracking-[0.12em]">
          <span className="rounded-full bg-ink px-3 py-1.5 text-paper">Personal</span>
          <span className="rounded-full px-3 py-1.5 shadow-[inset_0_0_0_1px_rgba(13,13,13,.2)]">Event</span>
          <span className="rounded-full px-3 py-1.5 shadow-[inset_0_0_0_1px_rgba(13,13,13,.2)]">Business</span>
        </div>
        <p className="border-t border-ink/10 pt-4 text-[14px] text-ink/65">One identity. Every Mode lives here.</p>
      </div>
    </>
  );
}
