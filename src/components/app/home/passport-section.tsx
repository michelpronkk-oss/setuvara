import Link from "next/link";

import { MILESTONES, PASSPORT_REWARDS } from "@/lib/passport/rewards";
import { hasCapability } from "@/lib/billing/capabilities";
import type { PlanCode } from "@/lib/billing/catalog";
import { createClient } from "@/lib/supabase/server";

type Overview = {
  connectionCount: number; cities: number; events: number; countries: number;
  stamps: { id: string; type: "milestone" | "event" | "city" | "country"; title: string; subtitle: string | null; countryCode: string | null; earnedAt: string }[];
};

const CUT = "[clip-path:polygon(0_0,100%_0,100%_calc(100%-44px),calc(100%-25px)_100%,0_100%)]";
const MAX_TICKS = 25;

export async function PassportSection({ plan }: { plan: PlanCode }) {
  const { data, error } = await (await createClient()).rpc("get_passport_overview");
  if (error || !data) return <PassportFallback />;
  const overview = data as unknown as Overview;
  const count = overview.connectionCount ?? 0;
  const next = MILESTONES.find((item) => item.threshold > count);
  const prev = [...MILESTONES].reverse().find((item) => item.threshold <= count)?.threshold ?? 0;
  const span = next ? next.threshold - prev : 1;
  const ticks = Math.min(span, MAX_TICKS);
  const filled = next ? Math.floor(((count - prev) / span) * ticks) : ticks;
  const left = next ? next.threshold - count : 0;
  const unlocks = next ? PASSPORT_REWARDS.filter((reward) => reward.milestone === next.threshold).map((reward) => reward.name) : [];
  const stamp = [...(overview.stamps ?? [])].sort((a, b) => Date.parse(b.earnedAt) - Date.parse(a.earnedAt))[0];
  const premiumFinish = hasCapability(plan, "passport.premium_treatment");
  const finishColor = plan === "pro" ? "#C7FF4A" : "#FF5A4F";
  const copy = !next
    ? "Thousand Met. The highest V1 milestone, and your record keeps growing."
    : count === 0
      ? `Five real connections open ${next.name}${unlocks.length ? `, with ${list(unlocks)}` : ""}.`
      : `${left} more ${left === 1 ? "person" : "people"} to ${next.name}.${unlocks.length ? ` It unlocks ${list(unlocks)}.` : ""}`;
  const stats = [overview.cities && `${overview.cities} ${overview.cities === 1 ? "CITY" : "CITIES"}`, overview.events && `${overview.events} ${overview.events === 1 ? "EVENT" : "EVENTS"}`, overview.countries && `${overview.countries} ${overview.countries === 1 ? "COUNTRY" : "COUNTRIES"}`].filter(Boolean).join(" · ");

  return (
    <Link aria-label={`Open your Passport. ${count} people met.${next ? ` ${left} to ${next.name}.` : ""}`} className={`flex flex-none flex-col gap-4 rounded-[26px] bg-[#e8e2d4] px-[22px] py-[22px] text-[#0d0d0d] transition-colors hover:bg-[#e2dbcb] focus-visible:outline-2 focus-visible:outline-offset-2 lg:gap-5 lg:px-7 lg:py-[26px] ${CUT}`} data-passport-finish={premiumFinish ? plan : "standard"} href="/app/passport" style={premiumFinish ? { boxShadow: `inset 0 0 0 2px ${finishColor}` } : undefined}>
      <div className="flex items-center justify-between">
        <span className="font-label text-[11px] tracking-[0.16em] lg:text-xs">SETUVARA PASSPORT</span>
        <span className="flex gap-2 text-sm font-semibold">Open<span aria-hidden="true">→</span></span>
      </div>
      <div className="flex items-end justify-between gap-5">
        <div className="flex items-baseline gap-3"><span className="font-display text-[72px] font-bold leading-[.8] tracking-[-0.06em] lg:text-[96px]">{count.toLocaleString()}</span><span className="text-[15px] font-semibold leading-tight lg:text-[17px]">{count === 1 ? "person met" : "people met"}</span></div>
        {next && <div className="flex flex-col items-end text-right"><span className="font-label text-[10px] tracking-[0.14em] text-black/65 lg:text-[11px]">NEXT · {next.threshold}</span><span className="font-display text-xl font-bold tracking-[-0.03em] lg:text-[26px]">{next.name}</span></div>}
      </div>
      <div aria-hidden="true" className="flex gap-[5px]">
        {Array.from({ length: ticks }, (_, index) => <span className={`h-3.5 flex-1 [clip-path:polygon(4px_0,100%_0,calc(100%-4px)_100%,0_100%)] ${index < filled ? "bg-[#0d0d0d]" : "shadow-[inset_0_0_0_1.5px_rgba(13,13,13,.35)]"}`} key={index} />)}
      </div>
      <p className="text-[15px] leading-[1.45] [text-wrap:pretty]">{copy}</p>
      <div className="flex items-center justify-between gap-4 border-t border-black/15 pt-4">
        <span className="flex min-w-0 items-center gap-3">
          <span aria-hidden="true" className={`grid size-10 shrink-0 place-items-center rounded-[10px] font-label text-[10px] tracking-[0.06em] [clip-path:polygon(0_0,100%_0,100%_calc(100%-12px),calc(100%-7px)_100%,0_100%)] ${stamp ? "bg-[#0d0d0d] text-[#c7ff4a]" : "shadow-[inset_0_0_0_1.5px_rgba(13,13,13,.35)]"}`}>{stamp ? stampCode(stamp) : "?"}</span>
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-[15px] font-semibold">{stamp ? stamp.title : "Your first stamp is waiting"}</span>
            <span className="truncate text-[13px] text-black/70">{stamp ? `${stamp.type[0].toUpperCase()}${stamp.type.slice(1)} stamp · ${new Intl.DateTimeFormat("en", { day: "numeric", month: "short" }).format(new Date(stamp.earnedAt))}` : "Meet someone at an event or in a new city"}</span>
          </span>
        </span>
        {stats && <span className="hidden whitespace-nowrap font-label text-xs tracking-[0.06em] sm:block">{stats}</span>}
      </div>
    </Link>
  );
}

function PassportFallback() {
  return (
    <Link className={`flex flex-col gap-2 rounded-[26px] bg-[#e8e2d4] p-6 text-[#0d0d0d] focus-visible:outline-2 lg:p-7 ${CUT}`} href="/app/passport">
      <span className="font-label text-xs tracking-[0.16em]">SETUVARA PASSPORT</span>
      <span className="font-display text-2xl font-bold tracking-[-0.03em]">Your Passport is taking a moment.</span>
      <span className="text-sm text-black/70">Open it to see your progress →</span>
    </Link>
  );
}

export function PassportSkeleton() {
  return <div aria-hidden="true" className={`h-[300px] flex-none rounded-[26px] bg-[#e8e2d4] lg:h-[340px] ${CUT}`} />;
}

function stampCode(stamp: Overview["stamps"][number]) {
  if (stamp.type === "country" && stamp.countryCode) return stamp.countryCode.toUpperCase();
  return (stamp.subtitle ?? stamp.title).replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase() || "★";
}

function list(items: string[]) {
  return items.length < 2 ? items[0] ?? "" : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}
