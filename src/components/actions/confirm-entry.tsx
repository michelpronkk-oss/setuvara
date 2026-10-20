"use client";

import { useState } from "react";

const REASONS: Record<string, string> = {
  expired: "This link expired. Enter again from the giveaway page.",
  closed: "This giveaway has closed.",
  invalid: "This link was already used or doesn't exist.",
};

export function ConfirmEntry({ token }: { token: string }) {
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [title, setTitle] = useState<string | null>(null);

  async function confirm() {
    setState("busy");
    const response = await fetch("/api/actions/confirm", { method: "POST", headers: { "Content-Type": "application/json", "x-setuvara-request": "same-origin" }, body: JSON.stringify({ token }) }).catch(() => null);
    const result = await response?.json().catch(() => null) as { ok?: boolean; reason?: string; title?: string; error?: string } | null;
    if (result?.ok) { setTitle(result.title ?? null); setState("done"); return; }
    setMessage(REASONS[result?.reason ?? ""] ?? result?.error ?? "That didn't work. Try again.");
    setState("error");
  }

  if (state === "done") {
    return (
      <div role="status">
        <span aria-hidden="true" className="grid size-14 place-items-center rounded-full bg-[#0D0D0D] text-[22px] text-[#F5F4EF]">✓</span>
        <h1 className="mt-5 font-display text-[36px] font-bold leading-none tracking-[-0.05em]">You&apos;re in.</h1>
        <p className="mt-3 text-[16px] text-black/65">{title ? `Your entry for ${title} is confirmed.` : "Your entry is confirmed."} One entry per person.</p>
      </div>
    );
  }
  return (
    <div>
      <h1 className="font-display text-[36px] font-bold leading-none tracking-[-0.05em]">Confirm your entry</h1>
      <p className="mt-3 text-[16px] text-black/65">One press and your giveaway entry counts.</p>
      <button className="mt-6 inline-flex min-h-14 w-full items-center justify-center rounded-full bg-[#0D0D0D] text-[16px] font-semibold text-[#F5F4EF] disabled:opacity-50" disabled={state === "busy"} onClick={() => void confirm()} type="button">{state === "busy" ? "Confirming…" : "Confirm my entry"}</button>
      {message && <p className="mt-3 text-[14px] font-semibold text-[#B42318]" role="alert">{message}</p>}
    </div>
  );
}
