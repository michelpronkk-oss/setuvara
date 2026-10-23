"use client";

import Link from "next/link";
import { useId, useState, type FormEvent } from "react";

import type { Check } from "@/lib/tools/link-check";

import { MeetMark } from "../brand";

type Result = { url: string; score: number; checks: Check[] };

const MARK: Record<Check["status"], { sign: string; tone: string; label: string }> = {
  pass: { sign: "✓", tone: "bg-[#2BB673] text-white", label: "Passed" },
  warn: { sign: "!", tone: "bg-[#FFC94D] text-ink", label: "Could be better" },
  fail: { sign: "×", tone: "bg-coral text-ink", label: "Needs fixing" },
};

/** What is checked, in the order checkPage() runs them (see lib/tools/link-check.ts). */
const CHECKS = ["Opens for visitors", "Secure link (HTTPS)", "Fast first response", "Page title", "Description", "Preview image", "Made for phones", "Site icon", "Focused number of links", "Light page"];

const GROUPS: { status: Check["status"]; title: string }[] = [
  { status: "fail", title: "Fix first" },
  { status: "warn", title: "Could be better" },
  { status: "pass", title: "Passing" },
];

function grade(score: number) {
  if (score >= 85) return { word: "Strong", color: "#2BB673" };
  if (score >= 60) return { word: "Good, with gaps", color: "#FFC94D" };
  return { word: "Needs work", color: "#FF5A4F" };
}

/** The score as a ring that fills to the score, coloured by grade. */
function ScoreRing({ score }: { score: number }) {
  const { color } = grade(score);
  const r = 54;
  const length = 2 * Math.PI * r;
  return (
    <div className="relative size-[148px] shrink-0">
      <svg aria-hidden="true" className="size-full -rotate-90" viewBox="0 0 128 128">
        <circle cx="64" cy="64" fill="none" r={r} stroke="rgba(245,244,239,.1)" strokeWidth="10" />
        <circle cx="64" cy="64" fill="none" r={r} stroke={color} strokeDasharray={`${(length * score) / 100} ${length}`} strokeLinecap="round" strokeWidth="10" />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <p className="font-display text-[54px] font-extrabold leading-none tracking-[-0.06em]">{score}</p>
          <p className="mt-1 font-label text-[10px] uppercase tracking-[0.16em] text-paper/55">out of 100</p>
        </div>
      </div>
    </div>
  );
}

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

  const count = (status: Check["status"]) => result?.checks.filter((check) => check.status === status).length ?? 0;
  const failing = count("fail") + count("warn");

  return (
    <div className="flex flex-col gap-6">
      <div className="relative isolate overflow-hidden rounded-[32px] bg-ink p-5 text-paper sm:rounded-[40px] sm:p-10 lg:p-14">
        <span aria-hidden="true" className="absolute -right-[10%] -top-[40%] -z-10 size-[60%] rounded-full bg-coral opacity-[.22] blur-[110px]" />
        <span aria-hidden="true" className="absolute -bottom-[50%] -left-[10%] -z-10 size-[60%] rounded-full bg-[#72a7e7] opacity-[.16] blur-[110px]" />
        <p className="font-label text-[11px] uppercase tracking-[0.16em] text-paper/60">Check any link in bio</p>
        <form className="mt-5 flex flex-col gap-3 rounded-[28px] bg-white/[0.06] p-2 shadow-[inset_0_0_0_1px_rgba(255,255,255,.1)] backdrop-blur sm:flex-row sm:rounded-full" onSubmit={(event) => void run(event)}>
          <label className="sr-only" htmlFor={inputId}>Your link in bio</label>
          <div className="flex min-h-14 min-w-0 flex-1 items-center rounded-full bg-paper px-5 text-ink focus-within:shadow-[0_0_0_2px_#FF5A4F]">
            {/^https?:\/\//i.test(value.trim()) ? null : <span aria-hidden="true" className="font-label text-[13px] text-ink/40">https://</span>}
            <input autoCapitalize="none" autoComplete="url" autoCorrect="off" className="min-w-0 flex-1 bg-transparent pl-1.5 text-[17px] font-medium outline-none placeholder:font-normal placeholder:text-ink/35" id={inputId} inputMode="url" maxLength={1000} onChange={(event) => setValue(event.target.value)} placeholder="linktr.ee/yourname" spellCheck={false} value={value} />
          </div>
          <button className="min-h-14 rounded-full bg-coral px-8 text-[16px] font-semibold text-ink transition hover:bg-[#ff6e64] disabled:bg-paper/15 disabled:text-paper/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-paper" disabled={busy || !value.trim()} type="submit">{busy ? "Checking…" : "Check my link"}</button>
        </form>
        <p className="mt-4 flex flex-wrap gap-x-5 gap-y-1 px-2 font-label text-[11px] uppercase tracking-[0.14em] text-paper/50"><span>10 checks</span><span>A few seconds</span><span>Nothing stored</span><span>Any link in bio</span></p>

        <div aria-live="polite">
          {error && <p className="mt-8 rounded-[20px] bg-coral/15 px-5 py-4 text-[15px] text-paper" role="alert">{error}</p>}
          {result ? (
            <div className="mt-10 grid items-center gap-8 border-t border-paper/10 pt-10 sm:grid-cols-[auto_minmax(0,1fr)] sm:gap-10">
              <ScoreRing score={result.score} />
              <div className="min-w-0">
                <p className="font-display text-[clamp(30px,3.4vw,44px)] font-extrabold leading-none tracking-[-0.05em]">{grade(result.score).word}</p>
                <p className="mt-2 break-all font-label text-[12px] text-paper/55">{result.url}</p>
                <p className="mt-4 text-[17px] leading-[1.5] text-paper/80">{failing === 0 ? "Every check passes. Nice work." : `${failing} thing${failing === 1 ? "" : "s"} to improve. Each one costs you taps.`}</p>
                <ul className="mt-5 flex flex-wrap gap-2">
                  {GROUPS.map((group) => (
                    <li className="flex items-center gap-2 rounded-full bg-white/[0.08] px-3.5 py-2 text-[13px] font-semibold shadow-[inset_0_0_0_1px_rgba(255,255,255,.08)]" key={group.status}><span aria-hidden="true" className={`size-2 rounded-full ${MARK[group.status].tone.split(" ")[0]}`} />{count(group.status)} {group.title.toLowerCase()}</li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <ol className={`mt-10 grid grid-cols-2 gap-2 border-t border-paper/10 pt-8 sm:grid-cols-3 lg:grid-cols-5 ${busy ? "[&>li]:animate-pulse" : ""}`}>
              {CHECKS.map((label, index) => (
                <li className="flex items-center gap-3 rounded-[16px] bg-white/[0.05] px-4 py-3.5 text-[14px] font-medium text-paper/85 shadow-[inset_0_0_0_1px_rgba(255,255,255,.06)]" key={label} style={busy ? { animationDelay: `${index * 90}ms` } : undefined}><span className="font-label text-[11px] text-coral">{String(index + 1).padStart(2, "0")}</span>{label}</li>
              ))}
            </ol>
          )}
        </div>
      </div>

      {result && (
        <div className="grid items-start gap-6 lg:grid-cols-3">
          {GROUPS.filter((group) => count(group.status) > 0).map((group) => (
            <section aria-label={group.title} className="flex flex-col rounded-[28px] bg-white p-6 shadow-[0_40px_80px_-60px_rgba(13,13,13,.45),inset_0_0_0_1px_rgba(13,13,13,.05)] sm:p-7" key={group.status}>
              <p className="flex items-center gap-2.5 font-display text-[22px] font-extrabold tracking-[-0.04em]"><span aria-hidden="true" className={`size-2.5 rounded-full ${MARK[group.status].tone.split(" ")[0]}`} />{group.title}<span className="ml-auto font-label text-[12px] font-normal text-ink/45">{count(group.status)}</span></p>
              <ul className="mt-4 divide-y divide-ink/[0.07]">
                {result.checks.filter((check) => check.status === group.status).map((check) => (
                  <li className="flex gap-3.5 py-4" key={check.id}>
                    <span aria-label={MARK[check.status].label} className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full text-[13px] font-bold ${MARK[check.status].tone}`} role="img">{MARK[check.status].sign}</span>
                    <div className="min-w-0"><p className="text-[16px] font-semibold">{check.label}</p><p className="mt-1 break-words text-[14px] leading-[1.5] text-ink/65">{check.detail}</p></div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
      {result && failing > 0 && (
        <div className="relative isolate overflow-hidden rounded-[28px] bg-coral p-7 sm:p-9">
          <MeetMark className="absolute -right-[4%] -top-[40%] -z-10 w-[220px] text-ink opacity-[.08]" />
          <p className="font-display text-[clamp(26px,2.6vw,34px)] font-extrabold leading-none tracking-[-0.05em]">Or skip the fixing.</p>
          <p className="mt-3 max-w-[40rem] text-[16px] leading-[1.5] text-ink/80">Setuvara pages come with a title, a description, a preview image, an icon and a fast mobile page, on every plan.</p>
          <Link className="mt-6 inline-flex min-h-12 items-center rounded-full bg-ink px-6 text-[15px] font-semibold text-paper hover:bg-[#262626] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink" href="/signup">Make yours free →</Link>
        </div>
      )}
    </div>
  );
}
