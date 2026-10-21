"use client";

import { useState } from "react";

import type { ActionReward } from "@/lib/actions/model";

/** The reward on a thank-you screen: a code to copy or a link to open, in the page's colours. */
export function RewardCard({ reward, preview = false }: { reward: ActionReward; preview?: boolean }) {
  const [copied, setCopied] = useState(false);
  const label = reward.label || (reward.kind === "code" ? "Your code" : "Your reward");
  async function copy() {
    if (!reward.code) return;
    try { await navigator.clipboard.writeText(reward.code); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch { /* the code stays selectable */ }
  }
  return (
    <div className="mt-6 w-full max-w-[340px] rounded-[22px] p-4 text-left" data-action-reward={reward.kind} style={{ background: "var(--av-panel)", boxShadow: "inset 0 0 0 1px var(--av-line)" }}>
      <p className="font-label text-[10.5px] uppercase tracking-[0.18em]" style={{ color: "var(--av-muted)" }}>{label}</p>
      {reward.kind === "code" ? (
        <div className="mt-2 flex items-center gap-2">
          <code className="min-w-0 flex-1 select-all truncate font-label text-[20px] tracking-[0.08em]">{reward.code}</code>
          <button className="inline-flex min-h-10 shrink-0 items-center rounded-full px-4 text-[14px] font-semibold" disabled={preview} onClick={() => void copy()} style={{ background: "var(--av-btn-bg)", color: "var(--av-btn-fg)", boxShadow: "var(--av-btn-ring)" }} type="button">{copied ? "Copied" : "Copy"}</button>
        </div>
      ) : (
        <a className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-full text-[15px] font-semibold" href={preview ? undefined : reward.url ?? undefined} rel="noreferrer" style={{ background: "var(--av-btn-bg)", color: "var(--av-btn-fg)", boxShadow: "var(--av-btn-ring)" }} target="_blank">Open<span aria-hidden="true">↗</span></a>
      )}
    </div>
  );
}
