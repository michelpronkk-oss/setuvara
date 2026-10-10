"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { memoryProvenance, type EncounterModel, type Suggestion } from "@/lib/connections/relationship";
import { formatDate, formatTime, localParts } from "./time";

export type MemoryDraft = {
  event: string;
  city: string;
  venue: string;
  /** null = same as the canonical encounter moment. */
  metOn: string | null;
  metTime: string | null;
};

export type SavedMemory = NonNullable<EncounterModel["memory"]>;

type Props = {
  encounter: EncounterModel;
  personFirstName: string;
  timeZone: string;
  onClose: () => void;
  onSave: (draft: MemoryDraft, provenance: SavedMemory["provenance"]) => Promise<string | null>;
  onRemove: () => Promise<string | null>;
};

/**
 * Private Where & when editor for one encounter. Everything Setuvara already knows is
 * preselected; everything it might know is one tap away; typing is the last resort.
 * Saving never changes the encounter's canonical timestamp, only the viewer's memory.
 */
export function MemorySheet({ encounter, personFirstName, timeZone, onClose, onSave, onRemove }: Props) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const canonical = useMemo(() => localParts(encounter.at, timeZone), [encounter.at, timeZone]);
  const memory = encounter.memory;
  const [event, setEvent] = useState(memory ? memory.event ?? "" : encounter.prefill.event ?? "");
  const [city, setCity] = useState(memory ? memory.city ?? "" : encounter.prefill.city ?? "");
  const [venue, setVenue] = useState(memory?.venue ?? "");
  const [date, setDate] = useState(memory?.metOn ?? canonical.date);
  const [time, setTime] = useState(memory?.metOn ? memory.metTime ?? "" : canonical.time);
  const [busy, setBusy] = useState<"save" | "remove" | null>(null);
  const [error, setError] = useState("");

  const today = localParts(new Date().toISOString(), timeZone).date;
  const dateChanged = date !== canonical.date || (time !== "" && time !== canonical.time);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const onKeyDown = (keyEvent: KeyboardEvent) => {
      if (keyEvent.key === "Escape" && !busy) onClose();
      if (keyEvent.key !== "Tab") return;
      const controls = [...(dialogRef.current?.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled), a[href]") ?? [])];
      if (!controls.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (keyEvent.shiftKey && document.activeElement === first) { keyEvent.preventDefault(); last.focus(); }
      else if (!keyEvent.shiftKey && document.activeElement === last) { keyEvent.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", onKeyDown);
    dialogRef.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, [busy, onClose]);

  async function save() {
    if (!date || date > today) { setError("Pick a date that has already happened."); return; }
    setBusy("save"); setError("");
    const values = { event: event.trim() || null, city: city.trim() || null };
    const message = await onSave({
      event: event.trim(),
      city: city.trim(),
      venue: venue.trim(),
      metOn: dateChanged ? date : null,
      metTime: dateChanged && time ? time : null,
    }, memoryProvenance(encounter.known, values));
    setBusy(null);
    if (message) setError(message); else onClose();
  }

  async function remove() {
    setBusy("remove"); setError("");
    const message = await onRemove();
    setBusy(null);
    if (message) setError(message); else onClose();
  }

  return (
    <div className="fixed inset-0 z-[90] grid place-items-end bg-[#0d0d0d]/50 sm:place-items-center sm:p-6" onMouseDown={(mouse) => { if (mouse.target === mouse.currentTarget && !busy) onClose(); }}>
      <div aria-labelledby={titleId} aria-modal="true" className="flex max-h-[92dvh] w-full flex-col rounded-t-[28px] bg-[#f5f4ef] text-[#0d0d0d] shadow-2xl sm:max-w-[560px] sm:rounded-[28px]" ref={dialogRef} role="dialog">
        <div className="flex items-start justify-between gap-4 px-5 pb-3 pt-5 sm:px-7 sm:pt-7">
          <div className="min-w-0">
            <p className="font-label text-[11px] uppercase tracking-[0.14em] text-black/55">{encounter.kindLabel} · {formatDate(encounter.at, timeZone)}</p>
            <h2 className="mt-1.5 font-display text-[28px] font-bold leading-[1.05] tracking-[-0.04em]" id={titleId}>Where &amp; when</h2>
            <p className="mt-1.5 flex items-center gap-1.5 text-[13px] text-black/60"><LockIcon />Only you. {personFirstName} won’t see this.</p>
          </div>
          <button aria-label="Close" className="grid size-11 shrink-0 place-items-center rounded-full bg-black/[0.06] text-xl hover:bg-black/10 focus-visible:outline-2" disabled={busy !== null} onClick={onClose} type="button">×</button>
        </div>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 pb-4 pt-2 sm:px-7">
          {encounter.known && <p className="rounded-2xl bg-white px-4 py-3 text-[13px] leading-5 text-black/70">Setuvara already knows <strong className="font-semibold text-[#0d0d0d]">{[encounter.known.event, encounter.known.city].filter(Boolean).join(" · ")}</strong> from {encounter.known.from}.{memory ? " Your memory below is what you saved." : " It’s filled in for you."}</p>}
          <SmartField autoFocus label="Event" maxLength={100} onChange={setEvent} placeholder="Conference, dinner, wedding…" suggestions={encounter.suggestions.event} value={event} />
          <SmartField label="City" maxLength={80} onChange={setCity} placeholder="Search or type a city" suggestions={encounter.suggestions.city} value={city} />
          <SmartField label="Venue" maxLength={120} onChange={setVenue} placeholder="Café, office, hotel…" suggestions={rankVenues(encounter.suggestions.venue, city)} value={venue} />

          <fieldset>
            <legend className="text-sm font-semibold">When</legend>
            <div className="mt-2.5 grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-2.5">
              <label className="block">
                <span className="sr-only">Date</span>
                <input className="min-h-[52px] w-full min-w-0 rounded-2xl border border-black/10 bg-white px-4 text-base outline-none focus:border-[#0d0d0d]" max={today} onChange={(change) => setDate(change.target.value)} required type="date" value={date} />
              </label>
              <label className="block">
                <span className="sr-only">Time (optional)</span>
                <input className="min-h-[52px] w-full min-w-0 rounded-2xl border border-black/10 bg-white px-4 text-base outline-none focus:border-[#0d0d0d]" onChange={(change) => setTime(change.target.value)} step={60} type="time" value={time} />
              </label>
            </div>
            <p className="mt-2 text-[13px] leading-5 text-black/60">
              {dateChanged
                ? <>Your memory only. The Connection stays recorded at {formatDate(encounter.at, timeZone)}, {formatTime(encounter.at, timeZone)}. <button className="min-h-8 font-semibold text-[#0d0d0d] underline underline-offset-4" onClick={() => { setDate(canonical.date); setTime(canonical.time); }} type="button">Use connection time</button></>
                : <>Filled in from when you connected. Change it if you met at another moment.</>}
            </p>
          </fieldset>
          {error && <p aria-live="assertive" className="rounded-2xl bg-[#ff5a4f]/15 px-4 py-3 text-sm text-[#7a201a]">{error}</p>}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-black/10 px-5 pb-[calc(16px+env(safe-area-inset-bottom))] pt-4 sm:px-7 sm:pb-6">
          {memory
            ? <button className="min-h-11 rounded-full px-2 text-sm font-semibold text-black/60 underline-offset-4 hover:text-[#a43d36] hover:underline disabled:opacity-50" disabled={busy !== null} onClick={() => void remove()} type="button">{busy === "remove" ? "Removing…" : "Remove memory"}</button>
            : <span />}
          <div className="flex gap-2">
            <button className="min-h-12 rounded-full px-5 text-sm font-semibold hover:bg-black/[0.06] disabled:opacity-50" disabled={busy !== null} onClick={onClose} type="button">Cancel</button>
            <button className="min-h-12 rounded-full bg-[#0d0d0d] px-6 text-sm font-semibold text-[#f5f4ef] disabled:opacity-60" disabled={busy !== null} onClick={() => void save()} type="button">{busy === "save" ? "Saving…" : "Save memory"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function rankVenues(venues: Suggestion[], city: string) {
  const wanted = city.trim().toLowerCase();
  if (!wanted) return venues;
  return [...venues].sort((a, b) => Number((b.city ?? "").toLowerCase() === wanted) - Number((a.city ?? "").toLowerCase() === wanted));
}

/**
 * One memory field: known/likely values as tappable choices, plus a type-ahead input
 * for anything Setuvara could not know. Choosing a suggestion fills the input.
 */
function SmartField({ label, value, onChange, suggestions, placeholder, maxLength, autoFocus = false }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  suggestions: Suggestion[];
  placeholder: string;
  maxLength: number;
  autoFocus?: boolean;
}) {
  const inputId = useId();
  const listId = useId();
  const [typing, setTyping] = useState(false);
  const query = value.trim().toLowerCase();
  const exact = suggestions.find((item) => item.value.toLowerCase() === query);
  const visible = typing && query
    ? suggestions.filter((item) => item.value.toLowerCase().includes(query) && item.value.toLowerCase() !== query).slice(0, 5)
    : suggestions.slice(0, 4);

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label className="text-sm font-semibold" htmlFor={inputId}>{label}</label>
        {value && <button className="min-h-8 text-[13px] font-medium text-black/55 underline-offset-4 hover:underline" onClick={() => { onChange(""); setTyping(false); }} type="button">Clear</button>}
      </div>
      {visible.length > 0 && (
        <div aria-label={`${label} suggestions`} className="mt-2.5 flex flex-wrap gap-2" id={listId} role="group">
          {visible.map((item) => {
            const selected = item.value.toLowerCase() === query;
            return (
              <button aria-pressed={selected} className={`flex min-h-11 max-w-full flex-col items-start justify-center rounded-2xl px-3.5 py-1.5 text-left transition-colors focus-visible:outline-2 ${selected ? "bg-[#0d0d0d] text-[#f5f4ef]" : "bg-white hover:bg-black/[0.04] shadow-[inset_0_0_0_1px_rgba(13,13,13,.1)]"}`} key={item.value} onClick={() => { onChange(item.value); setTyping(false); }} type="button">
                <span className="max-w-full truncate text-[15px] font-semibold leading-5">{item.value}</span>
                <span className={`max-w-full truncate text-[11px] leading-4 ${selected ? "text-[#f5f4ef]/70" : "text-black/50"}`}>{item.reason}</span>
              </button>
            );
          })}
        </div>
      )}
      <input
        aria-controls={visible.length ? listId : undefined}
        autoComplete="off"
        className="mt-2.5 min-h-[52px] w-full rounded-2xl border border-black/10 bg-white px-4 text-base outline-none placeholder:text-black/35 focus:border-[#0d0d0d]"
        data-autofocus={autoFocus ? "" : undefined}
        id={inputId}
        maxLength={maxLength}
        onChange={(change) => { onChange(change.target.value); setTyping(true); }}
        placeholder={placeholder}
        value={value}
      />
      {typing && query && !exact && <p className="mt-1.5 text-[12px] text-black/50">Saved as you typed it.</p>}
    </div>
  );
}

export function LockIcon({ className = "size-3.5" }: { className?: string }) {
  return <svg aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 16 16"><rect height="7" rx="1.5" width="10" x="3" y="7" /><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" /></svg>;
}
