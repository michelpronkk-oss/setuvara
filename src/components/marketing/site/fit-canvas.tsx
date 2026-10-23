"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/** A fixed composition (1200×800 unless sized) scaled to fill its box exactly, keeping its ratio. */
export function FitCanvas({ children, className = "", width = 1200, height = 800 }: { children: ReactNode; className?: string; width?: number; height?: number }) {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState<number | null>(null);
  useEffect(() => {
    const element = box.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setScale(entry.contentRect.width / width));
    observer.observe(element);
    return () => observer.disconnect();
  }, [width]);
  return (
    <div className={`relative overflow-hidden ${className}`} ref={box} style={{ aspectRatio: `${width} / ${height}` }}>
      <div aria-hidden="true" className="absolute left-0 top-0 origin-top-left" inert style={{ width, height, transform: `scale(${scale ?? 0})`, visibility: scale ? "visible" : "hidden" }}>{children}</div>
    </div>
  );
}
