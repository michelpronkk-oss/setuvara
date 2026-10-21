"use client";

import { useState } from "react";

export function Unsubscribe({ token }: { token: string }) {
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [lists, setLists] = useState<string[]>([]);

  async function leave() {
    setState("busy");
    const response = await fetch("/api/audience/unsubscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) }).catch(() => null);
    const body = await response?.json().catch(() => null) as { ok?: boolean; lists?: string[] } | null;
    if (body?.ok) { setLists(body.lists ?? []); setState("done"); } else setState("error");
  }

  if (state === "done") {
    return (
      <div role="status">
        <span aria-hidden="true" className="grid size-14 place-items-center rounded-full bg-[#0D0D0D] text-[22px] text-[#F5F4EF]">✓</span>
        <h1 className="mt-5 font-display text-[36px] font-bold leading-none tracking-[-0.05em]">You&apos;re off the list.</h1>
        <p className="mt-3 text-[16px] text-black/65">{lists.length ? `You won't get emails from ${lists.join(", ")} again.` : "You won't get these emails again."} Signing up again on the page is the only way back.</p>
      </div>
    );
  }
  return (
    <div className="rounded-[28px] bg-white p-7 shadow-[inset_0_0_0_1px_rgba(13,13,13,.08),0_40px_80px_-40px_rgba(0,0,0,.35)]">
      <p className="font-label text-[11px] uppercase tracking-[0.18em] text-black/55">Newsletter</p>
      <h1 className="mt-3 font-display text-[38px] font-bold leading-[0.98] tracking-[-0.05em]">Unsubscribe?</h1>
      <p className="mt-3 text-[16px] text-black/65">One press and you stop getting these emails.</p>
      <button className="mt-7 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-[#0D0D0D] text-[16px] font-semibold text-[#F5F4EF] transition active:scale-[.98] disabled:opacity-50" disabled={state === "busy"} onClick={() => void leave()} type="button">
        {state === "busy" ? <><span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent" />Unsubscribing…</> : "Unsubscribe"}
      </button>
      {state === "error" && <p className="mt-3 text-[14px] font-semibold text-[#B42318]" role="alert">That didn&apos;t work. Try again.</p>}
    </div>
  );
}
