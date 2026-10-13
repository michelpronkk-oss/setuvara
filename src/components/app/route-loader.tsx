import { meetMarkBottom, meetMarkTop } from "@/components/marketing/brand";

/** Branded fallback for /app pages: the Meet mark halves part and meet while the page streams in. */
export function RouteLoader({ fullscreen = false }: { fullscreen?: boolean }) {
  return (
    <div aria-busy="true" className={`sv-route-loader grid place-items-center bg-[#f5f4ef] ${fullscreen ? "min-h-dvh" : "min-h-[calc(100dvh-60px-78px-env(safe-area-inset-bottom))] md:min-h-[calc(100dvh-76px)]"}`} role="status">
      <span className="relative grid size-16 place-items-center">
        <span aria-hidden="true" className="sv-loader-halo absolute inset-0 rounded-full bg-[#ff5a4f]/25" />
        <svg aria-hidden="true" className="relative size-11 overflow-visible" focusable="false" viewBox="0 0 100 100">
          <path className="sv-loader-top" d={meetMarkTop} fill="#ff5a4f" />
          <path className="sv-loader-bottom" d={meetMarkBottom} fill="#0d0d0d" />
        </svg>
      </span>
      <span className="sr-only">Loading…</span>
    </div>
  );
}
