import { PassportSkeleton } from "@/components/app/home/passport-section";
import { PeopleSkeleton } from "@/components/app/home/people-section";

/** Mirrors the Home layout exactly, so nothing jumps when data arrives. */
export default function AppLoading() {
  return (
    <div aria-busy="true" className="px-3.5 pb-6 pt-0.5 md:px-8 md:pb-8 lg:grid lg:h-[calc(100dvh-76px)] lg:min-h-[680px] lg:grid-cols-[minmax(0,1.25fr)_minmax(400px,1fr)] lg:gap-6 lg:pt-1" role="status">
      <div className="relative h-[min(62dvh,470px)] rounded-[28px] bg-[#1a1a1a] [clip-path:polygon(0_0,100%_0,100%_calc(100%-44px),calc(100%-25px)_100%,0_100%)] md:h-[560px] lg:h-full lg:rounded-[30px] lg:[clip-path:polygon(0_0,100%_0,100%_calc(100%-64px),calc(100%-37px)_100%,0_100%)]">
        <span className="absolute bottom-[70px] left-6 h-10 w-3/5 rounded-lg bg-[#2a2a2a] lg:bottom-[150px] lg:h-20" />
        <span className="absolute bottom-10 left-6 h-3.5 w-2/5 rounded bg-[#2a2a2a] lg:bottom-[110px]" />
        <span className="absolute bottom-8 left-9 hidden h-[68px] w-[420px] rounded-[20px] bg-[#232323] lg:block" />
      </div>
      <div className="mt-3 flex flex-col gap-3 lg:hidden"><div className="h-14 rounded-[18px] bg-black/[0.07]" /><div className="h-14 rounded-full bg-[#ff5a4f]/40" /></div>
      <div className="mt-5 flex min-h-0 flex-col gap-6 lg:mt-0"><PeopleSkeleton /><PassportSkeleton /></div>
      <span className="sr-only">Loading your Setuvara…</span>
    </div>
  );
}
