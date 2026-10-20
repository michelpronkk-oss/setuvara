"use client";

import Link from "next/link";
import { useState } from "react";

import type { ModeSlug } from "@/components/profile/types";
import { INQUIRY_BUDGET_LABEL, INQUIRY_BUDGETS, INQUIRY_KIND_LABEL, INQUIRY_KINDS, initials, type InquiryBudget, type InquiryKind } from "@/lib/creator/studio";
import { createClient } from "@/lib/supabase/client";

const chip = (on: boolean) => `inline-flex min-h-11 items-center rounded-full px-[18px] text-[15px] font-semibold transition-colors focus-visible:outline-2 ${on ? "bg-[#0D0D0D] text-[#F5F4EF]" : "bg-white text-[#0D0D0D] shadow-[inset_0_0_0_1px_rgba(13,13,13,.1)] hover:bg-black/[0.03]"}`;

const ERRORS: Record<string, string> = {
  P0002: "This page is not taking new projects right now.",
  "54000": "You have sent a few inquiries already. Try again later.",
  "22023": "Check the brief and try again.",
  "42501": "Sign in to send an inquiry.",
};

export function CollabForm({ creatorUsername, firstName, sender, loginHref, backHref }: {
  creatorUsername: string;
  firstName: string;
  sender: { name: string; modes: { slug: ModeSlug; name: string }[] } | null;
  loginHref: string;
  backHref: string;
}) {
  const [kind, setKind] = useState<InquiryKind>("campaign");
  const [budget, setBudget] = useState<InquiryBudget | null>(null);
  const [brand, setBrand] = useState("");
  const [message, setMessage] = useState("");
  const [modeSlug, setModeSlug] = useState<ModeSlug | null>(sender?.modes.find((mode) => mode.slug === "business")?.slug ?? sender?.modes[0]?.slug ?? null);
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);
  const ready = Boolean(sender && modeSlug && budget && message.trim().length >= 10);
  const modeName = sender?.modes.find((mode) => mode.slug === modeSlug)?.name;

  async function send(event: React.FormEvent) {
    event.preventDefault();
    if (!ready || !budget || !modeSlug) return;
    setStatus("sending");
    setError(null);
    const { error: rpcError } = await createClient().rpc("creator_send_inquiry", {
      p_creator_username: creatorUsername,
      p_kind: kind,
      p_budget: budget,
      p_brand: brand.trim() || null,
      p_message: message.trim(),
      p_sender_mode: modeSlug,
    });
    if (rpcError) {
      setStatus("idle");
      setError(ERRORS[rpcError.code ?? ""] ?? "Not sent. Try again.");
      return;
    }
    setStatus("sent");
  }

  if (status === "sent") {
    return (
      <div className="mt-8 flex flex-col items-start gap-4" role="status">
        <span aria-hidden="true" className="grid size-14 place-items-center rounded-full bg-[#0D0D0D] text-[22px] text-[#F5F4EF]">✓</span>
        <p className="font-display text-[30px] font-bold leading-none tracking-[-0.05em]">Sent to {firstName}.</p>
        <p className="text-[16px] leading-[1.5] text-black/70">{firstName} sees it with your {modeName} Mode attached.</p>
        <Link className="inline-flex min-h-11 items-center rounded-full bg-[#0D0D0D] px-[18px] text-[15px] font-semibold text-[#F5F4EF]" href={backHref}>Back to the page</Link>
      </div>
    );
  }

  return (
    <form className="mt-7 flex flex-1 flex-col gap-6" onSubmit={(event) => void send(event)}>
      <fieldset>
        <legend className="mb-2.5 text-[16px] font-semibold">What&apos;s it for?</legend>
        <div className="flex flex-wrap gap-2">{INQUIRY_KINDS.map((item) => <button aria-pressed={kind === item} className={chip(kind === item)} key={item} onClick={() => setKind(item)} type="button">{INQUIRY_KIND_LABEL[item]}</button>)}</div>
      </fieldset>
      <fieldset>
        <legend className="mb-2.5 text-[16px] font-semibold">Budget</legend>
        <div className="flex flex-wrap gap-2">{INQUIRY_BUDGETS.map((item) => <button aria-pressed={budget === item} className={chip(budget === item)} key={item} onClick={() => setBudget(item)} type="button">{INQUIRY_BUDGET_LABEL[item]}</button>)}</div>
      </fieldset>
      <label className="flex flex-col gap-2.5">
        <span className="text-[16px] font-semibold">Brand or company <span className="font-normal text-black/50">optional</span></span>
        <input className="min-h-12 rounded-[16px] bg-white px-4 text-[16px] shadow-[inset_0_0_0_1px_rgba(13,13,13,.1)] outline-none focus:shadow-[inset_0_0_0_2px_#0D0D0D]" maxLength={100} onChange={(event) => setBrand(event.target.value)} value={brand} />
      </label>
      <label className="flex flex-col gap-2.5">
        <span className="text-[16px] font-semibold">Tell {firstName} about it</span>
        <textarea className="min-h-[148px] resize-y rounded-[20px] bg-white p-4 text-[16px] leading-[1.5] shadow-[inset_0_0_0_1px_rgba(13,13,13,.1)] outline-none focus:shadow-[inset_0_0_0_2px_#0D0D0D]" maxLength={2000} onChange={(event) => setMessage(event.target.value)} placeholder="What you are making, when, and where it runs." value={message} />
      </label>

      {sender ? (
        sender.modes.length ? (
          <div className="flex items-center gap-3 text-[14px] text-black/65">
            <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-full bg-[#E6E4DC] text-[12px] font-semibold text-[#0D0D0D]">{initials(sender.name)}</span>
            <span className="min-w-0 flex-1">Sent as {sender.name},{" "}
              {sender.modes.length > 1 ? (
                <select aria-label="Send as Mode" className="rounded-md bg-transparent font-semibold text-[#0D0D0D] underline underline-offset-4" onChange={(event) => setModeSlug(event.target.value as ModeSlug)} value={modeSlug ?? ""}>
                  {sender.modes.map((mode) => <option key={mode.slug} value={mode.slug}>{mode.name} Mode</option>)}
                </select>
              ) : <span className="font-semibold text-[#0D0D0D]">{modeName} Mode</span>}
            </span>
          </div>
        ) : <p className="text-[14px] text-black/65">Turn on one of your Modes to send an inquiry.</p>
      ) : null}

      {error && <p className="text-[14px] font-semibold text-[#B42318]" role="alert">{error}</p>}

      <div className="sticky bottom-0 -mx-5 mt-auto bg-[linear-gradient(to_bottom,rgba(245,244,239,0),#F5F4EF_24px)] px-5 pb-[calc(12px+env(safe-area-inset-bottom))] pt-6">
        {sender
          ? <button className="inline-flex min-h-14 w-full items-center justify-center rounded-full bg-[#0D0D0D] text-[16px] font-semibold text-[#F5F4EF] disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2" disabled={!ready || status === "sending"} type="submit">{status === "sending" ? "Sending…" : "Send inquiry"}</button>
          : <Link className="inline-flex min-h-14 w-full items-center justify-center rounded-full bg-[#0D0D0D] text-[16px] font-semibold text-[#F5F4EF]" href={loginHref}>Sign in to send</Link>}
        {sender && !ready && <p className="mt-2 text-center text-[13px] text-black/55">{!budget ? "Pick a budget" : message.trim().length < 10 ? "Add a few words about the project" : ""}</p>}
      </div>
    </form>
  );
}
