"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";

import { STATUS_LABEL, type PrivacyStatus } from "@/lib/privacy/model";

/** Asks for account deletion with the username typed as confirmation. Nothing is deleted on the spot. */
export function AccountDeletion({ username, open }: { username: string; open: { code: string; status: PrivacyStatus } | null }) {
  const router = useRouter();
  const inputId = useId();
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const matches = username !== "" && typed.trim().toLowerCase().replace(/^@/, "") === username;

  async function send(method: "POST" | "DELETE") {
    setBusy(true);
    setMessage(null);
    const response = await fetch("/api/privacy/account-deletion", { method, headers: { "Content-Type": "application/json", "x-setuvara-request": "same-origin" }, body: method === "POST" ? JSON.stringify({ confirm: typed }) : undefined }).catch(() => null);
    const result = await response?.json().catch(() => null) as { error?: string } | null;
    setBusy(false);
    if (!response?.ok) { setMessage(result?.error ?? "That didn't work. Try again."); return; }
    setTyped("");
    router.refresh();
  }

  return <section aria-labelledby="delete-title" className="mt-5 rounded-[22px] bg-white px-5 py-5 shadow-[inset_0_0_0_1px_rgba(13,13,13,.1)] sm:px-6">
    <h2 className="text-[17px] font-semibold tracking-[-0.01em]" id="delete-title">Delete your Setuvara account</h2>
    {open ? <>
      <p className="mt-1 text-[14px] leading-5 text-black/60">We have your request. A person checks it, deletes your account and confirms by email. You can keep using Setuvara until then.</p>
      <p className="mt-3 flex flex-wrap items-center gap-2 text-[14px]"><span className="rounded-full bg-[#f5f4ef] px-3 py-1.5 font-label text-[11px] font-bold tracking-[0.08em]">{open.code}</span><span className="text-black/60">{STATUS_LABEL[open.status]}</span></p>
      {open.status === "received" && <button className="mt-4 inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold text-black/70 shadow-[inset_0_0_0_1px_rgba(13,13,13,.15)] hover:bg-black/[0.04] disabled:opacity-50" disabled={busy} onClick={() => void send("DELETE")} type="button">Withdraw request</button>}
    </> : <>
      <p className="mt-1 text-[14px] leading-5 text-black/60">Deletes your identity, Modes, media, links, notes and Connections. It can&apos;t be undone. Cancel a paid plan in Billing first; billing records we must keep by law stay.</p>
      <label className="mt-4 block text-[14px] font-semibold" htmlFor={inputId}>Type <span className="font-label">{username || "your username"}</span> to confirm</label>
      <input autoCapitalize="none" autoComplete="off" className="mt-2 min-h-12 w-full rounded-2xl bg-[#f5f4ef] px-4 text-[15px] outline-none focus-visible:ring-2 focus-visible:ring-[#0d0d0d]" id={inputId} onChange={(event) => setTyped(event.target.value)} spellCheck={false} value={typed} />
      <button className="mt-4 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-[#b3261e] px-6 text-[15px] font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-4 disabled:opacity-40 sm:w-auto" disabled={!matches || busy} onClick={() => void send("POST")} type="button">{busy ? "Sending…" : "Request account deletion"}</button>
    </>}
    {message && <p className="mt-3 text-[14px] font-medium text-red-700" role="alert">{message}</p>}
  </section>;
}
