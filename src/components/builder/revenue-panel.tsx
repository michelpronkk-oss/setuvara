"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { coralButton, lineButton } from "@/components/creator/studio-ui";
import type { RevenueVisibility } from "@/lib/builder/model";
import { connectRevenue, disconnectRevenue, syncRevenueNow } from "@/lib/revenue/actions";
import { createClient } from "@/lib/supabase/client";

import { money, PROVIDER_LABEL } from "./verified-revenue";

export type RevenueConnection = { id: string; project_id: string; provider: "stripe" | "revenuecat" | "dodo"; environment: "live" | "test"; account_ref: string | null; key_hint: string; status: "active" | "error" | "revoked"; last_sync_at: string | null; last_sync_ok: boolean | null; last_error: string | null };
export type RevenueSnapshot = { connection_id: string; day: string; currency: string; mrr_minor: number; paying_customers: number; active_subscriptions: number };
export type RevenueLimits = { plan: "free" | "plus" | "pro"; providers: number; history_days: number };

const card = "rounded-[24px] bg-white p-5 shadow-[inset_0_0_0_1px_rgba(13,13,13,.08)]";
const field = "min-h-12 w-full rounded-[16px] bg-white px-4 text-[16px] shadow-[inset_0_0_0_1px_rgba(13,13,13,.14)] outline-none focus:shadow-[inset_0_0_0_1.5px_#0D0D0D]";
const AVAILABLE = ["stripe"] as const;
const KEY_HELP: Record<string, string> = {
  stripe: "In Stripe, Developers → API keys → Create restricted key. Set Subscriptions, Customers and Prices to Read, everything else to None.",
};
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
  const [provider, setProvider] = useState<(typeof AVAILABLE)[number]>("stripe");
  const [key, setKey] = useState("");
  const [message, setMessage] = useState("");
  const [pending, start] = useTransition();
  const [now] = useState(() => Date.now());
  const mine = connections.filter((c) => c.project_id === projectId && c.status !== "revoked");
  const used = connections.filter((c) => c.status !== "revoked").length;
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
            {currencies.map((currency) => <Trend currency={currency} key={currency} rows={rows.filter((r) => r.currency === currency)} />)}
            <div className="flex flex-wrap gap-2">
            <button className={lineButton} disabled={pending} onClick={() => start(async () => { const r = await syncRevenueNow(c.id); setMessage(r.ok ? "Synced." : r.error); router.refresh(); })} type="button">{pending ? "Syncing…" : "Sync now"}</button>
            <button className={lineButton} disabled={pending} onClick={() => { if (window.confirm(`Disconnect ${PROVIDER_LABEL[c.provider]}? The key is deleted; past snapshots stay visible to you only.`)) start(async () => { const r = await disconnectRevenue(c.id); setMessage(r.ok ? "Disconnected. Also delete the key in your provider's dashboard." : r.error); router.refresh(); }); }} type="button">Disconnect</button>
            </div>
          </div>
        );
      })}

      {canAdd && (
        <form className="grid gap-3" onSubmit={(event) => { event.preventDefault(); start(async () => {
          const r = await connectRevenue(projectId, provider, key);
          setKey("");
          setMessage(r.ok ? (r.environment === "test" ? "Connected in test mode. Test data stays private." : "Connected. First numbers are in.") : r.error);
          router.refresh();
        }); }}>
          <label className="grid gap-1.5 text-[14px] font-semibold">Provider
            <select className={field} onChange={(e) => setProvider(e.target.value as typeof provider)} value={provider}>
              <option value="stripe">Stripe</option>
              <option disabled value="revenuecat">RevenueCat (coming soon)</option>
              <option disabled value="dodo">Dodo Payments (coming soon)</option>
            </select>
          </label>
          <label className="grid gap-1.5 text-[14px] font-semibold">Read-only key
            <input autoComplete="off" className={field} onChange={(e) => setKey(e.target.value)} placeholder="rk_live_…" required spellCheck={false} type="password" value={key} />
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
  const max = Math.max(...sorted.map((r) => r.mrr_minor), 1);
  const points = sorted.map((r, i) => `${sorted.length === 1 ? 50 : (i / (sorted.length - 1)) * 100},${30 - (r.mrr_minor / max) * 28}`).join(" ");
  return (
    <div className="grid gap-1">
      <p className="text-[14px] tabular-nums"><b>{money(last.mrr_minor, currency)}</b> MRR · {money(last.mrr_minor * 12, currency)} ARR · {last.paying_customers} paying</p>
      <svg aria-label={`MRR in ${currency.toUpperCase()} over ${sorted.length} days`} className="h-10 w-full" preserveAspectRatio="none" role="img" viewBox="0 0 100 32">
        <polyline fill="none" points={points} stroke="#0D0D0D" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
}
