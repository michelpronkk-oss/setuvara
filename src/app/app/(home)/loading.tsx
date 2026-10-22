import { PeopleSkeleton } from "@/components/app/home/people-section";

/** Mirrors the Home layout, so nothing jumps when data arrives. */
export default function AppLoading() {
  return (
    <div aria-busy="true" className="mx-auto w-full max-w-[1480px] px-3.5 pb-10 pt-1 md:px-8 md:pt-8" role="status">
      <div className="px-1 pb-5 md:pb-7">
        <div className="h-[30px] w-56 rounded-lg bg-black/[0.07] md:h-10 md:w-72" />
        <div className="mt-3 h-4 w-80 max-w-full rounded bg-black/[0.05]" />
      </div>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(340px,1fr)] lg:gap-6">
        <div className="relative h-[min(62dvh,470px)] rounded-[28px] bg-[#1a1a1a] [clip-path:polygon(0_0,100%_0,100%_calc(100%-44px),calc(100%-25px)_100%,0_100%)] md:h-[560px] lg:h-[min(680px,calc(100dvh-180px))] lg:min-h-[560px] lg:rounded-[30px] lg:[clip-path:polygon(0_0,100%_0,100%_calc(100%-64px),calc(100%-37px)_100%,0_100%)]">
          <span className="absolute bottom-[70px] left-6 h-10 w-3/5 rounded-lg bg-[#2a2a2a] lg:bottom-[150px] lg:h-20" />
          <span className="absolute bottom-10 left-6 h-3.5 w-2/5 rounded bg-[#2a2a2a] lg:bottom-[110px]" />
        </div>
        <div className="flex min-w-0 flex-col gap-5 lg:gap-6"><PeopleSkeleton /></div>
      </div>
      <span className="sr-only">Loading your Setuvara…</span>
    </div>
  );
}
