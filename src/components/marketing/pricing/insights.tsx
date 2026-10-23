import { MemberBadge } from "@/components/app/status-badge";

import { RAIL, RAIL_ITEM } from "../site/kit";
import { H2, Lede, Mono, SECTION, SECTION_PAD, SectionHead } from "./shared";

// A fixed example series, so the sparkline renders the same on server and client.
const SERIES = [30, 27, 33, 29, 35, 31, 38, 34, 32, 37, 41, 39, 57, 52, 49, 54, 50, 56, 53, 58, 55, 60, 76, 70, 66, 69, 64, 68, 72, 70];
const LINE = SERIES.map((value, index) => `${index ? "L" : "M"}${(index * (300 / (SERIES.length - 1))).toFixed(1)} ${(80 - value).toFixed(1)}`).join("");

function Bar({ parts }: { parts: { size: number; color: string }[] }) {
  return <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full">{parts.map((part, index) => <div className={part.color} key={index} style={{ flex: part.size }} />)}</div>;
}

export function Insights() {
  return (
    <section aria-labelledby="insights-title" className="scroll-mt-16 bg-white" id="insights">
      <div className={`${SECTION} ${SECTION_PAD} gap-[clamp(36px,4vw,56px)]`}>
        <SectionHead lede={<Lede>Free shows it works. Plus shows why. Pro shows everything.</Lede>}>
          <div className="flex flex-col gap-5">
            <Mono className="text-coral">Insights</Mono>
            <H2 id="insights-title">See it.<br />Understand it.<br />Go deeper.</H2>
          </div>
        </SectionHead>

        <div aria-label="Example insights for each plan. Numbers are illustrative." className={`grid grid-cols-[minmax(0,1fr)] items-stretch gap-5 lg:grid-cols-3 ${RAIL}`} role="group">
          <article className={`flex flex-col gap-6 rounded-[28px] bg-paper p-[30px] ${RAIL_ITEM}`}>
            <div className="flex items-center justify-between"><Mono className="text-ink/65">Free</Mono><Mono className="text-ink/65">Last 7 days</Mono></div>
            <div className="grid grid-cols-3 gap-3">
              {[["28", "views"], ["6", "scans"], ["3", "Connections"]].map(([value, label]) => (
                <div className="flex flex-col gap-1" key={label}><span className="font-display text-[44px] font-extrabold leading-[0.9] tracking-[-0.05em]">{value}</span><span className="text-[13px] text-ink/70">{label}</span></div>
              ))}
            </div>
            <div aria-hidden="true" className="flex h-[72px] items-end gap-1.5">{[40, 55, 30, 70, 50, 85, 60].map((height, index) => <div className="flex-1 rounded bg-ink" key={index} style={{ height: `${height}%` }} />)}</div>
            <div className="mt-auto flex flex-col gap-1.5 border-t border-ink/10 pt-[18px]"><h3 className="m-0 font-display text-[clamp(20px,1.7vw,24px)] font-bold leading-[1.05] tracking-[-0.03em]">See it’s working.</h3><p className="m-0 text-[13px] text-ink/65">7 days of views, scans and Connections.</p></div>
          </article>

          <article className={`flex flex-col gap-[22px] rounded-[28px] bg-white p-[30px] shadow-[inset_0_0_0_2px_#ff5a4f,0_24px_48px_-28px_rgba(255,90,79,.6)] ${RAIL_ITEM}`}>
            <div className="flex items-center justify-between"><Mono className="flex items-center gap-2"><MemberBadge decorative size={16} tier="plus" />Plus</Mono><div className="flex gap-1 font-label text-[10px] tracking-[0.1em]"><span className="rounded-full bg-ink px-[9px] py-[5px] text-paper">30D</span><span className="rounded-full px-[9px] py-[5px] shadow-[inset_0_0_0_1px_rgba(13,13,13,.2)]">90D</span></div></div>
            <div className="flex items-end justify-between gap-3"><div className="flex flex-col gap-1"><Mono className="text-ink/65">Profile views</Mono><span className="font-display text-[44px] font-extrabold leading-[0.9] tracking-[-0.05em]">1,284</span></div><span className="text-[13px] font-semibold text-[#a43d36]">+22%</span></div>
            <svg aria-hidden="true" className="block h-16 w-full" preserveAspectRatio="none" viewBox="0 0 300 80"><path d={`${LINE}L300 80L0 80Z`} fill="#FF5A4F" fillOpacity=".14" /><path d={LINE} fill="none" stroke="#FF5A4F" strokeWidth="2" vectorEffect="non-scaling-stroke" /></svg>
            <div className="grid grid-cols-3 gap-2.5 border-t border-ink/10 pt-3.5">
              {[["Scans", "312"], ["Connect", "47"], ["View→Con", "3.7%"]].map(([label, value]) => <div className="flex flex-col gap-0.5" key={label}><Mono className="text-[9px] text-ink/65">{label}</Mono><span className="text-[22px] font-semibold">{value}</span></div>)}
            </div>
            <div className="flex flex-col gap-2"><Mono className="text-ink/65">Sources</Mono><Bar parts={[{ size: 48, color: "bg-ink" }, { size: 38, color: "bg-coral" }, { size: 14, color: "bg-sky" }]} /><div className={`flex flex-wrap gap-x-3.5 text-[12px] text-ink/80 ${RAIL}`}><span>Shared link 48%</span><span>QR code 38%</span><span>Quick QR 14%</span></div></div>
            <div className="flex flex-col gap-2"><Mono className="text-ink/65">Modes</Mono><Bar parts={[{ size: 52, color: "bg-coral" }, { size: 31, color: "bg-ink" }, { size: 17, color: "bg-sky" }]} /><div className={`flex flex-wrap gap-x-3.5 text-[12px] text-ink/80 ${RAIL}`}><span>Event 52%</span><span>Business 31%</span><span>Personal 17%</span></div></div>
            <div className="mt-auto flex flex-col gap-1.5 border-t border-ink/10 pt-[18px]"><h3 className="m-0 font-display text-[clamp(20px,1.7vw,24px)] font-bold leading-[1.05] tracking-[-0.03em]">Know how they find you.</h3><p className="m-0 text-[13px] text-ink/65">Sources, Modes and conversion. 30 or 90 days.</p></div>
          </article>

          <article className={`flex flex-col gap-[22px] rounded-[28px] bg-ink p-[30px] text-paper ${RAIL_ITEM}`}>
            <div className={`flex flex-wrap items-center justify-between gap-2.5 ${RAIL}`}><Mono className="flex items-center gap-2 text-[#e8d28a]"><MemberBadge decorative size={16} tier="pro" />Pro</Mono><span className="rounded-full px-2.5 py-1.5 font-label text-[10px] tracking-[0.1em] shadow-[inset_0_0_0_1px_rgba(245,244,239,.2)]">1 SEP → 10 OCT 2026</span></div>
            <div className="flex flex-col gap-3">
              <Mono className="text-paper/65">Connection journey</Mono>
              {[["You shared", "1,920", 100], ["People opened", "1,284", 67], ["People connected", "47", 3]].map(([label, value, width]) => (
                <div className="flex flex-col gap-1.5" key={label as string}>
                  <div className="flex justify-between text-[13px]"><span className="text-paper/80">{label}</span><b className="font-semibold">{value}</b></div>
                  <div className="h-2 rounded-full bg-paper/10"><div className="h-full rounded-full bg-[#d6b25e]" style={{ width: `${width}%` }} /></div>
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-2"><Mono className="text-paper/65">Devices</Mono><Bar parts={[{ size: 81, color: "bg-[#d6b25e]" }, { size: 15, color: "bg-paper/60" }, { size: 4, color: "bg-paper/25" }]} /><div className={`flex flex-wrap gap-x-3.5 text-[12px] text-paper/80 ${RAIL}`}><span>Phone 81%</span><span>Desktop 15%</span><span>Tablet 4%</span></div></div>
            <div className="flex items-center justify-between gap-3 border-t border-paper/10 pt-3.5"><div className="flex flex-col gap-0.5"><Mono className="text-[9px] text-paper/65">Range</Mono><span className="text-[22px] font-semibold">Up to 2 years</span></div><span className="flex h-[38px] items-center rounded-full px-4 text-[13px] font-semibold text-[#e8d28a] shadow-[inset_0_0_0_1px_#d6b25e]">Export CSV</span></div>
            <div className="mt-auto flex flex-col gap-1.5 border-t border-paper/10 pt-[18px]"><h3 className="m-0 font-display text-[clamp(20px,1.7vw,24px)] font-bold leading-[1.05] tracking-[-0.03em]">See the whole journey.</h3><p className="m-0 text-[13px] text-paper/65">Any range, devices and CSV.</p></div>
          </article>
        </div>
        <p className="m-0 text-center text-[13px] text-ink/60">Example numbers. Your own appear in Analytics.</p>
      </div>
    </section>
  );
}
