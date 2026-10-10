"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type WalletState = {
  walletPubliclyLaunched: boolean;
  providers?: {
    apple: { available: boolean; status: "ready" | "setup_required" };
    google: { available: boolean; status: "ready" | "setup_required" };
  };
  canUseWallet?: boolean;
  canUsePremiumAppearance?: boolean;
  profile: {
    username: string;
    displayName: string;
    mode: "personal" | "event" | "business";
    modeEnabled: boolean;
    published: boolean;
  };
  pass?: { exists: boolean; appearance: "classic" | "editorial" };
};

const modeLabel = { personal: "Personal", event: "Event", business: "Business" } as const;

export function WalletExperience({ walletPubliclyLaunched }: { walletPubliclyLaunched: boolean }) {
  const [state, setState] = useState<WalletState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/wallet", { cache: "no-store" });
      const data = await response.json() as WalletState;
      if (!response.ok) throw new Error("Wallet could not load.");
      setState(data);
      setNotice(null);
    } catch {
      setNotice("Wallet is taking a moment. Refresh to try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  function retryLoad() {
    setLoading(true);
    setNotice(null);
    void load();
  }

  async function addGooglePass() {
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch("/api/wallet/google", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      const data = await response.json() as { saveUrl?: string };
      if (!response.ok || !data.saveUrl) throw new Error("Google Wallet could not open.");
      window.location.assign(data.saveUrl);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Google Wallet could not open.");
      setBusy(false);
    }
  }

  async function saveAppearance(appearance: "classic" | "editorial") {
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch("/api/wallet/appearance", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ appearance }),
      });
      if (!response.ok) throw new Error(response.status === 403 ? "Editorial appearance is part of Setuvara Plus." : "Appearance could not be saved.");
      await load();
      setNotice("Wallet appearance saved.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Appearance could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  async function refreshSavedPasses() {
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch("/api/wallet/sync", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      if (!response.ok) throw new Error("Saved passes could not be updated right now.");
      setNotice("Saved Wallet passes are up to date.");
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Saved passes could not be updated right now.");
    } finally {
      setBusy(false);
    }
  }

  const profileReady = state?.profile.published && state.profile.modeEnabled;
  const canAdd = Boolean(state?.canUseWallet && profileReady);
  const anyProvider = Boolean(state?.providers?.apple.available || state?.providers?.google.available);

  if (!walletPubliclyLaunched) {
    return <ComingSoonWallet loading={loading} notice={notice} onRetry={retryLoad} state={state} />;
  }

  return (
    <main className="mx-auto min-h-[calc(100dvh-60px)] w-full max-w-[1440px] px-4 py-6 text-[#0d0d0d] sm:px-6 md:min-h-[calc(100dvh-76px)] md:px-8 md:py-10">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(340px,.85fr)] lg:gap-8">
        <section className="flex min-w-0 flex-col justify-between overflow-hidden rounded-[28px] bg-[#0d0d0d] p-6 text-[#f5f4ef] sm:p-8 lg:min-h-[470px] lg:p-10">
          <div>
            <p className="font-label text-[11px] uppercase tracking-[0.22em] text-[#c7ff4a]">Setuvara Wallet</p>
            <h1 className="mt-5 max-w-[620px] font-display text-4xl font-semibold leading-[1.02] tracking-[-0.055em] sm:text-5xl lg:text-6xl">Your identity, ready when you are.</h1>
            <p className="mt-5 max-w-[560px] text-base leading-7 text-white/70 sm:text-lg">One Setuvara pass. One QR. It follows the Mode you have Equipped, so the right version of you is always ready to share.</p>
          </div>

          <div className="mt-12 flex flex-wrap items-end justify-between gap-6 border-t border-white/15 pt-5">
            <div>
              <p className="font-label text-[10px] uppercase tracking-[0.18em] text-white/50">Currently Equipped</p>
              {loading ? <p className="mt-2 h-7 w-32 animate-pulse rounded-full bg-white/10" /> : state && <p className="mt-2 text-xl font-semibold">{modeLabel[state.profile.mode]} Mode</p>}
            </div>
            <Link className="inline-flex min-h-11 items-center rounded-full border border-white/25 px-4 text-sm font-semibold transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c7ff4a]" href="/app/tap">Change Equipped Mode <span aria-hidden="true" className="ml-2">↗</span></Link>
          </div>
        </section>

        <section aria-labelledby="wallet-status-heading" className="min-w-0 rounded-[28px] bg-white p-6 shadow-[0_0_0_1px_rgba(13,13,13,.08)] sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-label text-[10px] uppercase tracking-[0.2em] text-black/50">Your pass</p>
              <h2 className="mt-2 font-display text-2xl font-semibold tracking-[-0.035em] sm:text-3xl" id="wallet-status-heading">{loading ? "Getting things ready" : state?.profile.displayName ?? "Setuvara Wallet"}</h2>
              {state && <p className="mt-1 text-sm text-black/60">setuvara.com/{state.profile.username}</p>}
            </div>
            <span aria-hidden="true" className="grid size-12 shrink-0 place-items-center rounded-full bg-[#f5f4ef] text-xl">S</span>
          </div>

          {!loading && state && !state.profile.published && (
            <p className="mt-6 rounded-2xl bg-[#ff5a4f]/10 p-4 text-sm leading-6">Publish your identity before adding it to Wallet. <Link className="font-semibold underline underline-offset-4" href="/app/identity?section=settings">Open Identity settings</Link></p>
          )}
          {!loading && state && state.profile.published && !state.profile.modeEnabled && (
            <p className="mt-6 rounded-2xl bg-[#ff5a4f]/10 p-4 text-sm leading-6">Your Equipped Mode is turned off. Turn it on in Identity settings before sharing it from Wallet. <Link className="font-semibold underline underline-offset-4" href={`/app/identity?mode=${state.profile.mode}&section=settings`}>Open Mode settings</Link></p>
          )}

          <div className="mt-7 space-y-3">
            <ProviderRow
              available={Boolean(state?.providers?.apple.available)}
              canAdd={Boolean(canAdd && state?.providers?.apple.available)}
              description={state?.providers?.apple.available ? "A signed pass with the live Setuvara QR." : "Apple pass signing and update service setup is required."}
              label="Apple Wallet"
              href="/api/wallet/apple"
              verb="Add pass"
            />
            <ProviderRow
              available={Boolean(state?.providers?.google.available)}
              canAdd={Boolean(canAdd && state?.providers?.google.available)}
              description={state?.providers?.google.available ? "A Google Wallet pass that stays linked to your identity." : "A Google Wallet issuer and approved class are required."}
              label="Google Wallet"
              onClick={() => void addGooglePass()}
              verb={busy ? "Opening…" : "Add pass"}
            />
          </div>

          {!loading && state && !anyProvider && <p className="mt-5 text-sm leading-6 text-black/60">Wallet provider setup is not complete yet. Your identity and Quick QR stay ready; add a provider to enable pass downloads.</p>}
          {notice && <p aria-live="polite" className="mt-4 rounded-xl bg-[#f5f4ef] px-4 py-3 text-sm text-black/75">{notice}</p>}

          <div className="mt-7 border-t border-black/10 pt-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-label text-[10px] uppercase tracking-[0.18em] text-black/50">Appearance</p>
                <p className="mt-1 text-sm text-black/70">A calm Setuvara finish, kept simple.</p>
              </div>
              {state?.pass?.exists && anyProvider && <button className="min-h-11 shrink-0 rounded-full px-3 text-xs font-semibold underline underline-offset-4 disabled:opacity-50" disabled={busy} onClick={() => void refreshSavedPasses()} type="button">Refresh saved passes</button>}
            </div>
            <div aria-label="Wallet appearance" className="mt-4 grid grid-cols-2 gap-2" role="group">
              <AppearanceChoice active={!loading && state?.pass?.appearance === "classic"} disabled={loading || busy} label="Setuvara" onClick={() => void saveAppearance("classic")} />
              <AppearanceChoice active={!loading && state?.pass?.appearance === "editorial"} disabled={loading || busy || !state?.canUsePremiumAppearance} label="Editorial · Plus" onClick={() => void saveAppearance("editorial")} />
            </div>
            {!loading && !state?.canUsePremiumAppearance && <p className="mt-3 text-xs leading-5 text-black/55">Editorial appearance is included with Plus and Pro. <Link className="font-semibold underline underline-offset-4" href="/pricing">See plans</Link></p>}
          </div>
        </section>
      </div>
      {!state && !loading && <p aria-live="polite" className="mt-6 text-sm text-black/65">Wallet is taking a moment. <button className="font-semibold underline underline-offset-4" onClick={retryLoad} type="button">Try again</button></p>}
    </main>
  );
}

function ComingSoonWallet({ loading, notice, onRetry, state }: {
  loading: boolean;
  notice: string | null;
  onRetry: () => void;
  state: WalletState | null;
}) {
  return (
    <main className="mx-auto min-h-[calc(100dvh-60px)] w-full max-w-[1440px] px-4 py-6 text-[#0d0d0d] sm:px-6 md:min-h-[calc(100dvh-76px)] md:px-8 md:py-10">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(340px,.85fr)] lg:gap-8">
        <section className="flex min-w-0 flex-col justify-between overflow-hidden rounded-[28px] bg-[#0d0d0d] p-6 text-[#f5f4ef] sm:p-8 lg:min-h-[470px] lg:p-10">
          <div>
            <p className="font-label text-[11px] uppercase tracking-[0.22em] text-[#c7ff4a]">Setuvara Wallet</p>
            <h1 className="mt-5 max-w-[620px] font-display text-4xl font-semibold leading-[1.02] tracking-[-0.055em] sm:text-5xl lg:text-6xl">Your identity, ready when you are.</h1>
            <p className="mt-5 max-w-[560px] text-base leading-7 text-white/70 sm:text-lg">One Setuvara pass. One QR. It follows the Mode you have Equipped, so the right version of you is always ready to share.</p>
          </div>

          <div className="mt-12 flex flex-wrap items-end justify-between gap-6 border-t border-white/15 pt-5">
            <div>
              <p className="font-label text-[10px] uppercase tracking-[0.18em] text-white/50">Currently Equipped</p>
              {loading ? <p className="mt-2 h-7 w-32 animate-pulse rounded-full bg-white/10" /> : state ? <p className="mt-2 text-xl font-semibold">{modeLabel[state.profile.mode]} Mode</p> : <p className="mt-2 text-sm text-white/70">Your Setuvara Mode</p>}
            </div>
            <Link className="inline-flex min-h-11 items-center rounded-full border border-white/25 px-4 text-sm font-semibold transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c7ff4a]" href="/app/tap">Change Equipped Mode <span aria-hidden="true" className="ml-2">↗</span></Link>
          </div>
        </section>

        <section aria-labelledby="wallet-status-heading" className="min-w-0 rounded-[28px] bg-white p-6 shadow-[0_0_0_1px_rgba(13,13,13,.08)] sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="font-label text-[10px] uppercase tracking-[0.2em] text-black/50">Your pass</p>
              <h2 className="mt-2 break-words font-display text-2xl font-semibold tracking-[-0.035em] sm:text-3xl" id="wallet-status-heading">{loading ? "Getting things ready" : state?.profile.displayName ?? "Your Setuvara"}</h2>
              {state && <p className="mt-1 break-all text-sm text-black/60">setuvara.com/{state.profile.username}</p>}
            </div>
            <span className="inline-flex min-h-9 shrink-0 items-center rounded-full bg-[#ff5a4f]/12 px-3 font-label text-[10px] font-semibold uppercase tracking-[0.14em] text-[#a92c27]">Coming soon</span>
          </div>

          <div className="mt-7 border-t border-black/10 pt-6">
            <h3 className="font-display text-xl font-semibold tracking-[-0.025em]">Apple Wallet + Google Wallet</h3>
            <p className="mt-2 text-sm leading-6 text-black/65">Carry your Setuvara identity with you. Your pass follows whatever Mode and sharing intent you have Equipped.</p>
          </div>

          <ul aria-label="What your Wallet pass will include" className="mt-6 grid gap-3 text-sm text-black/75 sm:grid-cols-2">
            {["One identity pass", "The same stable QR", "Personal, Event and Business", "Follows Equipped automatically"].map((feature) => (
              <li className="flex min-w-0 items-start gap-2.5" key={feature}>
                <span aria-hidden="true" className="mt-[0.48rem] size-1.5 shrink-0 rounded-full bg-[#ff5a4f]" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>

          <div className="mt-7 flex flex-col gap-4 border-t border-black/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold">Quick QR remains ready today.</p>
              <p className="mt-1 text-sm leading-5 text-black/60">Share the Mode you have Equipped.</p>
            </div>
            <Link className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-[#0d0d0d] px-5 text-sm font-semibold text-[#f5f4ef] transition hover:bg-black/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff5a4f]" href="/app/tap">Use Quick QR <span aria-hidden="true">↗</span></Link>
          </div>

          {notice && <p aria-live="polite" className="mt-4 rounded-xl bg-[#f5f4ef] px-4 py-3 text-sm text-black/75">{notice} <button className="ml-1 font-semibold underline underline-offset-4 focus-visible:outline-2" onClick={onRetry} type="button">Try again</button></p>}
        </section>
      </div>
    </main>
  );
}

function ProviderRow({ label, description, available, canAdd, verb, onClick, href }: {
  label: string;
  description: string;
  available: boolean;
  canAdd: boolean;
  verb: string;
  onClick?: () => void;
  href?: string;
}) {
  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-black/10 p-4 sm:p-5">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h3 className="font-semibold">{label}</h3>
          <span className={`font-label text-[9px] uppercase tracking-[0.16em] ${available ? "text-[#12654e]" : "text-black/45"}`}>{available ? "Configured" : "Setup needed"}</span>
        </div>
        <p className="mt-1 text-xs leading-5 text-black/60 sm:text-sm">{description}</p>
      </div>
      {canAdd ? href ? (
        <a className="inline-flex min-h-11 items-center whitespace-nowrap rounded-full bg-[#ff5a4f] px-4 text-xs font-semibold transition hover:bg-[#f34f45] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0d0d0d]" href={href}>{verb}</a>
      ) : (
        <button className="min-h-11 whitespace-nowrap rounded-full bg-[#ff5a4f] px-4 text-xs font-semibold transition hover:bg-[#f34f45] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0d0d0d] disabled:opacity-50" onClick={onClick} type="button">{verb}</button>
      ) : (
        <span className="rounded-full bg-[#f5f4ef] px-3 py-2 text-[10px] font-semibold text-black/55">Unavailable</span>
      )}
    </div>
  );
}

function AppearanceChoice({ active, disabled, label, onClick }: { active: boolean; disabled: boolean; label: string; onClick: () => void }) {
  return (
    <button aria-pressed={active} className={`min-h-12 rounded-2xl border px-3 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0d0d0d] disabled:cursor-not-allowed disabled:opacity-45 ${active ? "border-[#0d0d0d] bg-[#0d0d0d] text-[#f5f4ef]" : "border-black/15 bg-white hover:bg-[#f5f4ef]"}`} disabled={disabled} onClick={onClick} type="button">{label}</button>
  );
}
