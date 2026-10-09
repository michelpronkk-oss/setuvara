import type { SimpleIcon } from "simple-icons";

export function ProviderMark({ icon, label, className = "" }: { icon?: SimpleIcon; label: string; className?: string }) {
  if (!icon) {
    const fallback = label.trim().slice(0, 1).toUpperCase() || "↗";
    return <span aria-hidden="true" className={`grid size-9 shrink-0 place-items-center rounded-xl bg-black/[0.055] text-xs font-bold text-black/60 ${className}`}>{fallback}</span>;
  }
  return <span aria-hidden="true" className={`grid size-9 shrink-0 place-items-center rounded-xl bg-black/[0.055] text-black/75 ${className}`}>
    <svg className="size-[18px]" viewBox="0 0 24 24" fill="currentColor" focusable="false"><path d={icon.path} /></svg>
  </span>;
}
