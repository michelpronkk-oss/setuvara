/**
 * The shape of a studio page while it loads: the dark header stage and a few cards, so the app
 * frame stays put and the page fades in where it will sit. It appears only after a short beat, so
 * a fast page never flashes it.
 */
export function StudioSkeleton({ cards = 3, frame = false }: { cards?: number; /** Studio routes draw their own sidebar; while they load, its place is held. */ frame?: boolean }) {
  const page = (
    <main aria-busy="true" className="sv-route-loader mx-auto w-full max-w-[1520px] px-3.5 pt-5 md:px-8 md:pt-7" role="status">
      <span className="sr-only">Loading…</span>
      <div aria-hidden="true" className="mb-6 h-[168px] animate-pulse rounded-[28px] bg-[#0D0D0D] md:mb-8 md:h-[204px] md:rounded-[32px]">
        <div className="flex h-full flex-col justify-end gap-3 px-5 pb-6 md:px-9 md:pb-9">
          <span className="h-2.5 w-28 rounded-full bg-[#F5F4EF]/15" />
          <span className="h-9 w-56 rounded-[10px] bg-[#F5F4EF]/20 md:h-11 md:w-72" />
        </div>
      </div>
      <div aria-hidden="true" className="grid gap-4 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="grid gap-4">
          {Array.from({ length: cards }, (_, index) => <div className="h-[132px] animate-pulse rounded-[24px] bg-white shadow-[inset_0_0_0_1px_rgba(13,13,13,.06)]" key={index} style={{ animationDelay: `${index * 120}ms` }} />)}
        </div>
        <div className="hidden h-[300px] animate-pulse rounded-[24px] bg-white shadow-[inset_0_0_0_1px_rgba(13,13,13,.06)] md:block" />
      </div>
    </main>
  );
  if (!frame) return page;
  return (
    <div className="min-h-dvh bg-[#F5F4EF] lg:pl-[268px]">
      <div aria-hidden="true" className="fixed inset-y-3 left-3 z-40 hidden w-[256px] flex-col gap-3 rounded-[26px] bg-[#0D0D0D] p-5 shadow-[0_30px_60px_-34px_rgba(13,13,13,.8)] lg:flex">
        <span className="h-7 w-28 rounded-[8px] bg-[#F5F4EF]/10" />
        {[0, 1, 2, 3, 4, 5].map((row) => <span className="mt-2 h-4 w-40 rounded-full bg-[#F5F4EF]/[0.07]" key={row} />)}
      </div>
      {page}
    </div>
  );
}
