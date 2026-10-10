"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

import { MemberBadge } from "@/components/app/status-badge";
import { analyticsCapabilities } from "@/lib/analytics/capabilities";
import { recordProfileShare } from "@/lib/analytics/client";
import { normalizeAnalytics, type AnalyticsData, type AnalyticsRangeKind } from "@/lib/analytics/normalize";
import {
  barWidth,
  dateSpan,
  deltaView,
  deviceLead,
  deviceRows,
  filledDots,
  isDayOne,
  loopSteps,
  modeLead,
  modeRows,
  pageTitle,
  percentLabel,
  periodKicker,
  previousLabel,
  rangeDays,
  rateLabel,
  rateLine,
  scanMethods,
  scanTotal,
  sourceLead,
  sourceRows,
  type Format,
} from "@/lib/analytics/view";
import type { PlanCode } from "@/lib/billing/catalog";
import { memberTierForPlan } from "@/lib/billing/member-badge";
import { GrowthChart } from "./analytics-chart";
import { AnalyticsPaywall, type PaywallTarget } from "./analytics-paywall";

type RangeRequest = { kind: "7d" | "30d" | "90d" } | { kind: "custom"; from: string; to: string };

const label = "font-label text-[11px] uppercase tracking-[0.14em]";
const sectionTitle = "font-display text-[30px] font-extrabold leading-none tracking-[-0.04em]";
const privacyNote = "Signals are private to you. Setuvara never stores who viewed you, their IP or their email.";

function isoDay(offset = 0) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

function requestParams(request: RangeRequest) {
  const params = new URLSearchParams({ range: request.kind });
  if (request.kind === "custom") {
    params.set("from", request.from);
    params.set("to", request.to);
  }
  return params.toString();
}

export function AnalyticsDashboard({ initialPlan, shareUrl, shareMode, walletLaunched }: {
  /** Server-resolved plan, so the header and range control are right before data arrives. */
  initialPlan: PlanCode;
  /** The canonical copy-link URL, or null when the profile is not live. */
  shareUrl: string | null;
  shareMode: "personal" | "event" | "business";
  walletLaunched: boolean;
}) {
  const [request, setRequest] = useState<RangeRequest>({ kind: "7d" });
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [reload, setReload] = useState(0);
  const [paywall, setPaywall] = useState<PaywallTarget | null>(null);
  const [customOpen, setCustomOpen] = useState(false);
  const fmt = useMemo<Format>(() => {
    const formatter = new Intl.NumberFormat();
    return (value) => formatter.format(value);
  }, []);
  const key = requestParams(request);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/analytics?${key}`, { cache: "no-store", credentials: "same-origin", headers: { accept: "application/json" }, signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("analytics_unavailable");
        const result = normalizeAnalytics(await response.json());
        if (!result) throw new Error("analytics_invalid_response");
        setData(result);
        setFailed(false);
      })
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) setFailed(true);
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [key, reload]);

  // The server's plan wins once it answers; before that, the server-rendered plan.
  const plan = data?.plan ?? initialPlan;
  const capabilities = analyticsCapabilities(plan);
  const closePaywall = useCallback(() => setPaywall(null), []);

  const choose = (next: RangeRequest) => {
    if (requestParams(next) === key) return;
    setLoading(true);
    setFailed(false);
    setRequest(next);
  };
  const retry = () => { setLoading(true); setFailed(false); setReload((value) => value + 1); };

  const shown = data && !failed ? data : null;
  const dayOne = shown ? isDayOne(shown.summary) : false;
  const kind: AnalyticsRangeKind = shown?.range?.kind ?? request.kind;
  const customLabel = request.kind === "custom"
    ? `${dateSpan(request.from, request.to).toUpperCase()} · ${rangeDays(request.from, request.to)} DAYS`
    : null;

  return (
    <main className="mx-auto w-full max-w-[1440px] px-5 pb-10 pt-7 md:px-10 lg:px-16 lg:pb-14 lg:pt-9">
      <div className="mx-auto flex w-full max-w-[1312px] flex-col gap-11 lg:gap-14">
        <header className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end lg:gap-10">
          <div className="flex flex-col gap-4 lg:gap-3.5">
            <div className="flex items-center justify-between gap-3">
              <span className="font-label text-[11px] tracking-[0.16em] lg:text-[12px]">YOUR SIGNALS · {periodKicker(kind)}</span>
              <PlanPill className="flex lg:hidden" plan={plan} />
            </div>
            <h1 className="max-w-[560px] font-display text-[44px] font-extrabold leading-[0.95] tracking-[-0.05em] [text-wrap:balance] lg:max-w-[900px] lg:text-[clamp(64px,5.8vw,84px)] lg:leading-[0.9] lg:tracking-[-0.055em]">{failed ? "Your signals" : pageTitle(shown)}</h1>
          </div>
          <div className="flex flex-col items-start gap-3 lg:items-end">
            <PlanPill className="hidden lg:flex" plan={plan} />
            <RangeControl
              available={capabilities.availableRanges}
              onCustom={() => (capabilities.customRange ? setCustomOpen((open) => !open) : setPaywall("pro"))}
              onLocked={(target) => setPaywall(target)}
              onPick={(value) => { setCustomOpen(false); choose({ kind: value }); }}
              selected={request.kind}
            />
            {customLabel && !customOpen && <span className="font-label text-[12px] tracking-[0.08em]">{customLabel}</span>}
          </div>
          {customOpen && capabilities.customRange && (
            <CustomRange
              historyDays={capabilities.maxHistoryDays}
              initial={request.kind === "custom" ? request : { from: isoDay(-89), to: isoDay(0) }}
              onApply={(from, to) => { setCustomOpen(false); choose({ kind: "custom", from, to }); }}
              onCancel={() => setCustomOpen(false)}
            />
          )}
          {loading && shown && <p aria-live="polite" className="font-label text-[11px] tracking-[0.1em] text-black/65 lg:col-span-2" role="status">Updating your signals…</p>}
        </header>

        {failed ? <ErrorState onRetry={retry} />
          : !shown ? <LoadingState />
            : dayOne ? <DayOne comparison={shown.comparison} fmt={fmt} shareMode={shareMode} shareUrl={shareUrl} />
              : <Signals data={shown} fmt={fmt} kind={kind} onUpgrade={setPaywall} walletLaunched={walletLaunched} />}

        {shown && !dayOne && <footer className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between lg:gap-6 lg:border-t lg:border-[#0d0d0d]/[0.12] lg:pt-5">
          {shown.capabilities?.exports === true && capabilities.exports && shown.range && <ExportRow range={shown.range} />}
          <p className="text-center font-label text-[11px] leading-[1.6] tracking-[0.04em] text-black/65 lg:order-first lg:text-left">{privacyNote}</p>
        </footer>}
        {shown && dayOne && <p className="text-center font-label text-[11px] leading-[1.6] tracking-[0.04em] text-black/65">{privacyNote}</p>}
      </div>

      {paywall && plan !== "pro" && !(paywall === "plus" && plan === "plus") && <AnalyticsPaywall onClose={closePaywall} plan={plan} target={paywall} />}
    </main>
  );
}

function PlanPill({ plan, className = "" }: { plan: PlanCode; className?: string }) {
  const tier = memberTierForPlan(plan);
  const border = tier === "pro" ? "border-[#d6b25e]" : tier === "plus" ? "border-[#ff5a4f]" : "border-[#0d0d0d]";
  const name = tier === "pro" ? "Setuvara Pro member" : tier === "plus" ? "Setuvara Plus member" : "Free plan";
  return (
    <span aria-label={`Your plan: ${name}`} className={`h-7 shrink-0 items-center gap-1.5 rounded-full border-[1.5px] font-label text-[11px] tracking-[0.12em] ${tier ? "pl-1.5 pr-2.5" : "px-2.5"} ${border} ${className}`} data-plan-pill={plan} role="img">
      {tier && <MemberBadge decorative size={18} tier={tier} />}
      <span aria-hidden="true">{tier === "pro" ? "PRO" : tier === "plus" ? "PLUS" : "FREE"}</span>
    </span>
  );
}

const RANGE_CHIPS = [
  { value: "7d", label: "7D", tag: null },
  { value: "30d", label: "30D", tag: "PLUS" },
  { value: "90d", label: "90D", tag: "PLUS" },
  { value: "custom", label: "Custom", tag: "PRO" },
] as const;

function RangeControl({ available, selected, onPick, onLocked, onCustom }: {
  available: readonly string[];
  selected: string;
  onPick: (value: "7d" | "30d" | "90d") => void;
  onLocked: (target: PaywallTarget) => void;
  onCustom: () => void;
}) {
  const group = useRef<HTMLDivElement>(null);
  // Arrow keys move between chips; Tab leaves the group.
  const onKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    const chips = [...(group.current?.querySelectorAll<HTMLButtonElement>("button") ?? [])];
    const index = chips.indexOf(document.activeElement as HTMLButtonElement);
    if (index < 0) return;
    event.preventDefault();
    const next = event.key === "Home" ? 0 : event.key === "End" ? chips.length - 1 : (index + (event.key === "ArrowRight" ? 1 : chips.length - 1)) % chips.length;
    chips[next]?.focus();
  };
  return (
    <div aria-label="Date range" className="flex w-max max-w-full gap-0.5 overflow-x-auto rounded-full bg-[#0d0d0d]/[0.06] p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" onKeyDown={onKey} ref={group} role="group">
      {RANGE_CHIPS.map((chip) => {
        const locked = !available.includes(chip.value);
        const on = !locked && selected === chip.value;
        const target: PaywallTarget = chip.tag === "PRO" ? "pro" : "plus";
        return (
          <button
            aria-haspopup={locked ? "dialog" : undefined}
            aria-label={locked ? `${chip.value === "custom" ? "Custom range" : `${Number.parseInt(chip.value, 10)} days`}, ${target === "pro" ? "Pro" : "Plus"}. See what it adds` : undefined}
            aria-pressed={locked ? undefined : on}
            className={`flex h-[38px] shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[13px] font-semibold transition-colors min-[380px]:px-[13px] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#ff5a4f] lg:px-[15px] ${on ? "bg-[#0d0d0d] text-[#f5f4ef]" : "text-[#0d0d0d] hover:bg-[#0d0d0d]/[0.06]"}`}
            data-locked={locked ? target : undefined}
            key={chip.value}
            onClick={() => {
              if (locked) onLocked(target);
              else if (chip.value === "custom") onCustom();
              else onPick(chip.value);
            }}
            type="button"
          >
            <span>{chip.label}</span>
            {locked && chip.tag && <span aria-hidden="true" className={`rounded-[4px] px-[5px] py-0.5 font-label text-[9px] tracking-[0.1em] text-[#0d0d0d] ${chip.tag === "PRO" ? "bg-[#d6b25e]" : "bg-[#ff5a4f]"}`}>{chip.tag}</span>}
          </button>
        );
      })}
    </div>
  );
}

function CustomRange({ initial, historyDays, onApply, onCancel }: {
  initial: { from: string; to: string };
  historyDays: number;
  onApply: (from: string, to: string) => void;
  onCancel: () => void;
}) {
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const today = isoDay(0);
  const earliest = isoDay(1 - historyDays);
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(to) && from <= to && to <= today && rangeDays(from, to) <= historyDays && from >= earliest;
  const field = "min-h-11 w-full rounded-xl border border-[#0d0d0d]/20 bg-white px-3 text-[16px] outline-none focus-visible:border-[#0d0d0d] focus-visible:ring-2 focus-visible:ring-[#ff5a4f]/55";
  return (
    <form
      aria-label="Custom date range"
      className="flex flex-col gap-3 rounded-[20px] bg-white p-4 sm:flex-row sm:items-end lg:col-span-2"
      onSubmit={(event) => { event.preventDefault(); if (valid) onApply(from, to); }}
    >
      <label className="flex min-w-0 flex-1 flex-col gap-1.5 text-[12px] font-semibold">From<input className={field} max={to || today} min={earliest} onChange={(event) => setFrom(event.target.value)} type="date" value={from} /></label>
      <label className="flex min-w-0 flex-1 flex-col gap-1.5 text-[12px] font-semibold">To<input className={field} max={today} min={from || earliest} onChange={(event) => setTo(event.target.value)} type="date" value={to} /></label>
      <div className="flex gap-2">
        <button className="min-h-11 rounded-full bg-[#0d0d0d] px-5 text-[14px] font-semibold text-[#f5f4ef] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff5a4f] disabled:opacity-45" disabled={!valid} type="submit">Show range</button>
        <button className="min-h-11 px-3 text-[14px] font-semibold focus-visible:outline-2" onClick={onCancel} type="button">Cancel</button>
      </div>
      {!valid && <p className="basis-full text-[13px] text-[#a43d36]" role="alert">Choose dates within the last {historyDays.toLocaleString()} days, ending today or earlier.</p>}
    </form>
  );
}

function Signals({ data, kind, fmt, onUpgrade, walletLaunched }: { data: AnalyticsData; kind: AnalyticsRangeKind; fmt: Format; onUpgrade: (target: PaywallTarget) => void; walletLaunched: boolean }) {
  const caps = data.capabilities ?? {};
  const days = data.range ? rangeDays(data.range.start, data.range.end) : 7;
  const previous = previousLabel(kind, days);
  const deeper = caps.sourceBreakdown === true || caps.modeBreakdown === true || caps.conversion === true;
  const pro = caps.funnels === true || caps.deviceInsights === true;
  const showConversion = caps.conversion === true;

  return (
    <>
      <div className="flex flex-col gap-11 lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-end lg:gap-16">
        <Hero data={data} fmt={fmt} previous={previous} showConversion={showConversion} />
        {deeper ? (
          <GrowthChart daily={data.daily ?? []} delta={data.comparison?.profileViewsDelta} fmt={fmt} kind={kind} />
        ) : (
          <div className="flex flex-col gap-11">
            <ScanMethods data={data} fmt={fmt} />
            {data.plan === "free" && <PlusCard onUpgrade={() => onUpgrade("plus")} />}
          </div>
        )}
      </div>

      {deeper && (
        <div className="grid gap-x-10 gap-y-11 [grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr))] lg:grid-cols-3 lg:gap-14 lg:border-t-[1.5px] lg:border-[#0d0d0d] lg:pt-9">
          {caps.modeBreakdown === true && <Modes data={data} fmt={fmt} />}
          {caps.sourceBreakdown === true && <Sources data={data} fmt={fmt} walletLaunched={walletLaunched} />}
          {showConversion && <Conversion data={data} fmt={fmt} />}
        </div>
      )}

      {pro && (
        <div className="grid gap-x-10 gap-y-11 [grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr))] lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-14 lg:border-t-[1.5px] lg:border-[#0d0d0d] lg:pt-9">
          {caps.funnels === true && <Loop data={data} fmt={fmt} />}
          {caps.deviceInsights === true && <Devices data={data} fmt={fmt} />}
        </div>
      )}

      {data.plan === "plus" && <ProHint onUpgrade={() => onUpgrade("pro")} />}
    </>
  );
}

function Hero({ data, fmt, previous, showConversion }: { data: AnalyticsData; fmt: Format; previous: string; showConversion: boolean }) {
  const views = fmt(data.summary.profileViews);
  const viewsDelta = deltaView(data.comparison?.profileViewsDelta, previous);
  const connectionsDelta = deltaView(data.comparison?.connectionsDelta, previous);
  // Long numbers step down so the hero never overflows its column.
  const scale = views.length <= 3 ? 1 : views.length <= 5 ? 0.82 : views.length <= 7 ? 0.66 : 0.52;
  return (
    <section aria-label="Profile views, Connections and scans" className="flex min-w-0 flex-col gap-[22px] lg:gap-[26px]">
      <div className="flex flex-col gap-2.5 lg:gap-3">
        <span className={label}>Profile views</span>
        <span className="font-display font-extrabold leading-[0.82] tracking-[-0.065em] [--hero:124px] lg:leading-[0.8] lg:tracking-[-0.07em] lg:[--hero:clamp(124px,13.9vw,200px)]" data-metric="profile-views" style={{ fontSize: `calc(var(--hero) * ${scale})` }}>{views}</span>
        <div className="flex flex-col items-start gap-2.5 lg:flex-row lg:flex-wrap lg:items-center lg:gap-3">
          <p className="text-[17px] leading-[1.45] lg:text-[18px]">times your Setuvara was opened.</p>
          <DeltaChip view={viewsDelta} />
        </div>
      </div>
      <div className="grid gap-5 border-t-[1.5px] border-[#0d0d0d] pt-[18px] [grid-template-columns:repeat(auto-fit,minmax(150px,1fr))] lg:grid-cols-3 lg:gap-6">
        <Metric label="Connections" line="new people connected" sub={<span className={connectionsDelta.tone === "up" ? "font-semibold" : "font-semibold text-black/70"}>{connectionsDelta.tone === "none" ? "Nothing to compare yet" : connectionsDelta.text}</span>} value={fmt(data.summary.connections)} />
        <Metric label="Scans" line="QR, Quick QR and Tap" value={fmt(scanTotal(data.summary))} />
        {showConversion && <div className="hidden lg:block"><Metric label="Connected" line="of views" value={rateLabel(data.summary.conversionRate)} /></div>}
      </div>
    </section>
  );
}

function Metric({ label: name, value, line, sub }: { label: string; value: string; line: string; sub?: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className={label}>{name}</span>
      <span className="font-display text-[58px] font-extrabold leading-[0.9] tracking-[-0.06em] lg:text-[56px]">{value}</span>
      <span className="text-[14px] leading-[1.4] lg:text-[13px]">{line}</span>
      {sub && <span className="text-[13px]">{sub}</span>}
    </div>
  );
}

function DeltaChip({ view }: { view: ReturnType<typeof deltaView> }) {
  // Positive is Lime; negative stays neutral ink, never red.
  const tone = view.tone === "up" ? "bg-[#c7ff4a]" : "bg-[#0d0d0d]/[0.06]";
  return <span className={`rounded-full px-[11px] py-1.5 text-[13px] font-semibold ${tone}`}>{view.text}</span>;
}

function ScanMethods({ data, fmt }: { data: AnalyticsData; fmt: Format }) {
  const methods = scanMethods(data.summary);
  const max = Math.max(0, ...methods.map((item) => item.count));
  return (
    <section aria-labelledby="scan-methods" className="flex flex-col gap-3.5">
      <h2 className={label} id="scan-methods">How you were scanned</h2>
      {max === 0 ? <p className="text-[15px] text-black/65">No scans in this period yet.</p> : (
        <ul className="flex flex-col gap-3.5">
          {methods.map((method) => (
            <li className="grid grid-cols-[1fr_auto] items-center gap-2" key={method.key}>
              <span className="text-[16px] font-semibold">{method.label}</span>
              <span className="font-display text-[26px] font-extrabold tracking-[-0.04em]">{fmt(method.count)}</span>
              <span aria-hidden="true" className="col-span-full h-1.5 overflow-hidden rounded-full bg-[#0d0d0d]/[0.08]"><span className="block h-full rounded-full bg-[#0d0d0d]" style={{ width: barWidth(method.count, max) }} /></span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function PlusCard({ onUpgrade }: { onUpgrade: () => void }) {
  return (
    <section aria-labelledby="plus-card" className="flex flex-col gap-3.5 rounded-[24px] border-[1.5px] border-[#0d0d0d] bg-white p-6">
      <div className="flex items-center gap-2"><MemberBadge decorative size={22} tier="plus" /><span className={label}>Plus</span></div>
      <h2 className="font-display text-[28px] font-extrabold leading-none tracking-[-0.04em]" id="plus-card">See what brings people to you.</h2>
      <p className="text-[15px] leading-[1.5] [text-wrap:pretty]">Your Modes, how people reach you, and up to 90 days of growth, plus how many views become Connections.</p>
      <button aria-haspopup="dialog" className="min-h-[46px] self-start rounded-full bg-[#ff5a4f] px-5 text-[14px] font-bold text-[#0d0d0d] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0d0d0d]" onClick={onUpgrade} type="button">Unlock deeper analytics</button>
    </section>
  );
}

function SectionHead({ kicker, title, id, children }: { kicker: string; title: string; id: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <span className={label}>{kicker}</span>
      {title && <h2 className={sectionTitle} id={id}>{title}</h2>}
      {children}
    </div>
  );
}

function Modes({ data, fmt }: { data: AnalyticsData; fmt: Format }) {
  const rows = modeRows(data.modes);
  return (
    <section aria-labelledby="modes-title" className="flex min-w-0 flex-col gap-4">
      <SectionHead id="modes-title" kicker="Your Modes" title={rows.length ? modeLead(rows) : "Which version of you works?"}>
        <p className="text-[14px] leading-[1.45]">Profile views by the Mode people opened.</p>
      </SectionHead>
      {rows.length === 0 ? <p className="text-[15px] text-black/65">No Mode views in this period yet.</p> : (
        <>
          <div aria-hidden="true" className="flex h-4 gap-[3px]">
            {rows.map((row) => <div className="rounded-[3px]" key={row.key} style={{ width: `${(row.share * 100).toFixed(1)}%`, background: row.color }} />)}
          </div>
          <ul className="flex flex-col">
            {rows.map((row) => (
              <li className="grid grid-cols-[22px_1fr_auto_44px] items-center gap-2.5 border-t border-[#0d0d0d]/[0.12] py-3 lg:py-[11px]" key={row.key}>
                <span aria-hidden="true" className="h-3 w-[18px]" style={{ background: row.color, clipPath: "polygon(3px 0,100% 0,calc(100% - 3px) 100%,0 100%)" }} />
                <span className="text-[17px] font-semibold lg:text-[16px]">{row.label}</span>
                <span className="font-display text-[30px] font-extrabold tracking-[-0.04em] lg:text-[28px]">{fmt(row.count)}</span>
                <span className="text-right font-label text-[12px]">{percentLabel(row.share)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function Sources({ data, fmt, walletLaunched }: { data: AnalyticsData; fmt: Format; walletLaunched: boolean }) {
  const rows = sourceRows(data.sources);
  const max = Math.max(0, ...rows.map((row) => row.count));
  return (
    <section aria-labelledby="sources-title" className="flex min-w-0 flex-col gap-4">
      <SectionHead id="sources-title" kicker="How people reach you" title={rows.length ? sourceLead(rows) : "Where do they find you?"} />
      {rows.length === 0 ? <p className="text-[15px] text-black/65">No source activity in this period yet.</p> : (
        <ul className="flex flex-col gap-3.5 lg:gap-3">
          {rows.map((row) => (
            <li className="grid grid-cols-[1fr_auto] items-center gap-[7px] lg:gap-1.5" key={row.key}>
              <span className="text-[15px] font-semibold">{row.label}</span>
              <span className="font-label text-[13px]">{fmt(row.count)}</span>
              <span aria-hidden="true" className="col-span-full h-1.5 overflow-hidden rounded-full bg-[#0d0d0d]/[0.08]"><span className="block h-full rounded-full bg-[#0d0d0d]" style={{ width: barWidth(row.count, max) }} /></span>
            </li>
          ))}
          {/* Visual-only while Wallet is Coming Soon: no Wallet source exists, so no count is shown. */}
          {!walletLaunched && (
            <li className="grid grid-cols-[1fr_auto] items-center gap-[7px] lg:gap-1.5" data-source-placeholder="wallet">
              <span className="text-[15px] font-semibold text-black/65">Wallet</span>
              <span className="font-label text-[10px] tracking-[0.12em] text-black/65">ARRIVES LATER</span>
              <span aria-hidden="true" className="col-span-full box-border h-1.5 rounded-full border border-dashed border-[#0d0d0d]/30" />
            </li>
          )}
        </ul>
      )}
    </section>
  );
}

function Conversion({ data, fmt }: { data: AnalyticsData; fmt: Format }) {
  const rate = data.summary.conversionRate;
  const filled = filledDots(rate);
  return (
    <section aria-labelledby="conversion-title" className="col-span-full flex min-w-0 flex-col gap-4 rounded-[24px] bg-white p-6 lg:col-span-1 lg:p-[26px]">
      <h2 className={label} id="conversion-title">Views → Connections</h2>
      <div className="flex flex-wrap items-end gap-4 lg:flex-col lg:items-start">
        <span className="font-display text-[92px] font-extrabold leading-[0.82] tracking-[-0.065em] lg:text-[clamp(72px,6.7vw,96px)]">{rateLabel(rate)}</span>
        <p className="max-w-[220px] pb-1 text-[15px] leading-[1.45] lg:max-w-none lg:pb-0">{rateLine(rate, data.summary.profileViews)}</p>
      </div>
      <div aria-hidden="true" className="grid max-w-[420px] grid-cols-[repeat(20,minmax(0,1fr))] gap-[5px] lg:max-w-none">
        {Array.from({ length: 100 }, (_, index) => <span className={`aspect-square rounded-full ${index < filled ? "bg-[#ff5a4f]" : "bg-[#0d0d0d]/10"}`} key={index} />)}
      </div>
      <span className="font-label text-[11px] tracking-[0.06em]">{fmt(data.summary.connections)} {data.summary.connections === 1 ? "CONNECTION" : "CONNECTIONS"} ÷ {fmt(data.summary.profileViews)} PROFILE {data.summary.profileViews === 1 ? "VIEW" : "VIEWS"}</span>
    </section>
  );
}

function Loop({ data, fmt }: { data: AnalyticsData; fmt: Format }) {
  const steps = loopSteps(data.funnel);
  return (
    <section aria-labelledby="loop-title" className="flex min-w-0 flex-col gap-4 lg:gap-[18px]">
      <SectionHead id="loop-title" kicker="Your loop" title="Every share keeps it moving." />
      {steps.length === 0 ? <p className="text-[15px] text-black/65">No loop activity in this period yet.</p> : (
        <ol className="flex flex-col lg:grid lg:grid-cols-3 lg:gap-6">
          {steps.map((step) => (
            <li className={`grid grid-cols-[1fr_auto] items-end gap-x-3 gap-y-1 border-t-[1.5px] py-3.5 lg:flex lg:flex-col lg:items-start lg:gap-2 lg:border-t-4 lg:pb-0 lg:pt-3.5 ${step.key === "connections" ? "border-[#ff5a4f]" : "border-[#0d0d0d]"}`} key={step.key}>
              <span className="font-label text-[11px] tracking-[0.12em]">{step.step}</span>
              <span className="row-span-2 font-display text-[44px] font-extrabold leading-[0.9] tracking-[-0.05em] lg:text-[clamp(44px,4.4vw,64px)] lg:leading-[0.88] lg:tracking-[-0.06em]">{fmt(step.count)}</span>
              <span className="text-[15px] leading-[1.35] lg:leading-[1.4]">{step.text}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function Devices({ data, fmt }: { data: AnalyticsData; fmt: Format }) {
  const rows = deviceRows(data.deviceClasses);
  return (
    <section aria-labelledby="devices-title" className="flex min-w-0 flex-col gap-4">
      <SectionHead id="devices-title" kicker="Where they open you" title={rows.length ? deviceLead(rows) : "Phone, desktop or tablet?"} />
      {rows.length === 0 ? <p className="text-[15px] text-black/65">No device data in this period yet.</p> : (
        <>
          <div aria-hidden="true" className="flex h-11 gap-[3px] overflow-hidden rounded-xl">
            {rows.map((row) => <div className={row.key === "tablet" ? "border border-[#0d0d0d]/20" : ""} key={row.key} style={{ width: `${(row.share * 100).toFixed(1)}%`, background: row.color }} />)}
          </div>
          <ul className="flex flex-col lg:flex-row lg:flex-wrap lg:gap-7">
            {rows.map((row) => (
              <li className="grid grid-cols-[16px_1fr_auto_44px] items-center gap-2.5 border-t border-[#0d0d0d]/[0.12] py-2.5 lg:flex lg:flex-col lg:items-start lg:gap-0.5 lg:border-0 lg:py-0" key={row.key}>
                <span aria-hidden="true" className="size-2.5 rounded-[2px] border border-[#0d0d0d] lg:hidden" style={{ background: row.color }} />
                <span className="text-[15px] font-semibold lg:text-[14px]">{row.label}</span>
                <span className="font-label text-[13px] lg:hidden">{fmt(row.count)}</span>
                <span className="text-right font-label text-[12px] lg:hidden">{percentLabel(row.share)}</span>
                <span className="hidden font-label text-[13px] lg:inline">{fmt(row.count)} · {percentLabel(row.share)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function ProHint({ onUpgrade }: { onUpgrade: () => void }) {
  return (
    <section aria-label="Setuvara Pro" className="flex items-start gap-3 border-t border-[#0d0d0d]/[0.12] pt-[18px]">
      <MemberBadge className="mt-0.5" decorative size={24} tier="pro" />
      <div className="flex flex-col gap-1.5">
        <p className="text-[15px] leading-[1.45]">Go further back, see your whole loop and which devices people use.</p>
        <button aria-haspopup="dialog" className="min-h-11 self-start text-[14px] font-bold underline underline-offset-[3px] focus-visible:outline-2 focus-visible:outline-offset-2" onClick={onUpgrade} type="button">Explore Pro</button>
      </div>
    </section>
  );
}

function ExportRow({ range }: { range: NonNullable<AnalyticsData["range"]> }) {
  // Export exactly the period on screen, through the canonical server export.
  const span = dateSpan(range.start, range.end);
  const params = range.kind === "custom" ? requestParams({ kind: "custom", from: range.start, to: range.end }) : requestParams({ kind: range.kind });
  return (
    <section aria-label="Export" className="flex items-center justify-between gap-4 border-t border-[#0d0d0d]/[0.12] pt-[18px] lg:border-0 lg:pt-0">
      <div className="flex flex-col gap-[3px] lg:hidden">
        <span className="text-[15px] font-semibold">Keep a copy of this period</span>
        <span className="text-[13px] text-black/65">{span} · daily rows, one CSV</span>
      </div>
      <span className="hidden text-[13px] text-black/65 lg:inline">{span} · daily rows, one CSV</span>
      <a className="inline-flex min-h-11 shrink-0 items-center rounded-full border-[1.5px] border-[#0d0d0d] px-4 text-[13px] font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff5a4f]" download href={`/api/analytics/export?${params}`}>Download CSV</a>
    </section>
  );
}

const EXPLAIN = [
  { title: "Profile views", text: "Each time someone opens your Setuvara.", color: "#0D0D0D" },
  { title: "Connections", text: "People who connect with you, counted once.", color: "#FF5A4F" },
  { title: "Modes", text: "Which version of you they opened: Personal, Event or Business. Plus.", color: "#C7FF4A" },
  { title: "How people reach you", text: "Quick QR, Tap or a shared link. Plus.", color: "#AFCBFF" },
];

function DayOne({ shareUrl, shareMode, comparison, fmt }: { shareUrl: string | null; shareMode: "personal" | "event" | "business"; comparison: AnalyticsData["comparison"]; fmt: Format }) {
  const [copied, setCopied] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const hadEarlier = comparison?.profileViewsDelta !== null && comparison?.profileViewsDelta !== undefined;

  async function copy() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      recordProfileShare(shareMode, "copy");
      setCopied("copied");
    } catch {
      setCopied("failed");
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied("idle"), 2000);
  }

  return (
    <section aria-label="Day one" className="flex max-w-[760px] flex-col gap-7">
      <div className="flex flex-col gap-4 rounded-[24px] bg-[#0d0d0d] p-[26px] text-[#f5f4ef] lg:p-9">
        <span className="font-label text-[11px] tracking-[0.14em] text-[#c7ff4a]">DAY ONE</span>
        <p className="font-display text-[32px] font-extrabold leading-none tracking-[-0.045em] lg:text-[44px]">Share once, and this page starts telling your story.</p>
        <div className="flex flex-wrap gap-2.5">
          <Link className="inline-flex min-h-[46px] items-center rounded-full bg-[#ff5a4f] px-5 text-[14px] font-bold text-[#0d0d0d] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f5f4ef]" href="/app/tap">Show Quick QR</Link>
          {shareUrl && <button aria-live="polite" className="min-h-[46px] rounded-full border-[1.5px] border-[#f5f4ef] px-[18px] text-[14px] font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f5f4ef]" onClick={() => void copy()} type="button">{copied === "copied" ? "Link copied" : "Copy your link"}</button>}
          {!shareUrl && <Link className="inline-flex min-h-[46px] items-center rounded-full border-[1.5px] border-[#f5f4ef] px-[18px] text-[14px] font-semibold focus-visible:outline-2" href="/app/identity?mode=personal&section=settings">Make your profile live</Link>}
        </div>
        {copied === "failed" && <p className="text-[13px] text-[#f5f4ef]/80" role="status">Copy is unavailable in this browser. Your link is {shareUrl}</p>}
      </div>
      <div className="flex flex-col gap-1">
        <h2 className="pb-2 font-label text-[11px] tracking-[0.14em]">WHAT WILL APPEAR HERE</h2>
        <ul className="flex flex-col">
          {EXPLAIN.map((item) => (
            <li className="grid grid-cols-[auto_1fr] gap-x-3.5 gap-y-1 border-t border-[#0d0d0d]/[0.12] py-3.5" key={item.title}>
              <span aria-hidden="true" className="row-span-2 mt-[5px] h-3 w-[18px]" style={{ background: item.color, clipPath: "polygon(3px 0,100% 0,calc(100% - 3px) 100%,0 100%)" }} />
              <span className="text-[16px] font-semibold">{item.title}</span>
              <span className="text-[14px] leading-[1.45]">{item.text}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="flex flex-wrap justify-between gap-3 border-t-[1.5px] border-[#0d0d0d] pt-3.5 font-label text-[12px] tracking-[0.04em]">
        <span>{fmt(0)} views · {fmt(0)} Connections · {fmt(0)} scans</span>
        <span>{hadEarlier ? "Quieter than the period before" : "No earlier period yet"}</span>
      </div>
    </section>
  );
}

function LoadingState() {
  const heights = [30, 45, 38, 60, 52, 40, 70, 48, 55, 66, 42, 58, 72, 50, 61, 44, 68, 75, 57, 49, 63, 80, 54, 69, 77, 60, 73, 85, 66, 90];
  return (
    <section aria-busy="true" aria-label="Loading your signals" className="flex flex-col gap-[22px] lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-end lg:gap-16" role="status">
      <div className="flex flex-col gap-[22px]">
        <div className="flex flex-col gap-3">
          <span className="h-[11px] w-[110px] animate-pulse rounded bg-[#0d0d0d]/[0.08]" />
          <span className="h-24 w-[220px] animate-pulse rounded-[14px] bg-[#0d0d0d]/[0.08] lg:h-40 lg:w-[320px]" />
          <span className="h-[15px] w-[240px] animate-pulse rounded bg-[#0d0d0d]/[0.06]" />
        </div>
        <div className="grid grid-cols-2 gap-5 border-t-[1.5px] border-[#0d0d0d]/[0.12] pt-[18px]">
          <span className="h-[84px] animate-pulse rounded-xl bg-[#0d0d0d]/[0.06]" />
          <span className="h-[84px] animate-pulse rounded-xl bg-[#0d0d0d]/[0.06]" />
        </div>
      </div>
      <div className="flex flex-col gap-[22px]">
        <div aria-hidden="true" className="flex h-[150px] items-end gap-[3px] border-b-[1.5px] border-[#0d0d0d]/[0.12] lg:h-[300px]">
          {heights.map((height, index) => <span className="flex-1 animate-pulse rounded-t-[2px] bg-[#0d0d0d]/[0.06]" key={index} style={{ height: `${height}%` }} />)}
        </div>
        <span className="font-label text-[11px] tracking-[0.1em]">LOADING YOUR SIGNALS…</span>
      </div>
    </section>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <section className="flex max-w-[640px] flex-col gap-3.5 rounded-[24px] border-[1.5px] border-[#0d0d0d]/[0.12] bg-white p-[26px]" role="alert">
      <svg aria-hidden="true" height="32" viewBox="0 0 32 32" width="32"><circle cx="16" cy="16" fill="none" r="14" stroke="#0D0D0D" strokeWidth="2" /><path d="M10 16h12" stroke="#0D0D0D" strokeLinecap="round" strokeWidth="2" /></svg>
      <h2 className={sectionTitle}>We couldn&apos;t load your signals right now.</h2>
      <p className="text-[15px] leading-[1.5]">Your profile, Modes and Connections are safe. This is on our side. Give it a moment and try again.</p>
      <button className="min-h-[46px] self-start rounded-full bg-[#0d0d0d] px-[22px] text-[14px] font-semibold text-[#f5f4ef] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff5a4f]" onClick={onRetry} type="button">Try again</button>
    </section>
  );
}

export { LoadingState as AnalyticsLoadingState };
