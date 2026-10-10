"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { ModeSlug } from "@/components/profile/types";
import type { PhotoFocus } from "@/components/profile/photo-focus";
import { ConnectionAvatar } from "@/components/connections/connection-avatar";

export type ConnectionListItem = {
  id: string;
  displayName: string;
  username: string | null;
  role: string | null;
  company: string | null;
  mode: ModeSlug;
  event: string | null;
  city: string | null;
  venue: string | null;
  lastMet: string;
  isGuest: boolean;
  imageUrl: string | null;
  imageFocus?: PhotoFocus | null;
  searchText?: string;
};

const filters: { label: string; value: ModeSlug | "all" | "recent" }[] = [
  { label: "All", value: "all" },
  { label: "Personal", value: "personal" },
  { label: "Event", value: "event" },
  { label: "Business", value: "business" },
  { label: "Recent", value: "recent" },
];

export function ConnectionsList({ items }: { items: ConnectionListItem[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<(typeof filters)[number]["value"]>("all");
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return items.filter((item) => {
      const text = [item.displayName, item.username, item.role, item.company, item.event, item.city, item.venue, item.searchText].filter(Boolean).join(" ").toLowerCase();
      return (!normalized || text.includes(normalized))
        && (filter === "all" || filter === "recent" || item.mode === filter);
    }).slice(0, filter === "recent" ? 20 : undefined);
  }, [filter, items, query]);

  return (
    <>
      <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <label className="sr-only" htmlFor="connection-search">Search connections</label>
        <input autoComplete="off" className="min-h-12 w-full rounded-full border border-black/15 bg-white px-5 text-base outline-none focus:border-[#0d0d0d] sm:max-w-sm" id="connection-search" onChange={(event) => setQuery(event.target.value)} placeholder="Search people, events, cities…" type="search" value={query} />
        <p aria-live="polite" className="text-xs text-black/50">{filtered.length} {filtered.length === 1 ? "connection" : "connections"}</p>
      </div>
      <div aria-label="Filter connections" className="mt-4 flex gap-2 overflow-x-auto pb-2" role="group">
        {filters.map((item) => <button aria-pressed={filter === item.value} className={`min-h-11 shrink-0 rounded-full px-4 text-xs font-semibold ${filter === item.value ? "bg-[#0d0d0d] text-white" : "border border-black/10 bg-white/60"}`} key={item.value} onClick={() => setFilter(item.value)} type="button">{item.label}</button>)}
      </div>
      <div className="mt-4 divide-y divide-black/10 rounded-[1.7rem] border border-black/10 bg-white px-5 sm:px-7">
        {filtered.map((item) => <Link className="group flex min-h-24 items-center gap-4 py-5 focus-visible:outline-2" href={`/app/connections/${item.id}`} key={item.id}>
          <ConnectionAvatar className="size-12 bg-[#f5f4ef] text-lg font-semibold" imageFocus={item.imageFocus} imageUrl={item.imageUrl} name={item.displayName} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-semibold tracking-tight">{item.displayName}</p>
            {(item.role || item.company) && <p className="mt-0.5 truncate text-xs text-black/55">{[item.role, item.company].filter(Boolean).join(" · ")}</p>}
            <p className="mt-1 truncate text-xs text-black/55">{[item.event, item.city, item.venue].filter(Boolean).join(" · ") || "A connection worth keeping"}</p>
          </div>
          <div className="hidden shrink-0 text-right sm:block"><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-black/45">{item.mode}</p><p className="mt-1 text-xs text-black/45">{item.lastMet}</p></div>
          <span aria-hidden="true" className="text-lg text-black/30 transition group-hover:translate-x-1">→</span>
        </Link>)}
        {filtered.length === 0 && <div className="py-12 text-center"><p className="font-semibold">{items.length ? "No connections found" : "Your people will be here."}</p><p className="mt-2 text-sm text-black/55">{items.length ? "Try another name, event, company, or city." : "When you connect in person, Setuvara helps you remember."}</p></div>}
      </div>
    </>
  );
}
