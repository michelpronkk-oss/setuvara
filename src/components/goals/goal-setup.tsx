"use client";

import Link from "next/link";
import { useMemo, useRef, useState, useTransition } from "react";

import { applyGoal } from "@/app/app/identity/goals/actions";
import { coralButton, lineButton, Mono } from "@/components/creator/studio-ui";
import { KindTile } from "@/components/actions/kind-picker";
import { ACTION_KIND_NAME } from "@/lib/actions/model";
import { draftsHref, GOALS, type GoalAnswers, type GoalId } from "@/lib/goals/templates";

const field = "min-h-12 w-full rounded-[16px] bg-white px-4 text-[16px] shadow-[inset_0_0_0_1px_rgba(13,13,13,.14)] outline-none focus:shadow-[inset_0_0_0_1.5px_#0D0D0D]";
const newKey = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID().replace(/-/g, "") : `${Date.now()}${Math.random().toString(36).slice(2)}`).slice(0, 32);

/**
 * A goal's questions beside a live preview of exactly what it will create. Applying is one click,
 * guarded by an idempotency key: a double click or a retry returns the same setup.
 */
export function GoalSetup({ goalId, initial, locked, firstName }: { goalId: GoalId; initial: GoalAnswers; locked: boolean; firstName: string }) {
  const goal = GOALS[goalId];
  const [answers, setAnswers] = useState<GoalAnswers>(initial);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ duplicate: boolean } | null>(null);
  const [pending, start] = useTransition();
  const key = useRef(newKey());
  const [now] = useState(() => Date.now());
  const timezone = typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "Europe/Amsterdam";
  const preview = useMemo(() => goal.build(answers, { firstName, now, timezone }), [goal, answers, firstName, now, timezone]);
  const set = (id: string, value: string) => { setAnswers((prev) => ({ ...prev, [id]: value })); setError(""); };

  const apply = () => start(async () => {
    const result = await applyGoal(goalId, answers, key.current, timezone);
    if (!result.ok) { setError(result.error); return; }
    setDone({ duplicate: result.duplicate });
  });

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] lg:gap-12">
      <form className="grid content-start gap-5" onSubmit={(event) => { event.preventDefault(); if (!locked && !done) apply(); }}>
        {goal.fields.map((item) => (
          <label className="grid gap-2" htmlFor={`goal-${item.id}`} key={item.id}>
            <span className="text-[15px] font-semibold">{item.label}</span>
            {item.type === "choice" ? (
              <span className="flex flex-wrap gap-2" id={`goal-${item.id}`} role="radiogroup">
                {item.options.map((option) => {
                  const on = (answers[item.id] ?? "") === option.value;
                  return <button aria-checked={on} className={`min-h-11 rounded-full px-4 text-[15px] font-semibold transition ${on ? "bg-[#0D0D0D] text-white" : "bg-white shadow-[inset_0_0_0_1px_rgba(13,13,13,.14)] hover:shadow-[inset_0_0_0_1.5px_#0D0D0D]"}`} key={option.value} onClick={() => set(item.id, option.value)} role="radio" type="button">{option.label}</button>;
                })}
              </span>
            ) : (
              <input className={field} id={`goal-${item.id}`} inputMode={item.type === "number" ? "numeric" : item.type === "money" ? "decimal" : undefined}
                maxLength={item.type === "text" ? item.max : 40} onChange={(event) => set(item.id, event.target.value)}
                placeholder={"placeholder" in item ? item.placeholder : item.type === "money" ? "24" : undefined}
                type={item.type === "datetime" ? "datetime-local" : "text"} value={answers[item.id] ?? ""} />
            )}
            {"hint" in item && item.hint && <span className="text-[13px] text-black/55">{item.hint}</span>}
          </label>
        ))}
        {error && <p className="rounded-[14px] bg-[#FFE9E7] px-4 py-3 text-[14px] text-[#B4231A]" role="alert">{error}</p>}
        {done ? (
          <div className="grid gap-3 rounded-[22px] bg-[#C7FF4A]/40 p-5">
            <p className="font-display text-[22px] font-bold tracking-[-0.03em]">{done.duplicate ? "Already set up." : "Ready. Everything is saved as a draft."}</p>
            <p className="text-[14px] leading-[1.5] text-black/70">{goal.next}</p>
            <div className="flex flex-wrap gap-2"><Link className={coralButton} href="/app">See it on Home</Link><Link className={lineButton} href={draftsHref(goal.mode, preview)}>Open drafts</Link></div>
          </div>
        ) : locked ? (
          <div className="grid gap-2 rounded-[22px] bg-white p-5 shadow-[inset_0_0_0_1px_rgba(13,13,13,.08)]">
            <p className="font-semibold">Part of Plus and Pro.</p>
            <p className="text-[14px] text-black/65">Plus is €6.99 a month and unlocks every goal for every Mode.</p>
            <div><Link className={coralButton} href="/app/upgrade">See Plus</Link></div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3"><button className={coralButton} disabled={pending} type="submit">{pending ? "Setting up…" : "Set it up"}</button><span className="text-[13px] text-black/55">Creates drafts only. Nothing goes live until you publish.</span></div>
        )}
      </form>

      <aside aria-label="What this creates" className="h-fit rounded-[26px] bg-[#F5F4EF] p-5 lg:sticky lg:top-6">
        <Mono className="text-black/55">What this creates</Mono>
        <ul className="mt-3 grid gap-2 text-[14px] leading-[1.45] text-black/75">{goal.creates(answers).map((line) => <li className="flex gap-2" key={line}><span aria-hidden="true">·</span>{line}</li>)}</ul>
        <div className="mt-5 grid gap-3">
          {preview.actions.map((item, index) => (
            <article className="rounded-[20px] bg-white p-4 shadow-[inset_0_0_0_1px_rgba(13,13,13,.06)]" key={index}>
              <div className="flex items-center gap-2"><KindTile kind={item.kind} size={24} /><Mono className="text-black/50">{ACTION_KIND_NAME[item.kind]} · Draft</Mono></div>
              <h3 className="mt-3 font-display text-[22px] font-bold leading-[1.05] tracking-[-0.03em]">{item.title}</h3>
              {item.intro && <p className="mt-2 text-[14px] leading-[1.45] text-black/70">{item.intro}</p>}
              {item.config.questions?.length ? <ul className="mt-3 grid gap-1 text-[13px] text-black/60">{item.config.questions.map((question) => <li key={question.id}>— {question.label}</li>)}</ul> : null}
              <span className="mt-3 inline-flex min-h-9 items-center rounded-full bg-[#0D0D0D] px-4 text-[13px] font-semibold text-white">{item.cta_label ?? "Send"}</span>
            </article>
          ))}
          {preview.event && (
            <article className="rounded-[20px] bg-white p-4 shadow-[inset_0_0_0_1px_rgba(13,13,13,.06)]">
              <Mono className="text-black/50">Event · Draft</Mono>
              <h3 className="mt-2 font-display text-[22px] font-bold leading-[1.05] tracking-[-0.03em]">{preview.event.title}</h3>
              <p className="mt-2 text-[14px] text-black/70">{new Date(preview.event.starts_at).toLocaleString(undefined, { timeZone: "UTC", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}{preview.event.city ? ` · ${preview.event.city}` : ""}</p>
              <p className="mt-1 text-[13px] text-black/55">{preview.event.capacity ? `${preview.event.capacity} places, then a waitlist` : "No guest limit"}</p>
            </article>
          )}
          {preview.offer && (
            <article className="rounded-[20px] bg-white p-4 shadow-[inset_0_0_0_1px_rgba(13,13,13,.06)]">
              <Mono className="text-black/50">Product · Draft</Mono>
              <h3 className="mt-2 font-display text-[22px] font-bold leading-[1.05] tracking-[-0.03em]">{preview.offer.title}</h3>
              <p className="mt-1 text-[14px] text-black/70">{(preview.offer.unit_amount_minor / 100).toLocaleString(undefined, { style: "currency", currency: preview.offer.currency })}</p>
            </article>
          )}
        </div>
      </aside>
    </div>
  );
}
