"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { SimpleIcon } from "simple-icons";

/** Hostname whose favicon we can show for a link, or null for non-web links. */
export function faviconHost(url?: string | null) {
  if (!url || !/^https?:\/\//i.test(url)) return null;
  try { return new URL(url).hostname || null; } catch { return null; }
}

const glyphs = {
  mail: "M3 6.5A1.5 1.5 0 0 1 4.5 5h15A1.5 1.5 0 0 1 21 6.5v11a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5v-11Zm2.1.5L12 12.2 18.9 7H5.1ZM19 8.9l-6.4 4.8a1 1 0 0 1-1.2 0L5 8.9V17h14V8.9Z",
  phone: "M7.4 3.2a1.5 1.5 0 0 1 1.7.6l1.9 3a1.5 1.5 0 0 1-.3 1.9l-1.4 1.2a11 11 0 0 0 4.8 4.8l1.2-1.4a1.5 1.5 0 0 1 1.9-.3l3 1.9a1.5 1.5 0 0 1 .6 1.7l-.6 1.9A2.6 2.6 0 0 1 17.8 20C10.2 19.6 4.4 13.8 4 6.2a2.6 2.6 0 0 1 1.5-2.4l1.9-.6Z",
  link: "M10.6 13.4a1 1 0 0 1 0-1.4l3.5-3.5a1 1 0 1 1 1.4 1.4L12 13.4a1 1 0 0 1-1.4 0ZM8.5 11l-1.8 1.8a3 3 0 0 0 4.3 4.3l1.8-1.8a1 1 0 1 1 1.4 1.4l-1.8 1.8a5 5 0 1 1-7.1-7.1l1.8-1.8A1 1 0 1 1 8.5 11Zm7-1.4 1.8-1.8a3 3 0 0 0-4.3-4.3L11.2 5.3a1 1 0 1 1-1.4-1.4l1.8-1.8a5 5 0 1 1 7.1 7.1l-1.8 1.8a1 1 0 1 1-1.4-1.4Z",
  chat: "M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v9a1.5 1.5 0 0 1-1.5 1.5H10l-4.4 3.5A1 1 0 0 1 4 18.7V5.5Z",
};

function glyphFor(url?: string | null) {
  if (!url) return null;
  if (/^mailto:/i.test(url)) return glyphs.mail;
  if (/^tel:/i.test(url)) return glyphs.phone;
  if (/^sms:/i.test(url)) return glyphs.chat;
  return null;
}

/** A site's own icon, falling back to `fallback` when it has none. */
export function Favicon({ host, className = "", fallback = null }: { host: string; className?: string; fallback?: ReactNode }) {
  const [failed, setFailed] = useState<string | null>(null);
  const ref = useRef<HTMLImageElement>(null);
  // A server-rendered <img> can fail before React attaches onError.
  useEffect(() => {
    const image = ref.current;
    if (image?.complete && image.naturalWidth === 0) setFailed(host);
  }, [host]);
  if (failed === host) return <>{fallback}</>;
  // eslint-disable-next-line @next/next/no-img-element -- tiny cached icon from our own route; next/image adds nothing here
  return <img alt="" className={`object-contain ${className}`} decoding="async" draggable={false} height={20} loading="lazy" onError={() => setFailed(host)} ref={ref} src={`/api/favicon?host=${encodeURIComponent(host)}`} width={20} />;
}

export function ProviderMark({ icon, label, url, className = "" }: { icon?: SimpleIcon; label: string; url?: string | null; className?: string }) {
  const box = `grid size-9 shrink-0 place-items-center overflow-hidden rounded-xl bg-black/[0.055] ${className}`;
  if (icon) {
    return <span aria-hidden="true" className={`${box} text-black/75`}>
      <svg className="size-[18px]" viewBox="0 0 24 24" fill="currentColor" focusable="false"><path d={icon.path} /></svg>
    </span>;
  }
  const glyph = glyphFor(url);
  if (glyph) {
    return <span aria-hidden="true" className={`${box} text-black/75`}>
      <svg className="size-[18px]" viewBox="0 0 24 24" fill="currentColor" focusable="false"><path d={glyph} /></svg>
    </span>;
  }
  const letter = <span className="text-xs font-bold text-black/60">{label.trim().slice(0, 1).toUpperCase() || "↗"}</span>;
  const host = faviconHost(url);
  const linkGlyph = <svg className="size-[18px] text-black/60" viewBox="0 0 24 24" fill="currentColor" focusable="false"><path d={glyphs.link} /></svg>;
  return <span aria-hidden="true" className={box}>{host ? <Favicon className="size-5 rounded-[5px]" fallback={linkGlyph} host={host} key={host} /> : letter}</span>;
}

/** Small inline mark for link chips on the public profile. */
export function LinkGlyph({ icon, url }: { icon?: SimpleIcon; url: string }) {
  const path = icon?.path ?? glyphFor(url);
  if (path) return <svg aria-hidden="true" className="size-3.5 shrink-0" fill="currentColor" focusable="false" viewBox="0 0 24 24"><path d={path} /></svg>;
  const host = faviconHost(url);
  const fallback = <svg aria-hidden="true" className="size-3.5 shrink-0" fill="currentColor" focusable="false" viewBox="0 0 24 24"><path d={glyphs.link} /></svg>;
  return host ? <Favicon className="size-3.5 shrink-0 rounded-[3px]" fallback={fallback} host={host} key={host} /> : fallback;
}
