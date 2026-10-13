"use client";

import { MemberBadge } from "@/components/app/status-badge";
import { getPublicPlan } from "@/lib/billing/catalog";
import { formatPrice, PLAN_COUNTS } from "@/lib/billing/plan-copy";

import { usePricing } from "./pricing-context";
import { Check, H2, SoonPill } from "./shared";

type Cell = true | false | string | { text: string; muted: true };
type Row = { label: string; cells: [Cell, Cell, Cell]; soon?: boolean };
type Group = { name: string; color: string; rows: Row[] };

const m = (text: string): Cell => ({ text, muted: true });

const GROUPS: Group[] = [
  { name: "Identity", color: "text-ink/65", rows: [
    { label: "Personal, Event and Business Modes", cells: [true, true, true] },
    { label: "Public profile, links and content blocks", cells: [true, true, true] },
    { label: "Profile soundtrack", cells: [true, true, true] },
    { label: "Member badge", cells: [false, "Plus", "Pro"] },
    { label: "“Made with Setuvara” on your profile", cells: [m("Shown"), "Removed", "Removed"] },
    { label: "Photo slideshow", cells: [false, `${PLAN_COUNTS.plusSlides} photos`, `${PLAN_COUNTS.proSlides} photos`] },
  ] },
  { name: "Appearance", color: "text-ink/65", rows: [
    { label: "Appearances", cells: [m("Immersive and Clean"), `All ${PLAN_COUNTS.appearances}`, `All ${PLAN_COUNTS.appearances}`] },
    { label: "Name fonts", cells: [m(String(PLAN_COUNTS.freeNameFonts)), String(PLAN_COUNTS.nameFonts), String(PLAN_COUNTS.nameFonts)] },
    { label: "Accent intensity, cards, links and scroll cues", cells: [m("Core"), "Full", "Full"] },
    { label: "Soundtrack presentation", cells: [m("Standard"), "Premium", "Premium"] },
    { label: "Profile flair from your Passport", cells: [false, true, true] },
  ] },
  { name: "Sharing", color: "text-ink/65", rows: [
    { label: "Link, QR and Quick QR", cells: [true, true, true] },
    { label: "QR styles", cells: [m("Standard"), `All ${PLAN_COUNTS.qrStyles}`, `All ${PLAN_COUNTS.qrStyles}`] },
    { label: "Tap card", cells: [m("Core"), m("Core"), m("Core")], soon: true },
    { label: "Wallet pass", cells: [m("Core"), "Premium look", "Premium look"], soon: true },
  ] },
  { name: "Analytics", color: "text-[#a43d36]", rows: [
    { label: "Views, scans and Connections", cells: [true, true, true] },
    { label: "History", cells: [m("7 days"), "30 and 90 days", "Custom, up to 2 years"] },
    { label: "Source and Mode breakdowns", cells: [false, true, true] },
    { label: "View to Connection conversion", cells: [false, true, true] },
    { label: "Connection journey funnel", cells: [false, false, true] },
    { label: "Device and Tap sharing insights", cells: [false, false, true] },
    { label: "Export to CSV", cells: [false, false, true] },
  ] },
  { name: "Connections & Passport", color: "text-ink/65", rows: [
    { label: "Connect and remember where and when", cells: [true, true, true] },
    { label: "Guest Connect", cells: [true, true, true] },
    { label: "Private notes", cells: [true, true, true] },
    { label: "Passport, stamps, milestones and earned covers", cells: [true, true, true] },
    { label: "Member Passport finish", cells: [false, true, true] },
  ] },
  { name: "Coming to Pro", color: "text-[#8a6a2c]", rows: [
    { label: "Your own domain", cells: [false, false, m("Coming soon")], soon: true },
    { label: "Advanced actions and lead capture", cells: [false, false, m("Coming soon")], soon: true },
    { label: "Webhooks and integrations", cells: [false, false, m("Coming soon")], soon: true },
  ] },
];

const PLAN_NAMES = ["Free", "Plus", "Pro"] as const;

function CellView({ cell, plan }: { cell: Cell; plan: number }) {
  if (cell === true) return <><Check className="mt-0 size-[18px]" /><span className="sr-only">Included in {PLAN_NAMES[plan]}</span></>;
  if (cell === false) return <><span aria-hidden="true" className="h-[1.5px] w-3 bg-ink/20" /><span className="sr-only">Not in {PLAN_NAMES[plan]}</span></>;
  if (typeof cell === "string") return <span>{cell}</span>;
  return <span className="text-ink/70">{cell.text}</span>;
}

export function Compare() {
  const { interval } = usePricing();
  const short = (plan: "plus" | "pro") => interval === "yearly" ? `${formatPrice(getPublicPlan(plan).yearlyPriceMinor)} / year` : `${formatPrice(getPublicPlan(plan).monthlyPriceMinor)} / month`;
  const grid = "grid grid-cols-[minmax(0,1.5fr)_repeat(3,minmax(0,1fr))] gap-3";

  return (
    <section aria-labelledby="compare-title" className="scroll-mt-16 bg-white" id="compare">
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-[clamp(32px,4vw,48px)] px-5 py-[clamp(72px,9vw,140px)] sm:px-8 lg:px-14">
        <H2 id="compare-title">Compare plans.</H2>
        <div className="flex flex-col" role="table" aria-label="Plan comparison">
          <div className={`${grid} sticky top-16 z-[5] items-end border-b-[1.5px] border-ink bg-white py-3.5 lg:top-[72px]`} role="row">
            <span role="columnheader"><span className="sr-only">Feature</span></span>
            <div className="flex flex-col gap-0.5" role="columnheader"><span className="font-display text-[clamp(18px,2vw,24px)] font-bold tracking-[-0.03em]">Free</span><span className="text-[13px] text-ink/70">$0</span></div>
            <div className="flex flex-col gap-0.5" role="columnheader"><span className="flex items-center gap-1.5 font-display text-[clamp(18px,2vw,24px)] font-bold tracking-[-0.03em]">Plus<MemberBadge decorative size={16} tier="plus" /></span><span className="text-[13px] text-ink/70">{short("plus")}</span></div>
            <div className="flex flex-col gap-0.5" role="columnheader"><span className="flex items-center gap-1.5 font-display text-[clamp(18px,2vw,24px)] font-bold tracking-[-0.03em]">Pro<MemberBadge decorative size={16} tier="pro" /></span><span className="text-[13px] text-ink/70">{short("pro")}</span></div>
          </div>
          {GROUPS.map((group) => (
            <div className="flex flex-col" key={group.name} role="rowgroup">
              <div role="row"><span className={`block pb-2.5 pt-8 font-label text-[11px] uppercase tracking-[0.14em] ${group.color}`} role="rowheader">{group.name}</span></div>
              {group.rows.map((row) => (
                <div className={`${grid} items-center border-b border-ink/[0.08] py-3.5 text-[15px]`} key={row.label} role="row">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1.5 pr-2 font-medium leading-[1.35]" role="rowheader">{row.label}{row.soon && group.name !== "Coming to Pro" && <SoonPill />}</span>
                  {row.cells.map((cell, index) => <span className="flex items-center text-sm leading-[1.35]" key={index} role="cell"><CellView cell={cell} plan={index} /></span>)}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
