import Link from "next/link";

import { passportDisplay } from "./fonts";

const mark = "M66.94 31.48A17 17 0 1 0 41.04 44.45L58.96 55.55A17 17 0 1 1 33.06 68.52";

function PassportLabel() {
  return (
    <div className="flex h-10 items-center gap-2 px-5 pt-1.5 sm:px-10 sm:pt-7 lg:px-[72px]">
      <svg aria-hidden="true" className="size-[18px]" viewBox="0 0 100 100"><path d={mark} fill="none" stroke="currentColor" strokeWidth="22" /></svg>
      <span className="font-label text-[11px] tracking-[0.16em]">YOUR PASSPORT</span>
    </div>
  );
}

/** Loading (18): skeletons keep the exact cover geometry (300 × 420) so nothing jumps. */
export function PassportSkeletonPage() {
  const pulse = "[animation:passport-pulse_1.4s_ease-in-out_infinite] motion-reduce:[animation:none]";
  return (
    <div aria-busy="true" className="mx-auto w-full max-w-[1440px] text-[#0D0D0D]" role="status">
      <div className="lg:hidden"><PassportLabel /></div>
      <div className="sm:grid sm:grid-cols-[270px_minmax(0,1fr)] sm:items-end sm:gap-10 sm:px-10 sm:pt-[30px] lg:grid-cols-[440px_minmax(0,1fr)] lg:items-start lg:gap-[72px] lg:px-[72px] lg:pt-14">
        <div className="flex justify-center pt-7 sm:justify-start sm:pt-0">
          <div className={`relative aspect-[300/420] w-[min(300px,calc(100vw-40px))] rounded-[5px_18px_18px_5px] bg-[#0D0D0D12] sm:w-[270px] lg:w-[390px] ${pulse}`}>
            <span className="absolute inset-y-0 left-[6.7%] w-px bg-[#0D0D0D14]" />
            <span className="absolute left-[28%] top-[14.8%] aspect-square w-[44%] rounded-full border-[1.5px] border-[#0D0D0D14]" />
            <span className="absolute bottom-[13.8%] left-[16%] h-[5.2%] w-1/2 rounded-md bg-[#0D0D0D12]" />
            <span className="absolute bottom-[7.6%] left-[16%] h-[2.9%] w-[30%] rounded-md bg-[#0D0D0D12]" />
          </div>
        </div>
        <div className={`flex flex-col gap-3 px-6 pt-10 sm:p-0 lg:pt-24 ${pulse}`}>
          <span className="h-[92px] w-[130px] rounded-xl bg-[#0D0D0D12] lg:h-[180px] lg:w-[300px]" />
          <span className="h-[22px] w-[190px] rounded-md bg-[#0D0D0D12]" />
          <span className="h-3.5 w-[min(300px,100%)] rounded-md bg-[#0D0D0D0D]" />
        </div>
      </div>
      <span className="sr-only">Opening your Passport…</span>
    </div>
  );
}

/** Error (18): only when get_passport_overview fails, never for an empty Passport. */
export function PassportUnavailable() {
  return (
    <main className={`${passportDisplay.variable} mx-auto flex min-h-[calc(100dvh-138px-env(safe-area-inset-bottom))] w-full max-w-[1440px] flex-col text-[#0D0D0D] sm:min-h-0`}>
      <PassportLabel />
      <div className="flex flex-1 flex-col sm:mx-auto sm:w-full sm:max-w-[520px] lg:max-w-[560px]">
        <div className="flex justify-center pt-7">
          <div className="flex aspect-[300/420] w-[min(300px,calc(100vw-40px))] items-center justify-center rounded-[5px_18px_18px_5px] border-[1.5px] border-dashed border-[#0D0D0D40]">
            <svg aria-hidden="true" className="size-16 text-[#0D0D0D40]" viewBox="0 0 100 100"><path d={mark} fill="none" stroke="currentColor" strokeWidth="22" /></svg>
          </div>
        </div>
        <div className="flex flex-col gap-3 px-6 pt-[34px]">
          <h1 className="font-display text-[34px] font-extrabold leading-none tracking-[-0.05em]">Your Passport didn&apos;t open.</h1>
          <p className="text-[15px] leading-[1.5] text-[#0D0D0DB3]">Nothing is lost. Stamps and milestones are saved to your account. This was only a loading problem.</p>
        </div>
        <div className="mx-6 mb-[34px] mt-auto flex flex-col gap-2.5 pt-10">
          <Link className="flex h-[52px] items-center justify-center rounded-full bg-[#0D0D0D] text-[16px] font-semibold text-[#F5F4EF] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0D0D0D]" href="/app/passport" prefetch={false}>Try again</Link>
        </div>
      </div>
    </main>
  );
}
