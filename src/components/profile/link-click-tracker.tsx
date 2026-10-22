"use client";

import { useEffect } from "react";

/** Counts taps on the page's links (anything marked data-link-id). Never delays the tap itself. */
export function LinkClickTracker() {
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const link = (event.target as Element | null)?.closest?.("a[data-link-id]");
      const linkId = link?.getAttribute("data-link-id");
      if (!linkId) return;
      void fetch("/api/analytics/link", { method: "POST", keepalive: true, headers: { "Content-Type": "application/json", "x-setuvara-request": "same-origin" }, body: JSON.stringify({ linkId }) }).catch(() => undefined);
    };
    // Middle-click and "open in new tab" count too.
    document.addEventListener("click", onClick, true);
    document.addEventListener("auxclick", onClick, true);
    return () => { document.removeEventListener("click", onClick, true); document.removeEventListener("auxclick", onClick, true); };
  }, []);
  return null;
}
