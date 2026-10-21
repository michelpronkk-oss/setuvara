"use client";

import { useEffect, useRef } from "react";

/** Tells Setuvara once per page view that these Actions were seen (cards) or opened (their page). */
export function ActionBeacon({ ids, kind }: { ids: string[]; kind: "view" | "open" }) {
  const sent = useRef(false);
  const key = ids.join(",");
  useEffect(() => {
    if (sent.current || !key) return;
    sent.current = true;
    void fetch("/api/actions/events", { method: "POST", keepalive: true, headers: { "Content-Type": "application/json", "x-setuvara-request": "same-origin" }, body: JSON.stringify({ kind, ids: key.split(",") }) }).catch(() => undefined);
  }, [key, kind]);
  return null;
}

/** Counts a view only when the cards actually reach the screen. */
export function ActionViewBeacon({ ids, children, className, ...rest }: { ids: string[]; children: React.ReactNode; className?: string } & Record<`data-${string}`, string | boolean>) {
  const box = useRef<HTMLDivElement>(null);
  const sent = useRef(false);
  const key = ids.join(",");
  useEffect(() => {
    const node = box.current;
    if (!node || !key || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver((entries) => {
      if (sent.current || !entries.some((entry) => entry.isIntersecting)) return;
      sent.current = true;
      observer.disconnect();
      void fetch("/api/actions/events", { method: "POST", keepalive: true, headers: { "Content-Type": "application/json", "x-setuvara-request": "same-origin" }, body: JSON.stringify({ kind: "view", ids: key.split(",") }) }).catch(() => undefined);
    }, { threshold: 0.25 });
    observer.observe(node);
    return () => observer.disconnect();
  }, [key]);
  return <div className={className} ref={box} {...rest}>{children}</div>;
}
