"use client";

import Link from "next/link";
import { useId, useState, type FormEvent } from "react";

import type { Check } from "@/lib/tools/link-check";

type Result = { url: string; score: number; checks: Check[] };

const MARK: Record<Check["status"], { sign: string; tone: string; label: string }> = {
  pass: { sign: "✓", tone: "bg-[#2BB673] text-white", label: "Passed" },
  warn: { sign: "!", tone: "bg-[#FFC94D] text-ink", label: "Could be better" },
  fail: { sign: "×", tone: "bg-coral text-ink", label: "Needs fixing" },
};

/** The free link-in-bio checker: paste a page, get ten plain checks and what to fix. */
export function LinkChecker() {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const inputId = useId();

  async function run(event: FormEvent) {
    event.preventDefault();
    if (!value.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/tools/link-check?url=${encodeURIComponent(value.trim())}`);
      const data = await response.json();
      if (!response.ok) { setResult(null); setError(data.error ?? "That didn’t work. Try again."); return; }
      setResult(data as Result);
    } catch {
      setError("That didn’t work. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  const failing = result?.checks.filter((check) => check.status !== "pass").length ?? 0;

  return (
    <div className="flex flex-col gap-8">
      <form className="flex flex-col gap-3 sm:flex-row" onSubmit={(event) => void run(event)}>
        <label className="sr-only" htmlFor={inputId}>Your link in bio</label>
        <input autoCapitalize="none" autoComplete="url" autoCorrect="off" className="min-h-14 min-w-0 flex-1 rounded-full bg-white px-5 text-[17px] font-medium shadow-[inset_0_0_0_1.5px_rgba(13,13,13,.18)] outline-none placeholder:font-normal placeholder:text-ink/35 focus:shadow-[inset_0_0_0_2px_#0D0D0D]" id={inputId} inputMode="url" maxLength={1000} onChange={(event) => setValue(event.target.value)} placeholder="linktr.ee/yourname" spellCheck={false} value={value} />
        <button className="min-h-14 rounded-full bg-ink px-7 text-[16px] font-semibold text-paper hover:bg-[#262626] disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral" disabled={busy || !value.trim()} type="submit">{busy ? "Checking…" : "Check my link"}</button>
      </form>
      <div aria-live="polite">
        {error && <p className="rounded-[20px] bg-coral/15 px-5 py-4 text-[15px]" role="alert">{error}</p>}
        {result && (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)]">
            <div className="flex flex-col justify-between rounded-[28px] bg-ink p-7 text-paper lg:sticky lg:top-24 lg:self-start">
              <div>
                <p className="font-label text-[11px] uppercase tracking-[0.16em] text-paper/55">Score</p>
                <p className="mt-3 font-display text-[96px] font-extrabold leading-none tracking-[-0.06em]">{result.score}</p>
                <p className="mt-2 break-all font-label text-[12px] text-paper/55">{result.url}</p>
              </div>
              <p className="mt-6 text-[16px] leading-[1.5] text-paper/80">{failing === 0 ? "Every check passes. Nice work." : `${failing} thing${failing === 1 ? "" : "s"} to improve. Each one costs you taps.`}</p>
            </div>
            <ul className="divide-y divide-ink/10 rounded-[28px] bg-white px-5 shadow-[inset_0_0_0_1px_rgba(13,13,13,.08)] sm:px-7">
              {result.checks.map((check) => (
                <li className="flex gap-4 py-4" key={check.id}>
                  <span aria-label={MARK[check.status].label} className={`mt-0.5 grid size-7 shrink-0 place-items-center rounded-full text-[14px] font-bold ${MARK[check.status].tone}`} role="img">{MARK[check.status].sign}</span>
                  <div className="min-w-0"><p className="text-[16px] font-semibold">{check.label}</p><p className="mt-0.5 break-words text-[14px] leading-[1.5] text-ink/65">{check.detail}</p></div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      {result && failing > 0 && (
        <div className="rounded-[24px] bg-white p-6 shadow-[inset_0_0_0_1px_rgba(13,13,13,.08)] sm:p-7">
          <p className="font-display text-[22px] font-bold tracking-[-0.04em]">Or skip the fixing.</p>
          <p className="mt-1.5 text-[15px] leading-[1.5] text-ink/65">Setuvara pages come with a title, a description, a preview image, an icon and a fast mobile page, on every plan. <Link className="font-semibold text-ink underline decoration-ink/25 underline-offset-4 hover:decoration-ink" href="/signup">Make yours free</Link>.</p>
        </div>
      )}
    </div>
  );
}
