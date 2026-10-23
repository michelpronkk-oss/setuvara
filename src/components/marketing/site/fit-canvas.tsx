"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/** A fixed 1200×800 composition scaled to fill its box exactly (the box keeps a 3:2 ratio). */
export function FitCanvas({ children, className = "" }: { children: ReactNode; className?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState<number | null>(null);
  useEffect(() => {
    const element = box.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setScale(entry.contentRect.width / 1200));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return (
    <div className={`relative aspect-[3/2] overflow-hidden ${className}`} ref={box}>
      <div aria-hidden="true" className="absolute left-0 top-0 origin-top-left" inert style={{ width: 1200, height: 800, transform: `scale(${scale ?? 0})`, visibility: scale ? "visible" : "hidden" }}>{children}</div>
    </div>
  );
}
