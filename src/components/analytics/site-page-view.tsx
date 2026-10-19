"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

import { sitePageForPath } from "@/lib/analytics/site-pages";

/** Counts a view of a public site page (no cookie, no visitor ID). Profiles count themselves server-side. */
export function SitePageView() {
  const pathname = usePathname();
  useEffect(() => {
    if (!pathname || !sitePageForPath(pathname)) return;
    // The admin host serves its own "/" from the same app; it is never site traffic.
    if (document.querySelector("[data-setuvara-admin]")) return;
    fetch("/api/site/view", {
      method: "POST",
      keepalive: true,
      headers: { "Content-Type": "application/json", "x-setuvara-request": "same-origin" },
      body: JSON.stringify({ path: pathname }),
    }).catch(() => {});
  }, [pathname]);
  return null;
}
