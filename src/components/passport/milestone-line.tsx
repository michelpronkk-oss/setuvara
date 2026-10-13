import { milestoneRuler, nextMilestone } from "@/lib/passport/view";

/** The printed milestone line (Passport .dc): eight ordinal markers, a fill inside the active segment. */
export function MilestoneLine({ count }: { count: number }) {
  const { markers, fill } = milestoneRuler(count);
  const next = nextMilestone(count);
  return (
    <div
      aria-label={next ? `${count.toLocaleString("en")} Connections. Next milestone: ${next.name} at ${next.threshold}.` : `${count.toLocaleString("en")} Connections. Every milestone earned.`}
      className="relative mx-2 h-16 sm:h-14 lg:mx-2.5 lg:h-[62px]"
      data-milestone-line=""
      role="img"
    >
      <span className="absolute inset-x-0 top-7 h-px bg-[#0D0D0D40] sm:top-5 lg:top-6" />
      <span className="absolute left-0 top-[27.5px] h-0.5 bg-[#0D0D0D] sm:top-[19.5px] lg:top-[23.5px]" style={{ width: `${fill}%` }} />
      <span className="absolute top-0 -translate-x-1/2 rounded-full bg-[#FF5A4F] px-1.5 py-0.5 font-label text-[10px] leading-[1.2] sm:hidden" style={{ left: `${fill}%` }}>{count.toLocaleString("en")}</span>
      {markers.map((marker) => (
        <span className="absolute top-[21px] flex -translate-x-1/2 flex-col items-center gap-[9px] sm:top-[13px] lg:top-4 lg:gap-2.5" data-marker-state={marker.state} key={marker.threshold} style={{ left: `${marker.x}%` }}>
          <span className={`box-border size-[15px] rounded-full border-2 lg:size-[17px] ${marker.state === "earned" ? "border-[#0D0D0D] bg-[#0D0D0D]" : marker.state === "next" ? "border-[#FF5A4F] bg-[#F5F4EF]" : "border-[#0D0D0D40] bg-[#F5F4EF]"}`} />
          <span className={`font-label text-[10.5px] leading-none lg:text-[12px] ${marker.state === "future" ? "text-[#0D0D0D80]" : "text-[#0D0D0D]"}`}>{marker.threshold}</span>
        </span>
      ))}
    </div>
  );
}
