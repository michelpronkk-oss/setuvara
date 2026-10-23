"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

import { sectionForPath } from "@/lib/analytics/site-pages";

// The first tracked page of a visit carries the referrer; later pages are in-site navigation.
let firstView = true;

/** Counts a view of a public site page (no cookie, no visitor ID). Profiles count themselves server-side. */
export function SitePageView() {
  const pathname = usePathname();
  useEffect(() => {
    if (!pathname || !sectionForPath(pathname)) return;
    // The admin host serves its own "/" from the same app; it is never site traffic.
    if (document.querySelector("[data-setuvara-admin]")) return;
    const referrer = firstView ? document.referrer : window.location.origin;
    const utm = firstView ? new URLSearchParams(window.location.search).get("utm_source") : null;
    firstView = false;
    fetch("/api/site/view", {
      method: "POST",
      keepalive: true,
      headers: { "Content-Type": "application/json", "x-setuvara-request": "same-origin" },
      body: JSON.stringify({ path: pathname, referrer, utm }),
    }).catch(() => {});
  }, [pathname]);
  return null;
}
