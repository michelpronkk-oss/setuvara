"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import type { ModeSlug } from "@/components/profile/types";
import { inkOnAccent } from "@/components/profile/appearance";

type ShareBackMode = { slug: ModeSlug; label: string };

type ConnectFlowProps = {
  username: string;
  mode: ModeSlug;
  source: string;
  registered: boolean;
  alreadyConnected?: boolean;
  shareBackModes?: ShareBackMode[];
  guestSessionName?: string | null;
  /** Visible trigger copy, e.g. "Connect at Slush" in Event Mode. */
  label?: string;
  /** Resolved from the active Mode's saved Appearance. */
  accent: string;
};

const validSources = ["qr", "quick_qr", "link", "share", "native_share", "profile", "direct", "tap"];

export function ConnectFlow({ username, mode, source, registered, alreadyConnected = false, shareBackModes = [], guestSessionName = null, label = "Connect", accent }: ConnectFlowProps) {
  const router = useRouter();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState(guestSessionName ?? "");
  const [email, setEmail] = useState("");
  const [shareBack, setShareBack] = useState<ModeSlug>(shareBackModes.find((item) => item.slug === "personal")?.slug ?? shareBackModes[0]?.slug ?? "personal");
  const [error, setError] = useState("");
  const [connectedId, setConnectedId] = useState<string | null>(null);

  const close = useCallback(() => {
    setOpen(false);
    setError("");
    if (connectedId) router.refresh();
    window.setTimeout(() => triggerRef.current?.focus(), 0);
  }, [connectedId, router]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) close();
      if (event.key === "Tab") {
        const controls = [...(dialogRef.current?.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled), a[href], select:not(:disabled), textarea:not(:disabled)") ?? [])];
        if (!controls.length) return;
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    dialogRef.current?.querySelector<HTMLElement>("input, button")?.focus();
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, busy, close]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!registered && !guestSessionName && (!name.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))) {
      setError("Add your name and a valid email so you can keep this connection.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/connections", {
        method: "POST",
        headers: { "content-type": "application/json", "x-setuvara-request": "same-origin" },
        body: JSON.stringify({
          username,
          mode,
          source: validSources.includes(source) ? source : "direct",
          requestId: crypto.randomUUID(),
          ...(registered
            ? { shareBackMode: shareBack }
            : guestSessionName
              ? {}
              : { displayName: name.trim(), email: email.trim() }),
        }),
      });
      const result = await response.json().catch(() => null) as { error?: string; connectionId?: string } | null;
      if (!response.ok) throw new Error(result?.error ?? "We couldn’t save this connection. Try again.");
      setConnectedId(result?.connectionId ?? null);
    } catch (error) {
      setError(error instanceof Error ? error.message : "We couldn’t save this connection. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-full px-6 text-sm font-semibold transition hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0d0d0d]" onClick={() => setOpen(true)} ref={triggerRef} style={{ background: accent, color: inkOnAccent(accent) }} type="button">
        {alreadyConnected ? "Connect again" : label}
      </button>
      {open && (
        <div className="fixed inset-0 z-[80] grid place-items-end bg-[#0d0d0d]/45 p-0 sm:place-items-center sm:p-5" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) close(); }}>
          <div aria-labelledby="connect-title" aria-modal="true" className="w-full max-w-md rounded-t-[2rem] bg-[#f5f4ef] p-6 text-[#0d0d0d] shadow-2xl sm:rounded-[2rem] sm:p-8" ref={dialogRef} role="dialog">
            {connectedId ? <div className="py-6 text-center"><div aria-hidden="true" className="connect-meet-mark mx-auto grid size-16 place-items-center"><span className="connect-meet-check">✓</span></div><p aria-live="polite" className="mt-5 text-2xl font-semibold tracking-[-0.04em]">You’re connected.</p><p className="mt-2 text-sm text-black/55">This moment is now part of your Setuvara memory.</p><div className="mt-6 grid gap-2">{registered ? <Link className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#0d0d0d] px-5 text-sm font-semibold text-white" href={`/app/connections/${connectedId}`}>View connection</Link> : <><Link className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#0d0d0d] px-5 text-sm font-semibold text-white" href={`/connections/${connectedId}`}>View connection</Link><Link className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#ff5a4f] px-5 text-sm font-semibold" href="/signup?claim=1">Claim your Setuvara</Link><p className="text-xs leading-5 text-black/55">Keep this connection, create your identity, and share yours next time.</p></>}<button className="min-h-11 rounded-full px-4 text-xs font-semibold underline underline-offset-4" onClick={close} type="button">Done</button></div></div> : <>
            <div className="mb-6 flex items-start justify-between gap-4"><div><p className="text-[10px] font-bold tracking-[0.2em] text-black/45">SETUVARA · CONNECT</p><h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em]" id="connect-title">Connect with {username}</h2></div><button aria-label="Close" className="grid size-11 shrink-0 place-items-center rounded-full border border-black/15 text-xl focus-visible:outline-2" disabled={busy} onClick={close} type="button">×</button></div>
            <form className="space-y-5" onSubmit={submit}>
              {registered ? (
                <fieldset><legend className="text-sm font-semibold">Share back as</legend><p className="mt-1 text-xs text-black/55">Choose the version of you that fits this moment.</p><div className="mt-3 grid grid-cols-3 gap-2">{shareBackModes.map((item) => <button aria-pressed={shareBack === item.slug} className={`min-h-12 rounded-xl border px-2 text-sm font-semibold ${shareBack === item.slug ? "border-[#0d0d0d] bg-[#0d0d0d] text-white" : "border-black/15 bg-white/60"}`} key={item.slug} onClick={() => setShareBack(item.slug)} type="button">{item.label}</button>)}</div></fieldset>
              ) : guestSessionName ? (
                <div className="rounded-2xl bg-white px-4 py-4"><p className="text-sm font-semibold">Continue as {guestSessionName}</p><p className="mt-1 text-xs leading-5 text-black/55">Your guest identity is remembered securely on this browser.</p></div>
              ) : (
                <>
                  <label className="block space-y-2 text-sm font-medium">Name<input autoComplete="name" className="min-h-12 w-full rounded-xl border border-black/15 bg-white px-4 text-base font-normal focus-visible:outline-2" maxLength={80} onChange={(event) => setName(event.target.value)} required value={name} /></label>
                  <label className="block space-y-2 text-sm font-medium">Email<input autoComplete="email" className="min-h-12 w-full rounded-xl border border-black/15 bg-white px-4 text-base font-normal focus-visible:outline-2" onChange={(event) => setEmail(event.target.value)} required type="email" value={email} /><span className="block text-xs leading-5 text-black/55">We’ll use this so you can keep this connection and claim your Setuvara later.</span></label>
                </>
              )}
              {error && <p aria-live="assertive" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-900">{error}</p>}
              <button className="min-h-12 w-full rounded-full px-6 text-sm font-semibold disabled:opacity-60" disabled={busy || (registered && shareBackModes.length === 0)} style={{ background: accent, color: inkOnAccent(accent) }} type="submit">{busy ? "Connecting…" : "Connect"}</button>
            </form>
            {!registered && <p className="mt-4 text-center text-[11px] leading-5 text-black/50">No signup needed. You can claim your Setuvara after connecting.</p>}
            </>}
          </div>
        </div>
      )}
    </>
  );
}
