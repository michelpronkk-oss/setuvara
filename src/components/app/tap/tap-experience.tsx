"use client";

import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { useCallback, useEffect, useId, useRef, useState } from "react";

import type { ModeSlug } from "@/components/profile/types";
import type { ConnectPolicy } from "@/lib/connections/access";

type TapIntent = "view_profile" | "connect_in_person";
type DeviceKind = "card" | "ring" | "sticker" | "badge" | "other";
type DeviceStatus = "unclaimed" | "active" | "disabled" | "lost" | "retired";
type Equipped = { mode: ModeSlug; intent: TapIntent };
type Device = { id: string; label: string; kind: DeviceKind; status: DeviceStatus; createdAt?: string | null; lastTappedAt?: string | null };
type Mode = { slug: ModeSlug; enabled: boolean; connectPolicy: ConnectPolicy };

export type TapProfile = {
  displayName: string;
  username: string;
  published: boolean;
  modes: Mode[];
};

const modeNames: Record<ModeSlug, string> = { personal: "Personal", event: "Event", business: "Business" };
const modeColors: Record<ModeSlug, string> = { personal: "#FF5A4F", event: "#C7FF4A", business: "#AFCBFF" };
const kindNames: Record<DeviceKind, string> = { card: "Card", ring: "Ring", sticker: "Sticker", badge: "Badge", other: "Other" };
const statusNames: Record<DeviceStatus, string> = { unclaimed: "Ready to claim", active: "Ready", disabled: "Paused", lost: "Lost", retired: "Retired" };
const kinds: DeviceKind[] = ["card", "ring", "sticker", "badge", "other"];

function isEquipped(value: unknown): value is Equipped {
  if (!value || typeof value !== "object") return false;
  const state = value as Record<string, unknown>;
  return ["personal", "event", "business"].includes(String(state.mode)) && ["view_profile", "connect_in_person"].includes(String(state.intent));
}

function isDevice(value: unknown): value is Device {
  if (!value || typeof value !== "object") return false;
  const device = value as Record<string, unknown>;
  return typeof device.id === "string" && typeof device.label === "string" && kinds.includes(device.kind as DeviceKind)
    && ["unclaimed", "active", "disabled", "lost", "retired"].includes(String(device.status));
}

function safeTapUrl(value: unknown, path: RegExp): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    const local = /^(localhost|127\.0\.0\.1)$/.test(url.hostname) && ["3000", "3014"].includes(url.port) && url.protocol === "http:";
    const production = ["setuvara.com", "www.setuvara.com"].includes(url.hostname) && url.protocol === "https:";
    return (local || production) && path.test(url.pathname) && !url.search && !url.hash ? url.href : null;
  } catch { return null; }
}

async function tapRequest(path: string, method: "GET" | "POST" | "PUT" | "PATCH", payload?: object): Promise<Record<string, unknown>> {
  const response = await fetch(path, {
    method,
    cache: "no-store",
    credentials: "same-origin",
    ...(method !== "GET" ? { headers: { "content-type": "application/json" }, body: JSON.stringify(payload ?? {}) } : {}),
  });
  const data = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) throw new Error(response.status === 401 ? "Please sign in again, then return to Tap." : response.status === 404 && path === "/api/tap/claim" ? "This claim code is invalid, expired, or already used." : response.status === 404 ? "This Tap item is no longer available. Refresh and try again." : "Tap could not save that change. Try again.");
  return data;
}

function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  const [copyError, setCopyError] = useState(false);
  async function copy(value: string) {
    try { await navigator.clipboard.writeText(value); setCopied(value); setCopyError(false); window.setTimeout(() => setCopied((current) => current === value ? null : current), 2400); }
    catch { setCopyError(true); }
  }
  return { copied, copyError, copy };
}

export function TapExperience({ profile }: { profile: TapProfile }) {
  const [equipped, setEquipped] = useState<Equipped | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [quickUrl, setQuickUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [oneTime, setOneTime] = useState<{ url: string; label: string } | null>(null);
  const [confirmQuick, setConfirmQuick] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newKind, setNewKind] = useState<DeviceKind>("card");
  const [claimSecret, setClaimSecret] = useState("");
  const [showClaim, setShowClaim] = useState(false);
  const { copied, copyError, copy } = useCopy();

  const load = useCallback(async () => {
    const [stateResult, devicesResult, quickResult] = await Promise.allSettled([
      tapRequest("/api/tap/equipped", "GET"),
      tapRequest("/api/tap/devices", "GET"),
      tapRequest("/api/tap/quick-share", "POST"),
    ]);
    const state = stateResult.status === "fulfilled" ? stateResult.value.state : null;
    const deviceRows = devicesResult.status === "fulfilled" ? devicesResult.value.devices : null;
    const quick = quickResult.status === "fulfilled" ? safeTapUrl(quickResult.value.url, /^\/q\/[A-Za-z0-9_-]{43}$/) : null;
    setEquipped(isEquipped(state) ? state : null);
    setDevices(Array.isArray(deviceRows) && deviceRows.every(isDevice) ? deviceRows : []);
    setQuickUrl(quick);
    setError(!isEquipped(state) || !Array.isArray(deviceRows) || !deviceRows.every(isDevice)
      ? "Tap settings could not load. Try again."
      : !quick ? "Quick QR is unavailable. Your Equipped settings and devices can still be managed." : null);
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function changeEquipped(next: Equipped) {
    if (busy || !equipped || (next.mode === equipped.mode && next.intent === equipped.intent)) return;
    setBusy("equipped"); setError(null); setNotice(null);
    try {
      const response = await tapRequest("/api/tap/equipped", "PUT", next);
      if (!isEquipped(response.state)) throw new Error("Tap could not confirm the new setting. Refresh and try again.");
      setEquipped(response.state);
      setNotice(`${modeNames[response.state.mode]} is now equipped for ${response.state.intent === "view_profile" ? "viewing" : "meeting in person"}.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Tap could not save. Try again."); }
    finally { setBusy(null); }
  }

  async function refreshDevices() {
    const response = await tapRequest("/api/tap/devices", "GET");
    if (!Array.isArray(response.devices) || !response.devices.every(isDevice)) throw new Error("Your devices could not refresh. Reload this page.");
    setDevices(response.devices);
  }

  async function makeDevice(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const label = newLabel.trim();
    if (!label || label.length > 60 || busy) return;
    setBusy("create"); setError(null); setNotice(null); setOneTime(null);
    try {
      const result = await tapRequest("/api/tap/devices", "POST", { label, kind: newKind });
      const url = safeTapUrl(result.tapUrl, /^\/t\/[A-Za-z0-9_-]{43}$/);
      if (!url) throw new Error("The device was created, but its URL could not be shown. Rotate it to get a new URL.");
      setOneTime({ url, label }); setNewLabel(""); await refreshDevices();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Device could not be created. Try again."); }
    finally { setBusy(null); }
  }

  async function claimDevice(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const secret = claimSecret.trim();
    if (!/^[A-Za-z0-9_-]{43}$/.test(secret) || busy) { setError("Enter the full claim code supplied with your Tap."); return; }
    setBusy("claim"); setError(null);
    try {
      await tapRequest("/api/tap/claim", "POST", { claimSecret: secret });
      setClaimSecret(""); setShowClaim(false); await refreshDevices(); setNotice("Your Tap is claimed and ready.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "This claim code could not be used."); }
    finally { setBusy(null); }
  }

  async function rotateQuick() {
    if (busy) return;
    setBusy("quick"); setError(null); setNotice(null);
    try {
      const result = await tapRequest("/api/tap/quick-share/rotate", "POST");
      const url = safeTapUrl(result.url, /^\/q\/[A-Za-z0-9_-]{43}$/);
      if (!url) throw new Error("Quick QR changed, but its new URL could not be shown. Refresh this page.");
      setQuickUrl(url); setConfirmQuick(false); setNotice("Your previous Quick QR no longer opens. Use this new one.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Quick QR could not be replaced."); }
    finally { setBusy(null); }
  }

  async function shareQuick() {
    if (!quickUrl) return;
    if (!navigator.share) { await copy(quickUrl); return; }
    try {
      await navigator.share({ title: "My Setuvara", url: quickUrl });
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") return;
      await copy(quickUrl);
    }
  }

  const selected = profile.modes.find((mode) => mode.slug === equipped?.mode);
  const canOpen = profile.published && Boolean(selected?.enabled);
  const directPass = equipped?.intent === "connect_in_person" && selected?.connectPolicy === "direct_only";
  const connectBlocked = equipped?.intent === "connect_in_person" && selected?.connectPolicy === "nobody";

  return (
    <main className="mx-auto max-w-[1460px] px-4 pb-20 pt-6 sm:px-7 md:pb-12 md:pt-9 xl:px-10">
      <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link className="inline-flex min-h-11 items-center text-sm font-semibold text-black/60 underline-offset-4 hover:underline focus-visible:outline-2" href="/app">← Home</Link>
          <p className="mt-2 font-label text-[11px] uppercase tracking-[0.2em] text-black/55">SETUVARA / SHARE</p>
          <h1 className="font-display text-[clamp(44px,7vw,86px)] font-bold leading-[0.96] tracking-[-0.065em]">Your Tap.</h1>
          <p className="mt-3 max-w-2xl text-base leading-6 text-black/70 sm:text-lg">One identity, ready for the moment. Choose what people see when they scan or tap.</p>
        </div>
        <Link className="inline-flex min-h-11 items-center rounded-full border border-black/20 px-5 text-sm font-semibold hover:bg-white focus-visible:outline-2" href="/app/identity?section=share">Share a Mode →</Link>
      </div>

      {error && <div aria-live="assertive" className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#ff5a4f]/40 bg-[#ff5a4f]/10 p-4 text-sm font-semibold"><span>{error}</span><button className="min-h-11 underline underline-offset-4" onClick={() => { setLoading(true); setError(null); void load(); }} type="button">Retry</button></div>}
      {notice && <p aria-live="polite" className="mb-5 rounded-2xl bg-[#c7ff4a]/35 px-4 py-3 text-sm font-semibold">{notice}</p>}

      <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1.08fr)_minmax(380px,.92fr)] lg:gap-7">
        <section aria-label="Quick QR" className="relative min-w-0 overflow-hidden rounded-[30px] bg-[#0d0d0d] p-5 text-[#f5f4ef] sm:p-8 lg:min-h-[620px] lg:p-10">
          <div className="flex items-start justify-between gap-4">
            <div><p className="font-label text-[11px] uppercase tracking-[0.18em] text-[#c7ff4a]">ALWAYS READY</p><h2 className="mt-3 font-display text-4xl font-bold leading-none tracking-[-0.05em] sm:text-5xl">Quick QR</h2></div>
            <span className="rounded-full border border-white/25 px-3 py-2 font-label text-[10px] uppercase tracking-[0.1em]">FOLLOWS EQUIPPED</span>
          </div>
          <p className="mt-4 max-w-lg text-sm leading-6 text-white/70 sm:text-base">The QR stays the same when you switch Modes. Your next scan opens whichever Mode and intent are equipped now.</p>
          <div className="my-7 flex justify-center lg:my-9">
            <div className="grid aspect-square w-[min(100%,288px)] place-items-center rounded-[25px] bg-white p-5 text-[#0d0d0d] sm:w-[310px]">
              {quickUrl && !loading ? <QRCodeSVG aria-label="Setuvara Quick QR" bgColor="#FFFFFF" className="h-auto w-full" fgColor="#0D0D0D" level="H" marginSize={3} role="img" size={280} title="Setuvara Quick QR" value={quickUrl} /> : <p className="px-4 text-center text-sm text-black/60">{loading ? "Preparing your QR…" : "Your Quick QR is unavailable right now."}</p>}
            </div>
          </div>
          <p className="text-center text-[13px] text-white/60">{canOpen ? `${modeNames[equipped!.mode]} · ${directPass ? "Connect in person" : "Profile"}` : "Publish and enable the equipped Mode before sharing."}</p>
          <div className="mt-6 grid gap-2.5 sm:grid-cols-3">
            <button className="min-h-[52px] rounded-full bg-[#ff5a4f] px-5 text-sm font-bold text-[#0d0d0d] disabled:opacity-45" disabled={!quickUrl || !canOpen} onClick={() => quickUrl && void copy(quickUrl)} type="button">{copied === quickUrl ? "Copied" : "Copy Quick link"}</button>
            <button className="min-h-[52px] rounded-full border border-white/35 px-5 text-sm font-bold disabled:opacity-45" disabled={!quickUrl || !canOpen} onClick={() => void shareQuick()} type="button">Share link</button>
            <button className="min-h-[52px] rounded-full border border-white/35 px-5 text-sm font-bold disabled:opacity-45" disabled={!canOpen || loading || busy === "quick"} onClick={() => setConfirmQuick(true)} type="button">{busy === "quick" ? (quickUrl ? "Replacing…" : "Creating…") : quickUrl ? "Replace QR" : "Create new QR"}</button>
          </div>
          {confirmQuick && <div className="mt-4 rounded-2xl border border-white/25 p-4 text-sm leading-6"><p>{quickUrl ? "Replacing this QR stops any saved or printed copies from opening. You will need to share the new one." : "Create a new Quick QR for this identity. Any older saved or printed QR will stop working."}</p><div className="mt-3 flex flex-wrap gap-2"><button className="min-h-11 rounded-full bg-[#ff5a4f] px-5 font-semibold text-[#0d0d0d] disabled:opacity-45" disabled={Boolean(busy)} onClick={() => void rotateQuick()} type="button">{quickUrl ? "Replace it" : "Create new QR"}</button><button className="min-h-11 px-4 font-semibold" onClick={() => setConfirmQuick(false)} type="button">Cancel</button></div></div>}
          {copyError && <p className="mt-3 text-center text-sm text-white/75" role="status">Copy is unavailable in this browser. Open the link and copy it from the address bar.</p>}
          {quickUrl && canOpen && <a className="mt-3 block min-h-11 break-all text-center font-label text-xs leading-5 text-white/60 underline-offset-4 hover:underline" href={quickUrl} rel="noreferrer" target="_blank">Open your Quick link ↗</a>}
        </section>

        <section aria-labelledby="equipped-title" className="min-w-0 rounded-[30px] border border-black/10 bg-white p-5 sm:p-8 lg:p-10">
          <p className="font-label text-[11px] uppercase tracking-[0.18em] text-black/50">THE VERSION THEY MEET</p>
          <h2 className="mt-3 font-display text-4xl font-bold tracking-[-0.05em]" id="equipped-title">Equipped.</h2>
          <p className="mt-3 max-w-lg text-sm leading-6 text-black/65">This choice belongs to your identity. Every active Tap and your Quick QR follow it immediately.</p>

          <fieldset className="mt-8" disabled={Boolean(busy) || loading || !equipped}>
            <legend className="font-label text-[11px] font-bold uppercase tracking-[0.15em] text-black/55">CHOOSE A MODE</legend>
            <div className="mt-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
              {profile.modes.map((mode) => <button aria-pressed={equipped?.mode === mode.slug} className={`min-h-[74px] rounded-[18px] border px-4 py-3 text-left transition-colors focus-visible:outline-2 disabled:cursor-not-allowed disabled:opacity-45 ${equipped?.mode === mode.slug ? "border-[#0d0d0d] bg-[#0d0d0d] text-white" : "border-black/15 hover:border-black/50"}`} disabled={!mode.enabled} key={mode.slug} onClick={() => equipped && void changeEquipped({ mode: mode.slug, intent: mode.connectPolicy === "nobody" ? "view_profile" : equipped.intent })} type="button"><span aria-hidden="true" className="mr-2 inline-block size-2 rounded-full" style={{ backgroundColor: modeColors[mode.slug] }} /><span className="font-semibold">{modeNames[mode.slug]}</span><span className="mt-1 block text-xs opacity-65">{mode.enabled ? "Ready to share" : "Mode is off"}</span></button>)}
            </div>
          </fieldset>

          <fieldset className="mt-8" disabled={Boolean(busy) || loading || !equipped}>
            <legend className="font-label text-[11px] font-bold uppercase tracking-[0.15em] text-black/55">CHOOSE THE INTENT</legend>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <button aria-pressed={equipped?.intent === "view_profile"} className={`min-h-[88px] rounded-[18px] border p-4 text-left focus-visible:outline-2 ${equipped?.intent === "view_profile" ? "border-[#0d0d0d] bg-[#f5f4ef]" : "border-black/15"}`} onClick={() => equipped && void changeEquipped({ ...equipped, intent: "view_profile" })} type="button"><span className="block font-semibold">View profile</span><span className="mt-1 block text-xs leading-5 text-black/60">Open the equipped Mode. No special invitation to connect.</span></button>
              <button aria-pressed={equipped?.intent === "connect_in_person"} className={`min-h-[88px] rounded-[18px] border p-4 text-left focus-visible:outline-2 disabled:opacity-45 ${equipped?.intent === "connect_in_person" ? "border-[#0d0d0d] bg-[#f5f4ef]" : "border-black/15"}`} disabled={selected?.connectPolicy === "nobody"} onClick={() => equipped && void changeEquipped({ ...equipped, intent: "connect_in_person" })} type="button"><span className="block font-semibold">Connect in person</span><span className="mt-1 block text-xs leading-5 text-black/60">{selected?.connectPolicy === "direct_only" ? "Give a nearby visitor a short connection window." : selected?.connectPolicy === "nobody" ? "Turn on Connect in Mode settings first." : "Visitors can already connect on this Mode."}</span></button>
            </div>
          </fieldset>
          <div aria-live="polite" className="mt-7 border-t border-black/10 pt-5 text-sm leading-6 text-black/65">{loading ? "Loading your Equipped choice…" : equipped ? <>Now equipped: <strong className="text-black">{modeNames[equipped.mode]} · {equipped.intent === "view_profile" ? "View profile" : "Connect in person"}</strong>{busy === "equipped" ? " · Saving…" : " · Saved"}</> : "Your Equipped choice is unavailable right now."}</div>
          {connectBlocked && <p className="mt-4 rounded-2xl bg-[#ff5a4f]/10 p-4 text-sm leading-6">Connect is off for this Mode, so taps currently open the profile only. Choose View profile above or change this Mode’s Connect setting in Identity.</p>}
          {!profile.published && <p className="mt-5 rounded-2xl bg-[#ff5a4f]/10 p-4 text-sm leading-6">Your identity is still private. <Link className="font-semibold underline underline-offset-4" href="/app/identity?section=settings">Publish it in Identity</Link> when you are ready for taps to open it.</p>}
          {selected && !selected.enabled && <p className="mt-5 rounded-2xl bg-[#ff5a4f]/10 p-4 text-sm leading-6">This Mode is off. <Link className="font-semibold underline underline-offset-4" href={`/app/identity?mode=${selected.slug}&section=settings`}>Turn it on in Identity</Link> before sharing.</p>}
          <Link className="mt-6 inline-flex min-h-11 items-center text-sm font-semibold underline underline-offset-4" href={`/app/identity?mode=${equipped?.mode ?? "personal"}&section=settings`}>Edit this Mode’s visibility →</Link>
        </section>
      </div>

      <section aria-labelledby="devices-title" className="mt-8 border-t border-black/15 pt-8 sm:mt-12 sm:pt-10">
        <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="font-label text-[11px] uppercase tracking-[0.18em] text-black/50">PHYSICAL SETUVARA</p><h2 className="mt-2 font-display text-4xl font-bold tracking-[-0.05em]" id="devices-title">Your Taps.</h2></div><p className="max-w-md text-sm leading-6 text-black/60">A card, ring or sticker can open the same Equipped version of you.</p></div>
        <div className="mt-6 grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(320px,.45fr)]">
          <div className="min-w-0 space-y-3">
            {loading ? <p className="rounded-[24px] bg-white p-6 text-sm text-black/60">Loading your Taps…</p> : devices.length === 0 ? <div className="rounded-[24px] bg-white p-6 sm:p-8"><p className="font-display text-2xl font-bold tracking-[-0.04em]">No physical Taps yet.</p><p className="mt-2 text-sm leading-6 text-black/65">Your Quick QR is ready. Add a Tap when you want a card, ring or sticker to open it too.</p></div> : devices.map((device) => <DeviceCard busy={busy} device={device} key={device.id} onError={setError} onNotice={setNotice} onRefresh={refreshDevices} onSecret={(url) => setOneTime({ url, label: device.label })} setBusy={setBusy} />)}
          </div>
          <div className="min-w-0 self-start rounded-[24px] bg-[#eae7dd] p-5 sm:p-7">
            <h3 className="font-display text-2xl font-bold tracking-[-0.04em]">Add a Tap</h3>
            <p className="mt-2 text-sm leading-6 text-black/65">Create a URL for an NFC item you control. It appears once, ready to write to the item.</p>
            <form className="mt-5 space-y-3" onSubmit={(event) => void makeDevice(event)}>
              <label className="block text-sm font-semibold" htmlFor="tap-label">Name your Tap</label><input autoComplete="off" className="min-h-12 w-full rounded-[12px] border border-black/20 bg-white px-4 text-base outline-none focus:border-black" id="tap-label" maxLength={60} onChange={(event) => setNewLabel(event.target.value)} placeholder="My everyday card" required value={newLabel} />
              <label className="block text-sm font-semibold" htmlFor="tap-kind">What is it?</label><select className="min-h-12 w-full rounded-[12px] border border-black/20 bg-white px-4 text-base" id="tap-kind" onChange={(event) => setNewKind(event.target.value as DeviceKind)} value={newKind}>{kinds.map((kind) => <option key={kind} value={kind}>{kindNames[kind]}</option>)}</select>
              <button className="min-h-[52px] w-full rounded-full bg-[#0d0d0d] px-5 text-sm font-bold text-white disabled:opacity-45" disabled={Boolean(busy) || !newLabel.trim()} type="submit">{busy === "create" ? "Creating…" : "Create Tap URL"}</button>
            </form>
            <button aria-expanded={showClaim} className="mt-5 min-h-11 text-sm font-semibold underline underline-offset-4" onClick={() => setShowClaim((value) => !value)} type="button">Have a claim code?</button>
            {showClaim && <form className="mt-3 space-y-3" onSubmit={(event) => void claimDevice(event)}><p className="text-sm leading-6 text-black/65">Enter the one-time code supplied with a pre-provisioned Setuvara Tap.</p><label className="sr-only" htmlFor="tap-claim">Claim code</label><input autoComplete="off" className="min-h-12 w-full rounded-[12px] border border-black/20 bg-white px-4 font-label text-base" id="tap-claim" maxLength={43} onChange={(event) => setClaimSecret(event.target.value)} placeholder="Claim code" required type="password" value={claimSecret} /><button className="min-h-12 w-full rounded-full border border-black/30 text-sm font-bold disabled:opacity-45" disabled={Boolean(busy)} type="submit">{busy === "claim" ? "Claiming…" : "Claim this Tap"}</button></form>}
          </div>
        </div>
      </section>

      {oneTime && <OneTimeUrl label={oneTime.label} onClose={() => setOneTime(null)} url={oneTime.url} />}
    </main>
  );
}

function DeviceCard({ device, busy, setBusy, onRefresh, onError, onNotice, onSecret }: {
  device: Device; busy: string | null; setBusy: (value: string | null) => void; onRefresh: () => Promise<void>; onError: (value: string | null) => void; onNotice: (value: string | null) => void; onSecret: (url: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(device.label);
  const [kind, setKind] = useState<DeviceKind>(device.kind);
  const [confirm, setConfirm] = useState<"rotate" | "retired" | "lost" | null>(null);
  const labelId = useId();
  const kindId = useId();
  const working = busy === device.id;

  async function update(path: string, method: "PATCH" | "POST", payload: object, success: string) {
    if (busy) return;
    setBusy(device.id); onError(null); onNotice(null);
    try {
      const result = await tapRequest(path, method, payload);
      if (method === "POST") {
        const url = safeTapUrl(result.tapUrl, /^\/t\/[A-Za-z0-9_-]{43}$/);
        if (!url) throw new Error("The Tap URL changed, but could not be displayed. Rotate it again to get a new URL.");
        onSecret(url);
      }
      await onRefresh(); setEditing(false); setConfirm(null); onNotice(success);
    } catch (cause) { onError(cause instanceof Error ? cause.message : "Tap could not be updated. Try again."); }
    finally { setBusy(null); }
  }

  const base = `/api/tap/devices/${device.id}`;
  return (
    <article className="min-w-0 rounded-[24px] border border-black/10 bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-label text-[11px] uppercase tracking-[0.14em] text-black/50">{kindNames[device.kind]} · {statusNames[device.status]}</p><h3 className="mt-2 break-words font-display text-[27px] font-bold leading-8 tracking-[-0.04em]">{device.label}</h3></div><span aria-hidden="true" className={`size-3 rounded-full ${device.status === "active" ? "bg-[#c7ff4a]" : device.status === "disabled" ? "bg-[#ff5a4f]" : "bg-black/25"}`} /></div>
      <p className="mt-3 text-sm leading-6 text-black/60">{device.status === "active" ? "This Tap opens your current Equipped choice." : device.status === "disabled" ? "Paused. Its URL will not open until you turn it back on." : device.status === "lost" ? "Its URL no longer opens. Rotate to recover a Tap in your possession." : device.status === "retired" ? "Permanently retired. This Tap cannot be brought back." : "Claim this Tap to activate it."}</p>
      {device.lastTappedAt && <p className="mt-2 font-label text-xs text-black/50">Last tapped {new Date(device.lastTappedAt).toLocaleDateString()}</p>}
      {editing && device.status !== "retired" && <form className="mt-4 grid gap-3 border-t border-black/10 pt-4 sm:grid-cols-[1fr_150px_auto]" onSubmit={(event) => { event.preventDefault(); const clean = label.trim(); if (clean) void update(base, "PATCH", { label: clean, kind }, "Tap details saved."); }}><label className="sr-only" htmlFor={labelId}>Tap name</label><input className="min-h-11 min-w-0 rounded-xl border border-black/20 px-3 text-base" id={labelId} maxLength={60} onChange={(event) => setLabel(event.target.value)} required value={label} /><label className="sr-only" htmlFor={kindId}>Tap type</label><select className="min-h-11 rounded-xl border border-black/20 px-3 text-base" id={kindId} onChange={(event) => setKind(event.target.value as DeviceKind)} value={kind}>{kinds.map((item) => <option key={item} value={item}>{kindNames[item]}</option>)}</select><button className="min-h-11 rounded-full bg-[#0d0d0d] px-5 text-sm font-semibold text-white disabled:opacity-45" disabled={Boolean(busy)} type="submit">{working ? "Saving…" : "Save"}</button></form>}
      {confirm && <div className="mt-4 rounded-2xl bg-[#ff5a4f]/10 p-4"><p className="text-sm leading-6">{confirm === "rotate" ? "Replace this Tap URL? The previous URL will stop working immediately. Save the new URL when it appears." : confirm === "lost" ? "Mark this Tap lost? Its current URL will stop working. You can only recover it by rotating to a new URL." : "Retire this Tap permanently? Its URL will stop working and the device cannot be restored."}</p><div className="mt-3 flex flex-wrap gap-2"><button className="min-h-11 rounded-full bg-[#0d0d0d] px-5 text-sm font-semibold text-white disabled:opacity-45" disabled={Boolean(busy)} onClick={() => void update(confirm === "rotate" ? `${base}/rotate` : `${base}/status`, confirm === "rotate" ? "POST" : "PATCH", confirm === "rotate" ? {} : { status: confirm }, confirm === "rotate" ? "New Tap URL is ready." : confirm === "lost" ? "Tap marked lost." : "Tap retired.")} type="button">{working ? "Working…" : "Continue"}</button><button className="min-h-11 px-4 text-sm font-semibold" onClick={() => setConfirm(null)} type="button">Cancel</button></div></div>}
      {device.status !== "retired" && <div className="mt-5 flex flex-wrap gap-x-5 gap-y-1 border-t border-black/10 pt-3 text-sm font-semibold"><button className="min-h-11 underline-offset-4 hover:underline disabled:opacity-45" disabled={Boolean(busy)} onClick={() => { if (!editing) { setLabel(device.label); setKind(device.kind); } setEditing((value) => !value); setConfirm(null); }} type="button">{editing ? "Cancel edit" : "Rename"}</button>{device.status === "active" && <button className="min-h-11 underline-offset-4 hover:underline disabled:opacity-45" disabled={Boolean(busy)} onClick={() => void update(`${base}/status`, "PATCH", { status: "disabled" }, "Tap paused.")} type="button">Pause</button>}{device.status === "disabled" && <button className="min-h-11 underline-offset-4 hover:underline disabled:opacity-45" disabled={Boolean(busy)} onClick={() => void update(`${base}/status`, "PATCH", { status: "active" }, "Tap is active again.")} type="button">Turn on</button>}<button className="min-h-11 underline-offset-4 hover:underline disabled:opacity-45" disabled={Boolean(busy)} onClick={() => { setConfirm("rotate"); setEditing(false); }} type="button">{device.status === "lost" ? "Recover with new URL" : "Rotate URL"}</button>{device.status !== "lost" && <button className="min-h-11 underline-offset-4 hover:underline disabled:opacity-45" disabled={Boolean(busy)} onClick={() => { setConfirm("lost"); setEditing(false); }} type="button">Mark lost</button>}<button className="min-h-11 text-black/55 underline-offset-4 hover:underline disabled:opacity-45" disabled={Boolean(busy)} onClick={() => { setConfirm("retired"); setEditing(false); }} type="button">Retire</button></div>}
    </article>
  );
}

function OneTimeUrl({ url, label, onClose }: { url: string; label: string; onClose: () => void }) {
  const { copied, copyError, copy } = useCopy();
  const titleId = useId();
  const panel = useRef<HTMLElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    close.current?.focus();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); onClose(); }
      if (event.key !== "Tab") return;
      const items = [...(panel.current?.querySelectorAll<HTMLElement>("button:not(:disabled)") ?? [])];
      if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); items.at(-1)?.focus(); }
      else if (!event.shiftKey && document.activeElement === items.at(-1)) { event.preventDefault(); items[0]?.focus(); }
    };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = previous; window.removeEventListener("keydown", onKey); };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[80] grid place-items-end bg-[#0d0d0d]/70 p-0 sm:place-items-center sm:p-5" role="presentation">
      <section aria-labelledby={titleId} aria-modal="true" className="max-h-[94dvh] w-full max-w-lg overflow-y-auto rounded-t-[28px] bg-[#f5f4ef] p-5 pb-[calc(24px+env(safe-area-inset-bottom))] sm:rounded-[28px] sm:p-8" ref={panel} role="dialog">
        <p className="font-label text-[11px] uppercase tracking-[0.18em] text-black/55">SAVE THIS ONCE</p>
        <h2 className="mt-3 font-display text-3xl font-bold tracking-[-0.05em]" id={titleId}>{label} is ready.</h2>
        <p className="mt-3 text-sm leading-6 text-black/65">Write this URL to your NFC item or save it somewhere you control. For safety, this exact URL is only shown now. You can rotate it later.</p>
        <div className="mx-auto my-6 w-[min(100%,240px)] rounded-[20px] bg-white p-4"><QRCodeSVG aria-label="One-time Tap URL QR" bgColor="#FFFFFF" className="h-auto w-full" fgColor="#0D0D0D" level="H" marginSize={3} role="img" size={220} value={url} /></div>
        <p className="break-all rounded-xl bg-white p-4 font-label text-xs leading-5">{url}</p>
        {copyError && <p className="mt-2 text-sm" role="status">Copy is unavailable. Select the URL above to save it.</p>}
        <div className="mt-5 grid gap-2 sm:grid-cols-2"><button className="min-h-[52px] rounded-full bg-[#ff5a4f] px-4 text-sm font-bold" onClick={() => void copy(url)} type="button">{copied === url ? "Copied" : "Copy URL"}</button><button className="min-h-[52px] rounded-full border border-black/30 px-4 text-sm font-bold" onClick={onClose} ref={close} type="button">Done</button></div>
      </section>
    </div>
  );
}
