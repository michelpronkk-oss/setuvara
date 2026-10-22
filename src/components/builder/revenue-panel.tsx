"use client";

import { confirmDialog } from "@/components/app/confirm-dialog";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { PulseLine } from "@/components/app/pulse";
import { coralButton, lineButton } from "@/components/creator/studio-ui";
import type { RevenueVisibility } from "@/lib/builder/model";
import { connectRevenue, disconnectRevenue, setRevenueHistory, syncRevenueNow } from "@/lib/revenue/actions";
import { createClient } from "@/lib/supabase/client";

import { money, PROVIDER_LABEL } from "./verified-revenue";

export type RevenueConnection = { id: string; project_id: string; provider: "stripe" | "revenuecat" | "dodo" | "paddle"; environment: "live" | "test"; account_ref: string | null; key_hint: string; status: "active" | "error" | "revoked"; last_sync_at: string | null; last_sync_ok: boolean | null; last_error: string | null; history_mode: "daily" | "reconstructed" };
export type RevenueSnapshot = { connection_id: string; day: string; currency: string; mrr_minor: number; paying_customers: number; active_subscriptions: number; reconstructed: boolean };
export type RevenueLimits = { plan: "free" | "plus" | "pro"; providers: number; history_days: number };

const card = "rounded-[24px] bg-white p-5 shadow-[inset_0_0_0_1px_rgba(13,13,13,.08)]";
const field = "min-h-12 w-full rounded-[16px] bg-white px-4 text-[16px] shadow-[inset_0_0_0_1px_rgba(13,13,13,.14)] outline-none focus:shadow-[inset_0_0_0_1.5px_#0D0D0D]";
const AVAILABLE = ["stripe", "paddle", "revenuecat", "dodo"] as const;
const KEY_HELP: Record<string, string> = {
  stripe: "In Stripe, Developers → API keys → Create restricted key. Set Subscriptions, Customers and Prices to Read, everything else to None.",
  revenuecat: "In RevenueCat, Project settings → API keys → New secret API key, version 2. Set Charts & metrics to Read only, everything else to No access. MRR and active subscriptions come from RevenueCat's own overview, in USD.",
  paddle: "In Paddle, Developer tools → Authentication → API keys → New API key. Give it Subscriptions: Read only. A sandbox key connects as test data, which is never shown publicly.",
  dodo: "In Dodo Payments, Developer → API Keys → Create key. Give it Subscriptions: Read only. A test-mode key connects as test data, which is never shown publicly.",
};
const PLACEHOLDER: Record<string, string> = { stripe: "rk_live_…", revenuecat: "sk_…", dodo: "Dodo Payments API key", paddle: "pdl_live_apikey_…" };
const VISIBILITY: { value: RevenueVisibility; label: string; note: string }[] = [
  { value: "hidden", label: "Hidden", note: "Only you see it." },
  { value: "exact", label: "Exact", note: "MRR, ARR and paying customers." },
  { value: "range", label: "Range", note: "A rounded band, like 1k–5k." },
  { value: "growth", label: "Growth only", note: "The 30-day change, no amounts." },
];
const ago = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "never");

/** Connect a provider with a read-only key, choose what the public sees, and follow the daily snapshots. */
export function RevenuePanel({ projectId, visibility, connections, snapshots, limits }: { projectId: string; visibility: RevenueVisibility; connections: RevenueConnection[]; snapshots: RevenueSnapshot[]; limits: RevenueLimits }) {
  const router = useRouter();
  const [picked, setProvider] = useState<(typeof AVAILABLE)[number]>("stripe");
  const [key, setKey] = useState("");
  const [projectRef, setProjectRef] = useState("");
  const [message, setMessage] = useState("");
  const [pending, start] = useTransition();
  const [now] = useState(() => Date.now());
  const mine = connections.filter((c) => c.project_id === projectId && c.status !== "revoked");
  const used = connections.filter((c) => c.status !== "revoked").length;
  const connected = (p: string) => mine.some((c) => c.provider === p);
  // A provider already on this project can't be added twice; fall to the next free one.
  const provider = connected(picked) ? (AVAILABLE.find((p) => !connected(p)) ?? picked) : picked;
  const canAdd = used < limits.providers && AVAILABLE.some((p) => !mine.some((c) => c.provider === p));
  const fresh = (c: RevenueConnection) => c.last_sync_ok && c.last_sync_at && now - new Date(c.last_sync_at).getTime() < 48 * 3600_000;

  return (
    <section aria-label="Verified revenue" className={`${card} grid gap-4`}>
      <div>
        <h2 className="font-display text-[22px] font-bold tracking-[-0.03em]">Verified revenue</h2>
        <p className="mt-1 text-[14px] text-black/60">Numbers come straight from your payment provider with a read-only key, synced daily. You can&apos;t type them in, and nobody sees them unless you choose to show them.</p>
      </div>

      {limits.providers === 0 ? (
        <p className="rounded-[16px] bg-black/[.04] p-4 text-[14px]">Verified revenue is part of Plus (1 provider, 12 months of history) and Pro (up to 3 providers, longer history). <Link className="font-semibold underline" href="/app/upgrade">See plans</Link></p>
      ) : null}

      {mine.map((c) => {
        const rows = snapshots.filter((s) => s.connection_id === c.id);
        const currencies = [...new Set(rows.map((r) => r.currency))];
        return (
          <div className="grid gap-3 rounded-[18px] p-4 shadow-[inset_0_0_0_1px_rgba(13,13,13,.08)]" key={c.id}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold">{PROVIDER_LABEL[c.provider]} <span className="font-mono text-[12px] text-black/50">{c.key_hint}</span></p>
              <div className="flex flex-wrap gap-1.5 text-[12px] font-semibold">
                {c.environment === "test" && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-900">Test data, never shown publicly</span>}
                <span className={`rounded-full px-2 py-0.5 ${fresh(c) ? "bg-emerald-100 text-emerald-900" : "bg-black/[.06] text-black/70"}`}>{fresh(c) ? "Verified" : c.last_sync_ok === false ? "Sync failed" : "Not current"}</span>
              </div>
            </div>
            <p className="text-[13px] text-black/60">Last sync {ago(c.last_sync_at)}{c.last_error ? `: ${c.last_error}` : ""}</p>
            {c.provider === "stripe" && (
              <label className="grid gap-1.5 text-[13px] font-semibold">History
                <select className={field} disabled={pending} onChange={(e) => { const mode = e.target.value as RevenueConnection["history_mode"]; start(async () => {
                  const r = await setRevenueHistory(c.id, mode);
                  setMessage(r.ok ? (mode === "reconstructed" ? "Past months rebuilt from Stripe history, labelled as reconstructed." : "Showing daily measurements only.") : r.error);
                  router.refresh();
                }); }} value={c.history_mode}>
                  <option value="daily">Daily measurements only</option>
                  <option value="reconstructed">Include past months, reconstructed from Stripe history</option>
                </select>
                <span className="font-normal text-black/55">Reconstructed months use today&apos;s prices and are labelled on your page. Daily measurements start the day you connect.</span>
              </label>
            )}
            {currencies.length === 0 && c.last_sync_ok && (
              <p className="text-[14px] tabular-nums"><b>{money(0, "eur")}</b> MRR · {money(0, "eur")} ARR · 0 subscriptions <span className="text-black/50">· figures appear with the first paying subscription</span></p>
            )}
            {currencies.map((currency) => <Trend currency={currency} key={currency} rows={rows.filter((r) => r.currency === currency)} />)}
            <div className="flex flex-wrap gap-2">
            <button className={lineButton} disabled={pending} onClick={() => start(async () => { const r = await syncRevenueNow(c.id); setMessage(r.ok ? "Synced." : r.error); router.refresh(); })} type="button">{pending ? "Syncing…" : "Sync now"}</button>
            <button className={lineButton} disabled={pending} onClick={async () => { if (await confirmDialog({ title: `Disconnect ${PROVIDER_LABEL[c.provider]}?`, body: "The key is deleted. Past snapshots stay visible to you only.", action: "Disconnect", tone: "danger" })) start(async () => { const r = await disconnectRevenue(c.id); setMessage(r.ok ? "Disconnected. Also delete the key in your provider's dashboard." : r.error); router.refresh(); }); }} type="button">Disconnect</button>
            </div>
          </div>
        );
      })}

      {limits.providers > 0 && used >= limits.providers && (
        <p className="rounded-[16px] bg-black/[.04] p-4 text-[14px]">Your plan connects {limits.providers === 1 ? "one provider" : `${limits.providers} providers`} at a time: Stripe, Paddle, RevenueCat or Dodo Payments. Disconnect one to switch{limits.plan === "plus" ? <>, or <Link className="font-semibold underline" href="/app/upgrade">move to Pro</Link> for up to 3</> : ""}.</p>
      )}

      {canAdd && (
        <form className="grid gap-3" onSubmit={(event) => { event.preventDefault(); start(async () => {
          const r = await connectRevenue(projectId, provider, provider === "revenuecat" ? `${projectRef.trim()}:${key.trim()}` : key);
          setKey("");
          setMessage(r.ok ? (r.environment === "test" ? "Connected in test mode. Test data stays private." : "Connected. First numbers are in.") : r.error);
          router.refresh();
        }); }}>
          <label className="grid gap-1.5 text-[14px] font-semibold">Provider
            <select className={field} onChange={(e) => { setProvider(e.target.value as typeof provider); setKey(""); }} value={provider}>
              <option disabled={connected("stripe")} value="stripe">Stripe</option>
              <option disabled={connected("paddle")} value="paddle">Paddle</option>
              <option disabled={connected("revenuecat")} value="revenuecat">RevenueCat</option>
              <option disabled={connected("dodo")} value="dodo">Dodo Payments</option>
            </select>
          </label>
          {provider === "revenuecat" && (
            <label className="grid gap-1.5 text-[14px] font-semibold">Project ID
              <input autoComplete="off" className={field} onChange={(e) => setProjectRef(e.target.value)} placeholder="proj1a2b3c4d" required spellCheck={false} value={projectRef} />
            </label>
          )}
          <label className="grid gap-1.5 text-[14px] font-semibold">Read-only key
            <input autoComplete="off" className={field} onChange={(e) => setKey(e.target.value)} placeholder={PLACEHOLDER[provider]} required spellCheck={false} type="password" value={key} />
          </label>
          <p className="text-[13px] text-black/60">{KEY_HELP[provider]} We check the key can&apos;t write before accepting it, and keep it encrypted, readable only by the sync.</p>
          <button className={`${coralButton} w-fit`} disabled={pending || key.trim().length < 20} type="submit">{pending ? "Checking…" : "Connect"}</button>
        </form>
      )}

      {mine.length > 0 && (
        <fieldset className="grid gap-2">
          <legend className="mb-1 text-[14px] font-semibold">On your public page</legend>
          {VISIBILITY.map((v) => (
            <label className="flex items-start gap-2 text-[14px]" key={v.value}>
              <input checked={visibility === v.value} className="mt-1" disabled={pending} name="revenue_visibility" onChange={() => start(async () => {
                const { error } = await createClient().from("builder_projects").update({ revenue_visibility: v.value }).eq("id", projectId);
                setMessage(error ? "That didn't save. Try again." : "Saved."); router.refresh();
              })} type="radio" />
              <span><b>{v.label}</b> <span className="text-black/60">{v.note}</span></span>
            </label>
          ))}
          <p className="text-[12.5px] text-black/55">Only live data with a sync in the last 48 hours shows, labelled with its provider. Customer details are never shown.</p>
        </fieldset>
      )}
      {message && <p className="text-[14px] text-black/70" role="status">{message}</p>}
    </section>
  );
}

function Trend({ rows, currency }: { rows: RevenueSnapshot[]; currency: string }) {
  const sorted = [...rows].sort((a, b) => a.day.localeCompare(b.day));
  const last = sorted.at(-1)!;
  return (
    <div className="grid gap-1 rounded-[20px] bg-[#0D0D0D] p-4 text-[#F5F4EF]">
      {sorted.some((r) => r.reconstructed) && <p className="text-[12px] text-[#F5F4EF]/55">Includes months reconstructed from Stripe history.</p>}
      <p className="text-[14px] tabular-nums"><b>{money(last.mrr_minor, currency)}</b> MRR · {money(last.mrr_minor * 12, currency)} ARR · {last.paying_customers} paying</p>
      <div className="mt-8"><PulseLine className="h-20" label={`MRR in ${currency.toUpperCase()} over ${sorted.length} days`} points={sorted.map((r) => ({ date: r.day, value: Math.round(r.mrr_minor / 100), notes: [`${r.paying_customers} paying`] }))} tone="#C7FF4A" unit={[`${currency.toUpperCase()} MRR`, `${currency.toUpperCase()} MRR`]} /></div>
    </div>
  );
}
