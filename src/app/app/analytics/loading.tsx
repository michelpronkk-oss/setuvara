import { AnalyticsLoadingState } from "@/components/app/analytics/analytics-dashboard";

/** Mirrors the Analytics layout, so the page does not borrow the Home skeleton. */
export default function AnalyticsLoading() {
  return (
    <div className="mx-auto w-full max-w-[1440px] px-5 pb-10 pt-7 md:px-10 lg:px-16 lg:pb-14 lg:pt-9">
      <div className="mx-auto flex w-full max-w-[1312px] flex-col gap-11 lg:gap-14">
        <div aria-hidden="true" className="flex flex-col gap-4">
          <span className="font-label text-[11px] tracking-[0.16em]">YOUR SIGNALS</span>
          <span className="font-display text-[44px] font-extrabold leading-[0.95] tracking-[-0.05em] lg:text-[clamp(64px,5.8vw,84px)]">Your signals</span>
          <span className="h-[46px] w-[270px] animate-pulse rounded-full bg-[#0d0d0d]/[0.06]" />
        </div>
        <AnalyticsLoadingState />
      </div>
    </div>
  );
}
