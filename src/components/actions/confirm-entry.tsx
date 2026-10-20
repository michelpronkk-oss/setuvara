"use client";

import { useState, type CSSProperties } from "react";

import type { MotionLevel } from "@/components/profile/appearance";
import type { ActionKind } from "@/lib/actions/model";
import { ActionSuccess } from "./action-success";

const REASONS: Record<string, string> = {
  expired: "This link expired. Try again from the page.",
  closed: "This has closed.",
  invalid: "This link was already used or doesn't exist.",
};

export type ConfirmView = { kind: ActionKind; title: string; name: string; backHref: string | null; heading: CSSProperties; motion: MotionLevel };

export function ConfirmEntry({ token, target }: { token: string; target: ConfirmView | null }) {
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [result, setResult] = useState<{ title: string | null; kind: ActionKind | null }>({ title: null, kind: null });
  const newsletter = (target?.kind ?? result.kind) === "newsletter";
  const firstName = target?.name.split(/\s+/)[0] || target?.name || "";

  async function confirm() {
    setState("busy");
    const response = await fetch("/api/actions/confirm", { method: "POST", headers: { "Content-Type": "application/json", "x-setuvara-request": "same-origin" }, body: JSON.stringify({ token }) }).catch(() => null);
    const body = await response?.json().catch(() => null) as { ok?: boolean; reason?: string; title?: string; kind?: ActionKind; error?: string } | null;
    if (body?.ok) { setResult({ title: body.title ?? null, kind: body.kind ?? null }); setState("done"); return; }
    setMessage(REASONS[body?.reason ?? ""] ?? body?.error ?? "That didn't work. Try again.");
    setState("error");
  }

  if (state === "done") {
    const kind = target?.kind ?? result.kind ?? "giveaway";
    if (target) return <ActionSuccess backHref={target.backHref ?? undefined} firstName={firstName} heading={target.heading} kind={kind} motion={target.motion} stage="confirmed" />;
    return (
      <div role="status">
        <span aria-hidden="true" className="grid size-14 place-items-center rounded-full bg-[#0D0D0D] text-[22px] text-[#F5F4EF]">✓</span>
        <h1 className="mt-5 font-display text-[36px] font-bold leading-none tracking-[-0.05em]">{kind === "newsletter" ? "You're on the list." : "You're in."}</h1>
        <p className="mt-3 text-[16px] text-black/65">{result.title ? `${kind === "newsletter" ? "Your subscription to" : "Your entry for"} ${result.title} is confirmed.` : "Confirmed."}</p>
      </div>
    );
  }
  const title = target?.title;
  return (
    <div className="rounded-[28px] p-7 shadow-[inset_0_0_0_1px_var(--av-line,rgba(13,13,13,.1)),0_40px_80px_-40px_rgba(0,0,0,.5)] backdrop-blur-xl" style={{ background: "color-mix(in srgb, var(--av-panel, #FFFFFF) 88%, transparent)" }}>
      {target && <p className="font-label text-[11px] uppercase tracking-[0.18em]" style={{ color: "var(--av-muted)" }}>{newsletter ? "Newsletter" : "Giveaway"} · {target.name}</p>}
      <h1 className="mt-3 text-[38px] leading-[0.98]" style={target ? target.heading : { fontWeight: 700, letterSpacing: "-0.05em" }}>{newsletter ? "Confirm your subscription" : "Confirm your entry"}</h1>
      <p className="mt-3 text-[16px]" style={{ color: "var(--av-muted, rgba(13,13,13,.65))" }}>{title ? <>One press and {newsletter ? "you're on the list for" : "your entry counts for"} <strong className="font-semibold" style={{ color: "var(--av-fg)" }}>{title}</strong>.</> : newsletter ? "One press and you're on the list." : "One press and your giveaway entry counts."}</p>
      <button className="mt-7 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-full text-[16px] font-semibold transition active:scale-[.98] disabled:opacity-50" disabled={state === "busy"} onClick={() => void confirm()} style={{ background: "var(--av-btn-bg, #0D0D0D)", color: "var(--av-btn-fg, #F5F4EF)", boxShadow: "var(--av-btn-ring, none)" }} type="button">
        {state === "busy" ? <><span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent" />Confirming…</> : newsletter ? "Confirm my subscription" : "Confirm my entry"}
      </button>
      {message && <p className="mt-3 text-[14px] font-semibold" role="alert" style={{ color: "var(--av-error, #B42318)" }}>{message}</p>}
    </div>
  );
}
