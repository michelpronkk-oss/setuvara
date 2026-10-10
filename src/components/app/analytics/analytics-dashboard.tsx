"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Plan = "free" | "plus" | "pro";
type RangePreset = "7d" | "30d" | "90d";
type DailyPoint = {
  date: string;
  profileViews: number;
  connections: number;
};
type AnalyticsData = {
  plan: Plan;
  range?: { kind: string; start: string; end: string };
  capabilities?: {
    historyDays?: number;
    availableRanges?: string[];
    conversion?: boolean;
    customRange?: boolean;
    exports?: boolean;
  };
  summary: {
    profileViews: number;
    qrScans: number;
    quickQrScans: number;
    tapScans: number;
    connections: number;
    conversionRate?: number | null;
  };
  daily?: DailyPoint[];
  sources?: { source: string; count: number }[];
  modes?: { mode: string; count: number }[];
  funnel?: { step: string; count: number }[];
  deviceClasses?: { device: string; count: number }[];
  comparison?: { profileViewsDelta: number | null; connectionsDelta: number | null };
};

const presets: { value: RangePreset; label: string }[] = [
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
];

const panel = "rounded-[24px] bg-white p-5 shadow-[0_1px_0_rgba(13,13,13,.04)] sm:p-6";
const field = "min-h-11 rounded-xl border border-black/15 bg-white px-3 text-[16px] outline-none focus-visible:border-[#0d0d0d] focus-visible:ring-2 focus-visible:ring-[#ff5a4f]/55";

export function AnalyticsDashboard() {
  const [preset, setPreset] = useState<RangePreset>("7d");
  const [custom, setCustom] = useState(false);
  const [customFrom, setCustomFrom] = useState(() => offsetDate(-29));
  const [customTo, setCustomTo] = useState(() => offsetDate(0));
  const [appliedCustom, setAppliedCustom] = useState<{ from: string; to: string } | null>(null);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reload, setReload] = useState(0);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [interval, setInterval] = useState<"monthly" | "yearly">("monthly");
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [portalBusy, setPortalBusy] = useState(false);
  const [billingError, setBillingError] = useState(false);
  const upgradeDialogRef = useRef<HTMLElement>(null);
  const checkoutBusyRef = useRef(checkoutBusy);

  useEffect(() => {
    checkoutBusyRef.current = checkoutBusy;
  }, [checkoutBusy]);

  useEffect(() => {
    if (!upgradeOpen) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    upgradeDialogRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !checkoutBusyRef.current) {
        event.preventDefault();
        setUpgradeOpen(false);
      }
      if (event.key !== "Tab" || !upgradeDialogRef.current) return;
      const items = [...upgradeDialogRef.current.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled)")];
      if (!items.length) return;
      const first = items[0];
      const last = items.at(-1)!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previouslyFocused?.focus();
    };
  }, [upgradeOpen]);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ range: appliedCustom ? "90d" : preset });
    if (appliedCustom) {
      params.set("from", appliedCustom.from);
      params.set("to", appliedCustom.to);
    }
    fetch(`/api/analytics?${params.toString()}`, {
      cache: "no-store",
      headers: { accept: "application/json" },
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("analytics_unavailable");
        const result = normalizeAnalytics(await response.json());
        if (!result) throw new Error("analytics_invalid_response");
        setData(result);
        setLoadError(false);
      })
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) setLoadError(true);
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [appliedCustom, preset, reload]);

  const availablePresets = useMemo(() => {
    const configured = data?.capabilities?.availableRanges;
    const allowed = configured ?? (data?.plan === "free" ? ["7d"] : ["7d", "30d", "90d"]);
    return presets.filter((item) => allowed.includes(item.value));
  }, [data?.capabilities?.availableRanges, data?.plan]);
  const canUseCustom = data?.plan === "pro" && data.capabilities?.customRange === true;
  const plan = data?.plan ?? "free";
  const targetPlan = plan === "free" ? "plus" : plan === "plus" ? "pro" : null;
  const historyDays = data?.capabilities?.historyDays ?? (plan === "pro" ? 90 : 90);
  const rangeValid = !custom || (
    Boolean(customFrom && customTo)
    && customFrom <= customTo
    && customTo <= offsetDate(0)
    && isWithinHistory(customFrom, historyDays)
  );
  const zeroData = data !== null && Object.values(data.summary).every((value) => value === null || value === 0);
  const dateRange = data?.range
    ? `${formatDate(data.range.start)} – ${formatDate(data.range.end)}`
    : custom && appliedCustom
      ? `${formatDate(appliedCustom.from)} – ${formatDate(appliedCustom.to)}`
      : `Last ${preset.slice(0, -1)} days`;

  async function startCheckout() {
    if (plan !== "free" || checkoutBusy) return;
    setCheckoutBusy(true);
    setBillingError(false);
    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": crypto.randomUUID(),
        },
        body: JSON.stringify({ plan: "plus", interval }),
      });
      const body = await response.json() as { checkoutUrl?: unknown };
      if (response.ok && typeof body.checkoutUrl === "string") {
        const checkoutUrl = new URL(body.checkoutUrl);
        if (checkoutUrl.protocol === "https:" && ["checkout.dodopayments.com", "test.checkout.dodopayments.com"].includes(checkoutUrl.hostname)) {
          window.location.assign(checkoutUrl.toString());
          return;
        }
      }
      setBillingError(true);
    } catch {
      setBillingError(true);
    }
    setCheckoutBusy(false);
  }

  async function openBillingPortal() {
    if (plan !== "plus" || portalBusy) return;
    setPortalBusy(true);
    setBillingError(false);
    try {
      const response = await fetch("/api/billing/portal", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      const body = await response.json() as { portalUrl?: unknown };
      if (response.ok && typeof body.portalUrl === "string") {
        const portalUrl = new URL(body.portalUrl);
        if (portalUrl.protocol === "https:" && ["customer.dodopayments.com", "test.customer.dodopayments.com"].includes(portalUrl.hostname)) {
          window.location.assign(portalUrl.toString());
          return;
        }
      }
      setBillingError(true);
    } catch {
      setBillingError(true);
    }
    setPortalBusy(false);
  }

  const exportHref = data?.plan === "pro" && data.capabilities?.exports === true
    ? `/api/analytics/export?range=${appliedCustom ? "90d" : preset}${appliedCustom ? `&from=${encodeURIComponent(appliedCustom.from)}&to=${encodeURIComponent(appliedCustom.to)}` : ""}`
    : null;

  return (
    <main className="mx-auto min-h-[calc(100dvh-60px)] w-full max-w-6xl px-4 pb-28 pt-7 sm:px-6 sm:pt-9 md:min-h-[calc(100dvh-76px)] md:px-8 md:pb-10">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="font-label text-[10px] uppercase tracking-[0.2em] text-black/55">Your Setuvara · Signals</p>
          <h1 className="mt-2 font-display text-[clamp(38px,7vw,64px)] font-bold leading-[0.94] tracking-[-0.06em]">Analytics</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-black/65 sm:text-base">See what happens after you share your identity.</p>
        </div>
        {data && <div className="flex flex-col items-start gap-2 sm:items-end">
          <span className="font-label text-[10px] uppercase tracking-[0.15em] text-black/50">Showing {dateRange}</span>
          {availablePresets.length > 1 || canUseCustom ? <div aria-label="Analytics date range" className="flex max-w-full flex-wrap gap-1 rounded-full bg-black/[0.06] p-1" role="group">
            {availablePresets.map((item) => (
              <button aria-pressed={!custom && preset === item.value} className={`min-h-10 rounded-full px-3 text-[13px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 ${!custom && preset === item.value ? "bg-[#0d0d0d] text-[#f5f4ef]" : "text-black/65 hover:text-black"}`} key={item.value} onClick={() => { setLoading(true); setLoadError(false); setCustom(false); setAppliedCustom(null); setPreset(item.value); }} type="button">{item.label}</button>
            ))}
            {canUseCustom && <button aria-pressed={custom} className={`min-h-10 rounded-full px-3 text-[13px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 ${custom ? "bg-[#0d0d0d] text-[#f5f4ef]" : "text-black/65 hover:text-black"}`} onClick={() => setCustom(true)} type="button">Custom</button>}
          </div> : <span className="rounded-full bg-white px-3 py-2 text-xs font-semibold">7 days</span>}
        </div>}
      </header>

      {custom && canUseCustom && <section aria-label="Custom analytics date range" className="mt-5 flex flex-col gap-3 rounded-[20px] bg-white p-4 sm:flex-row sm:items-end">
        <label className="flex min-w-0 flex-1 flex-col gap-1.5 text-xs font-semibold" htmlFor="analytics-from">From<input className={field} id="analytics-from" max={customTo || undefined} min={offsetDate(1 - historyDays)} onChange={(event) => setCustomFrom(event.target.value)} type="date" value={customFrom} /></label>
        <label className="flex min-w-0 flex-1 flex-col gap-1.5 text-xs font-semibold" htmlFor="analytics-to">To<input className={field} id="analytics-to" max={offsetDate(0)} min={customFrom || undefined} onChange={(event) => setCustomTo(event.target.value)} type="date" value={customTo} /></label>
        <button className="min-h-11 rounded-full bg-[#0d0d0d] px-5 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff5a4f] disabled:cursor-not-allowed disabled:opacity-45" disabled={!rangeValid || loading} onClick={() => { setLoading(true); setLoadError(false); setAppliedCustom({ from: customFrom, to: customTo }); }} type="button">Apply dates</button>
        {!rangeValid && <p className="basis-full text-sm text-[#a43d36]" role="alert">Choose a valid range within your {historyDays}-day history.</p>}
      </section>}

      {loading && !data && <LoadingState />}
      {loadError && <section className={`${panel} mt-6`} role="alert"><p className="font-display text-2xl font-bold tracking-[-0.04em]">Your signals are taking a moment.</p><p className="mt-2 text-sm leading-6 text-black/65">We couldn’t load analytics right now. Your profile and connections are safe.</p><button className="mt-4 inline-flex min-h-11 items-center rounded-full bg-[#0d0d0d] px-5 text-sm font-semibold text-white focus-visible:outline-2" onClick={() => { setLoading(true); setLoadError(false); setReload((value) => value + 1); }} type="button">Try again</button></section>}

      {data && !loadError && <>
        {loading && <p aria-live="polite" className="mt-4 text-xs text-black/55">Updating your signals…</p>}
        <section aria-label="Analytics summary" className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <MetricCard accent label="Profile views" value={data.summary.profileViews} />
          <MetricCard label="Connections" value={data.summary.connections} />
          <MetricCard label="QR scans" value={data.summary.qrScans} />
          <MetricCard label="Quick QR" value={data.summary.quickQrScans} />
          <MetricCard label="Tap scans" value={data.summary.tapScans} />
        </section>

        {zeroData ? <section className={`${panel} mt-4`}><p className="font-label text-[10px] uppercase tracking-[0.17em] text-black/50">A clear start</p><h2 className="mt-2 font-display text-2xl font-bold tracking-[-0.04em]">Your first signal is on its way.</h2><p className="mt-2 max-w-xl text-sm leading-6 text-black/65">When someone opens your profile or connects with you, the activity will appear here.</p></section>
          : data.plan !== "free" && data.daily?.length ? <DailyChart data={data.daily} /> : null}

        {data.comparison && (data.comparison.profileViewsDelta !== null || data.comparison.connectionsDelta !== null) && <div aria-label="Compared with the previous period" className="mt-3 grid gap-3 sm:grid-cols-2">
          {data.comparison.profileViewsDelta !== null && <ComparisonCard label="Profile views" value={data.comparison.profileViewsDelta} />}
          {data.comparison.connectionsDelta !== null && <ComparisonCard label="Connections" value={data.comparison.connectionsDelta} />}
        </div>}

        {data.plan !== "free" && data.summary.conversionRate !== undefined && data.summary.conversionRate !== null && <section className={`${panel} mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between`}>
          <div><p className="font-label text-[10px] uppercase tracking-[0.17em] text-black/50">From view to connection</p><h2 className="mt-1 font-display text-2xl font-bold tracking-[-0.04em]">Connection rate</h2><p className="mt-1 text-sm text-black/65">Connections compared with profile views.</p></div>
          <p className="font-display text-5xl font-bold leading-none tracking-[-0.06em] text-[#0d0d0d]">{formatPercent(data.summary.conversionRate)}</p>
        </section>}

        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {data.plan !== "free" && data.sources && <Breakdown title="How people arrived" subtitle="Share source" items={data.sources.map((item) => ({ label: humanize(item.source), count: item.count }))} />}
          {data.plan !== "free" && data.modes && <Breakdown title="The Mode they opened" subtitle="Profile views by Mode" items={data.modes.map((item) => ({ label: humanize(item.mode), count: item.count }))} />}
          {data.plan === "pro" && data.funnel && <Breakdown title="From scan to connection" subtitle="Connection journey" items={data.funnel.map((item) => ({ label: humanize(item.step), count: item.count }))} />}
          {data.plan === "pro" && data.deviceClasses && <Breakdown title="Where they opened it" subtitle="Device type" items={data.deviceClasses.map((item) => ({ label: humanize(item.device), count: item.count }))} />}
        </div>

        {exportHref && <div className="mt-4 flex flex-col gap-3 rounded-[22px] border border-black/10 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div><h2 className="font-semibold">Keep a copy of this period</h2><p className="mt-1 text-sm text-black/60">Download the analytics currently shown as a CSV.</p></div>
          <a className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#0d0d0d] px-5 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff5a4f]" href={exportHref}>Download CSV</a>
        </div>}

        {targetPlan && <UpgradeCard currentPlan={plan} busy={portalBusy} onUpgrade={() => { setBillingError(false); if (plan === "free") setUpgradeOpen(true); else void openBillingPortal(); }} />}
        {billingError && !upgradeOpen && <p aria-live="polite" className="mt-3 text-sm text-[#a43d36]" role="alert">Your billing page could not open. Try again or use the account menu to manage your plan.</p>}
        <p className="mt-5 text-center font-label text-[10px] tracking-[0.08em] text-black/40">Signals are private to you. Counts use the activity Setuvara can verify.</p>
      </>}

      {upgradeOpen && plan === "free" && <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/55 p-0 sm:items-center sm:p-5" onMouseDown={(event) => { if (event.target === event.currentTarget && !checkoutBusy) setUpgradeOpen(false); }}>
        <section aria-labelledby="analytics-upgrade-title" aria-modal="true" className="w-full max-w-md rounded-t-[28px] bg-[#f5f4ef] p-6 pb-[calc(24px+env(safe-area-inset-bottom))] text-[#0d0d0d] shadow-2xl sm:rounded-[28px] sm:p-7" ref={upgradeDialogRef} role="dialog" tabIndex={-1}>
          <div className="flex items-start justify-between gap-4"><div><p className="font-label text-[10px] uppercase tracking-[0.18em] text-black/50">More room to understand your reach</p><h2 className="mt-2 font-display text-3xl font-bold tracking-[-0.05em]" id="analytics-upgrade-title">Setuvara Plus</h2></div><button aria-label="Close upgrade options" className="grid size-11 shrink-0 place-items-center rounded-full bg-black/[0.06] text-xl focus-visible:outline-2" disabled={checkoutBusy} onClick={() => setUpgradeOpen(false)} type="button">×</button></div>
          <p className="mt-3 text-sm leading-6 text-black/65">Choose a billing interval. You’ll review the subscription on Dodo before any payment is made.</p>
          <fieldset className="mt-5 grid grid-cols-2 gap-2"><legend className="mb-2 text-sm font-semibold">Billing interval</legend>
            {(["monthly", "yearly"] as const).map((item) => <label className={`flex min-h-[58px] cursor-pointer items-center gap-3 rounded-2xl border px-4 text-sm font-semibold ${interval === item ? "border-[#0d0d0d] bg-white" : "border-black/15"}`} key={item}><input checked={interval === item} className="size-4 accent-[#ff5a4f]" name="analytics-billing-interval" onChange={() => setInterval(item)} type="radio" value={item} />{item === "monthly" ? "Monthly" : "Yearly"}</label>)}
          </fieldset>
          {billingError && <p aria-live="polite" className="mt-3 text-sm text-[#a43d36]" role="alert">Checkout could not open. Try again in a moment.</p>}
          <button className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-[#ff5a4f] px-5 text-sm font-bold text-[#0d0d0d] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0d0d0d] disabled:cursor-wait disabled:opacity-60" disabled={checkoutBusy} onClick={() => void startCheckout()} type="button">{checkoutBusy ? "Preparing checkout…" : "Continue to Plus"}</button>
        </section>
      </div>}
    </main>
  );
}

function MetricCard({ label, value, accent = false }: { label: string; value: number; accent?: boolean }) {
  return <article className={`min-w-0 rounded-[22px] p-4 sm:p-5 ${accent ? "bg-[#0d0d0d] text-[#f5f4ef]" : "bg-white text-[#0d0d0d]"}`}>
    <p className={`truncate font-label text-[10px] uppercase tracking-[0.12em] ${accent ? "text-white/65" : "text-black/50"}`}>{label}</p>
    <p className={`mt-3 font-display text-[clamp(32px,8vw,48px)] font-bold leading-none tracking-[-0.06em] ${accent ? "text-[#ff5a4f]" : ""}`}>{value.toLocaleString()}</p>
    <p className={`mt-2 text-xs ${accent ? "text-white/55" : "text-black/50"}`}>in this period</p>
  </article>;
}

function DailyChart({ data }: { data: DailyPoint[] }) {
  const max = Math.max(1, ...data.flatMap((item) => [item.profileViews, item.connections]));
  const width = 720;
  const height = 172;
  const left = 8;
  const right = 8;
  const top = 12;
  const bottom = 132;
  const plotHeight = bottom - top;
  const slot = (width - left - right) / Math.max(data.length, 1);
  const barWidth = Math.max(1.2, Math.min(7, slot * 0.32));
  const labelIndexes = [...new Set([0, Math.floor((data.length - 1) / 2), data.length - 1])];

  return <section className={`${panel} mt-4`}>
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-label text-[10px] uppercase tracking-[0.17em] text-black/50">Daily activity</p><h2 className="mt-1 font-display text-2xl font-bold tracking-[-0.04em]">People are finding you</h2></div>
      <div aria-label="Chart legend" className="flex gap-4 text-xs text-black/65"><span className="inline-flex items-center gap-1.5"><i aria-hidden="true" className="size-2.5 rounded-sm bg-[#0d0d0d]" />Views</span><span className="inline-flex items-center gap-1.5"><i aria-hidden="true" className="size-2.5 rounded-sm bg-[#ff5a4f]" />Connections</span></div></div>
    <div className="mt-5 overflow-hidden">
      <svg aria-label={`Daily profile views and connections, ${data.length} days`} className="block h-auto w-full" role="img" viewBox={`0 0 ${width} ${height}`}>
        {[0, 1, 2, 3].map((line) => { const y = top + (plotHeight / 3) * line; return <line key={line} stroke="rgba(13,13,13,.09)" strokeDasharray={line === 3 ? undefined : "3 5"} x1={left} x2={width - right} y1={y} y2={y} />; })}
        {data.map((item, index) => {
          const x = left + (index * slot) + ((slot - (barWidth * 2 + 1)) / 2);
          const viewsHeight = Math.max(item.profileViews > 0 ? 1 : 0, (item.profileViews / max) * plotHeight);
          const connectionsHeight = Math.max(item.connections > 0 ? 1 : 0, (item.connections / max) * plotHeight);
          return <g key={item.date}><title>{`${formatDate(item.date)}: ${item.profileViews} profile views, ${item.connections} connections`}</title><rect fill="#0d0d0d" height={viewsHeight} rx="1.5" width={barWidth} x={x} y={bottom - viewsHeight} /><rect fill="#ff5a4f" height={connectionsHeight} rx="1.5" width={barWidth} x={x + barWidth + 1} y={bottom - connectionsHeight} /></g>;
        })}
        {labelIndexes.map((index) => { const item = data[index]; if (!item) return null; const x = left + (index * slot) + slot / 2; return <text fill="rgba(13,13,13,.5)" fontSize="10" key={item.date} textAnchor={index === 0 ? "start" : index === data.length - 1 ? "end" : "middle"} x={index === 0 ? left : index === data.length - 1 ? width - right : x} y="160">{formatShortDate(item.date)}</text>; })}
      </svg>
    </div>
  </section>;
}

function ComparisonCard({ label, value }: { label: string; value: number }) {
  const positive = value > 0;
  return <p className="rounded-[18px] border border-black/10 px-4 py-3 text-sm"><span className="font-semibold">{label}</span><span className="ml-2 text-black/60">{value === 0 ? "No change" : `${positive ? "+" : "−"}${Math.abs(value).toLocaleString()} vs previous period`}</span></p>;
}

function Breakdown({ title, subtitle, items }: { title: string; subtitle: string; items: { label: string; count: number }[] }) {
  const max = Math.max(1, ...items.map((item) => item.count));
  return <section className={panel}>
    <p className="font-label text-[10px] uppercase tracking-[0.17em] text-black/50">{subtitle}</p><h2 className="mt-1 font-display text-xl font-bold tracking-[-0.035em]">{title}</h2>
    {items.length ? <ul className="mt-4 space-y-3">{items.map((item) => <li key={item.label}><div className="mb-1 flex items-baseline justify-between gap-3 text-sm"><span className="truncate">{item.label}</span><span className="shrink-0 font-semibold tabular-nums">{item.count.toLocaleString()}</span></div><div aria-hidden="true" className="h-1.5 overflow-hidden rounded-full bg-black/[0.07]"><span className="block h-full rounded-full bg-[#ff5a4f]" style={{ width: `${Math.max(item.count > 0 ? 3 : 0, (item.count / max) * 100)}%` }} /></div></li>)}</ul> : <p className="mt-4 text-sm text-black/55">No activity to show in this period yet.</p>}
  </section>;
}

function UpgradeCard({ currentPlan, busy, onUpgrade }: { currentPlan: Plan; busy: boolean; onUpgrade: () => void }) {
  const isProUpgrade = currentPlan === "plus";
  return <section className="mt-5 flex flex-col gap-4 rounded-[24px] border border-black/10 bg-[#e8e2d4] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
    <div className="min-w-0"><p className="font-label text-[10px] uppercase tracking-[0.17em] text-black/55">{isProUpgrade ? "Setuvara Pro" : "More than the first signal"}</p><h2 className="mt-1 font-display text-2xl font-bold tracking-[-0.04em]">{isProUpgrade ? "See the full journey." : "Understand what’s working."}</h2><p className="mt-1 max-w-xl text-sm leading-6 text-black/65">{isProUpgrade ? "Explore the connection funnel and available device insights." : "Compare time periods and see which Modes and share sources bring people to you."}</p></div>
    <button className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-full bg-[#0d0d0d] px-5 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff5a4f] disabled:opacity-60" disabled={busy} onClick={onUpgrade} type="button">{busy ? "Opening…" : isProUpgrade ? "Manage plan" : "Explore Plus"}</button>
  </section>;
}

function LoadingState() {
  return <div aria-busy="true" aria-label="Loading analytics" className="mt-6" role="status"><span className="sr-only">Loading your signals…</span><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">{[0, 1, 2, 3, 4].map((item) => <div className="h-[122px] animate-pulse rounded-[22px] bg-black/[0.06]" key={item} />)}</div><div className="mt-4 h-[255px] animate-pulse rounded-[24px] bg-white" /></div>;
}

function normalizeAnalytics(value: unknown): AnalyticsData | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const summary = raw.summary as Record<string, unknown> | undefined;
  if (!summary || !["free", "plus", "pro"].includes(String(raw.plan))) return null;
  const number = (camel: string, snake: string) => {
    const candidate = summary[snake] ?? summary[camel];
    return typeof candidate === "number" && Number.isFinite(candidate) ? candidate : null;
  };
  const profileViews = number("profileViews", "profile_views");
  const qrScans = number("qrScans", "qr_scans");
  const quickQrScans = number("quickQrScans", "quick_qr_scans");
  const tapScans = number("tapScans", "tap_scans");
  const connections = number("connections", "connections");
  if ([profileViews, qrScans, quickQrScans, tapScans, connections].some((item) => item === null)) return null;

  const capabilitiesRaw = raw.capabilities && typeof raw.capabilities === "object" ? raw.capabilities as Record<string, unknown> : undefined;
  const rangeRaw = raw.range && typeof raw.range === "object" ? raw.range as Record<string, unknown> : undefined;
  const comparisonRaw = raw.comparison && typeof raw.comparison === "object" ? raw.comparison as Record<string, unknown> : undefined;
  const list = <T,>(...keys: string[]): T[] | undefined => {
    for (const key of keys) if (Array.isArray(raw[key])) return raw[key] as T[];
    return undefined;
  };
  const optionalNumber = (camel: string, snake: string) => {
    const item = summary[snake] ?? summary[camel];
    return typeof item === "number" && Number.isFinite(item) ? item : null;
  };
  const daily = list<Record<string, unknown>>("daily")?.flatMap((item) => {
    const date = typeof item.date === "string" ? item.date : null;
    const views = item.profile_views ?? item.profileViews;
    const connects = item.connections;
    return date && typeof views === "number" && typeof connects === "number"
      ? [{ date, profileViews: views, connections: connects }]
      : [];
  });
  const sources = list<{ source: string; count: number }>("sources", "sourceBreakdown");
  const modes = list<{ mode: string; count: number }>("modes", "modeBreakdown");
  const funnel = list<{ step: string; count: number }>("funnel");
  const rawDevices = list<Record<string, unknown>>("deviceClasses", "device_classes", "devices", "deviceBreakdown");
  const deviceClasses = rawDevices?.flatMap((item) => {
    const device = typeof item.device_class === "string" ? item.device_class : typeof item.device === "string" ? item.device : null;
    return device && typeof item.count === "number" ? [{ device, count: item.count }] : [];
  });
  const delta = (camel: string, snake: string) => {
    const item = comparisonRaw?.[snake] ?? comparisonRaw?.[camel];
    return typeof item === "number" && Number.isFinite(item) ? item : null;
  };
  const plan = raw.plan as Plan;
  const conversionRate = optionalNumber("conversionRate", "conversion_rate");
  const profileViewsDelta = delta("profileViewsDelta", "profile_views_delta");
  const connectionsDelta = delta("connectionsDelta", "connections_delta");

  return {
    plan,
    summary: {
      profileViews: profileViews!,
      qrScans: qrScans!,
      quickQrScans: quickQrScans!,
      tapScans: tapScans!,
      connections: connections!,
      ...(conversionRate !== null ? { conversionRate } : {}),
    },
    ...(typeof rangeRaw?.start === "string" && typeof rangeRaw.end === "string" ? { range: { kind: String(rangeRaw.kind ?? "range"), start: rangeRaw.start, end: rangeRaw.end } } : {}),
    ...(capabilitiesRaw ? { capabilities: {
      ...(typeof capabilitiesRaw.historyDays === "number" ? { historyDays: capabilitiesRaw.historyDays } : {}),
      ...(Array.isArray(capabilitiesRaw.availableRanges) ? { availableRanges: capabilitiesRaw.availableRanges.filter((item): item is string => typeof item === "string") } : {}),
      ...(typeof capabilitiesRaw.conversion === "boolean" ? { conversion: capabilitiesRaw.conversion } : {}),
      ...(typeof capabilitiesRaw.customRange === "boolean" ? { customRange: capabilitiesRaw.customRange } : {}),
      ...(typeof capabilitiesRaw.exports === "boolean" ? { exports: capabilitiesRaw.exports } : {}),
    } } : {}),
    ...(daily ? { daily } : {}),
    ...(sources ? { sources } : {}),
    ...(modes ? { modes } : {}),
    ...(funnel ? { funnel } : {}),
    ...(deviceClasses ? { deviceClasses } : {}),
    ...(comparisonRaw ? { comparison: { profileViewsDelta, connectionsDelta } } : {}),
  };
}

function offsetDate(offset: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

function isWithinHistory(from: string, historyDays: number) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from)) return false;
  const earliest = offsetDate(1 - historyDays);
  return from >= earliest && from <= offsetDate(0);
}

function formatDate(value: string) {
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en", { day: "numeric", month: "short", timeZone: "UTC" }).format(date);
}

function formatShortDate(value: string) {
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat("en", { day: "numeric", month: "short", timeZone: "UTC" }).format(date);
}

function formatPercent(value: number) {
  const percent = Math.max(0, Math.min(100, value));
  return `${percent.toLocaleString(undefined, { maximumFractionDigits: 1 })}%`;
}

function humanize(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
