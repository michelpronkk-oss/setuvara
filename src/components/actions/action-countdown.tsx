"use client";

import { useEffect, useState } from "react";

import { untilLabel } from "@/lib/actions/model";

/**
 * "Opens in 2d 4h" or "Closes in 5h", ticking each minute. The first render shows the date, so the
 * server and the browser agree; the countdown takes over once the page is live.
 */
export function ActionCountdown({ iso, verb, fallback, within, className = "", prefix = "", otherwise }: {
  iso: string;
  verb: "Opens" | "Closes";
  fallback: string;
  /** Only count down this close to the moment (ms). */
  within?: number;
  className?: string;
  /** Leads the countdown, as in "Giveaway · Closes in 2d". */
  prefix?: string;
  /** Shown instead while there is nothing to count down, so a card's line can turn into the countdown. */
  otherwise?: string;
}) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, 60_000);
    return () => { clearTimeout(first); clearInterval(timer); };
  }, []);
  const left = now === null ? null : new Date(iso).getTime() - now;
  const idle = (left !== null && (left <= 0 || (within !== undefined && left > within))) || (now === null && within !== undefined);
  if (idle) return otherwise ? <p className={className}>{otherwise}</p> : null;
  return <p className={className} data-action-countdown={verb.toLowerCase()} suppressHydrationWarning>{prefix}{now === null ? `${verb} ${fallback}` : `${verb} ${untilLabel(iso, now)}`}</p>;
}
