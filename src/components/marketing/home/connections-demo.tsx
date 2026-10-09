"use client";

import { useMemo, useState } from "react";

import type { DemoConnection } from "./demo";

const prompts = [
  { label: "Who did I meet in Amsterdam?", query: "amsterdam" },
  { label: "Everyone from Slush", query: "slush" },
  { label: "Lisbon", query: "lisbon" },
];

const filters = ["All", "Personal", "Event", "Business"] as const;

/** A working, client-side miniature of the Connections search: same fields, same filters. */
export function ConnectionsDemo({ items }: { items: DemoConnection[] }) {
  const [query, setQuery] = useState("amsterdam");
  const [filter, setFilter] = useState<(typeof filters)[number]>("All");
  const results = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return items.filter((item) => {
      const text = [item.name, item.role, item.event, item.city, item.mode].join(" ").toLowerCase();
      return (!normalized || text.includes(normalized)) && (filter === "All" || item.mode === filter);
    });
  }, [filter, items, query]);

  return (
    <div className="flex flex-col gap-4 rounded-[2rem] bg-ink p-4 text-paper sm:p-6">
      <div className="flex items-center gap-3 rounded-full bg-white/10 px-5 focus-within:outline-2 focus-within:outline-coral">
        <svg aria-hidden="true" className="size-4 shrink-0 text-paper/50" fill="none" viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="2" /><path d="m16 16 4 4" stroke="currentColor" strokeLinecap="round" strokeWidth="2" /></svg>
        <label className="sr-only" htmlFor="demo-connection-search">Search the example connections</label>
        <input autoComplete="off" className="min-h-[52px] min-w-0 flex-1 bg-transparent text-[16px] text-paper outline-none placeholder:text-paper/40" id="demo-connection-search" onChange={(event) => setQuery(event.target.value)} placeholder="Search people, events, cities…" type="search" value={query} />
      </div>

      <div className="flex flex-wrap gap-2">
        {prompts.map((prompt) => (
          <button aria-pressed={query === prompt.query} className={`min-h-9 rounded-full px-3.5 text-[12px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-coral ${query === prompt.query ? "bg-coral text-ink" : "bg-white/10 text-paper/80 hover:bg-white/15"}`} key={prompt.query} onClick={() => setQuery(prompt.query)} type="button">
            {prompt.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3 border-t border-white/10 pt-4">
      <div aria-label="Filter example connections by Mode" className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto [scrollbar-width:none]" role="group">
        {filters.map((item) => (
          <button aria-pressed={filter === item} className={`min-h-9 shrink-0 rounded-full px-3.5 text-[12px] font-semibold focus-visible:outline-2 focus-visible:outline-coral ${filter === item ? "bg-paper text-ink" : "border border-white/15 text-paper/70"}`} key={item} onClick={() => setFilter(item)} type="button">
            {item}
          </button>
        ))}
      </div>
        <p aria-live="polite" className="shrink-0 font-label text-[11px] uppercase tracking-[0.12em] text-paper/50">{results.length}<span className="hidden sm:inline"> {results.length === 1 ? "person" : "people"}</span></p>
      </div>

      <ul className="flex min-h-[248px] flex-col divide-y divide-white/10 rounded-[1.4rem] bg-white/[0.04] px-4 sm:px-5">
        {results.map((item) => (
          <li className="flex items-center gap-3.5 py-4" key={item.id}>
            <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-full bg-paper font-display text-[17px] font-bold text-ink">{item.name.slice(0, 1)}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-semibold">{item.name}</span>
              <span className="mt-0.5 block truncate text-[12px] text-paper/55">{item.role}</span>
              <span className="mt-0.5 block truncate text-[12px] text-paper/80">{item.event} · {item.city}</span>
            </span>
            <span className="hidden shrink-0 text-right sm:block">
              <span className="block font-label text-[10px] uppercase tracking-[0.14em] text-coral">{item.mode}</span>
              <span className="mt-1 block text-[12px] text-paper/55">{item.lastMet}</span>
              {item.encounters > 1 && <span className="mt-0.5 block text-[11px] text-paper/45">Met {item.encounters}×</span>}
            </span>
          </li>
        ))}
        {results.length === 0 && (
          <li className="py-12 text-center">
            <p className="font-semibold">No one here yet.</p>
            <p className="mt-1 text-[13px] text-paper/55">Try a name, event, company or city.</p>
          </li>
        )}
      </ul>
    </div>
  );
}
