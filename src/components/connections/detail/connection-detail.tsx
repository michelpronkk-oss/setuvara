"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { MeetMark } from "@/components/marketing/brand";
import type { ModeSlug } from "@/components/profile/types";
import type { EncounterModel, PersonModel, RelationshipModel } from "@/lib/connections/relationship";
import { createClient } from "@/lib/supabase/client";
import { LockIcon, MemorySheet, type MemoryDraft, type SavedMemory } from "./memory-sheet";
import { formatCalendarDate, formatDate, formatTime, relativeDay, useTimeZone } from "./time";

const MODE_COLOR: Record<ModeSlug, string> = { personal: "#FF5A4F", event: "#C7FF4A", business: "#AFCBFF" };
const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);
const cutCorner = (size: number) => `polygon(0 0,100% 0,100% calc(100% - ${size}px),calc(100% - ${Math.round(size * 0.58)}px) 100%,0 100%)`;

type Props = { model: RelationshipModel; photoUrl: string | null; viewerId: string };

export function ConnectionDetail({ model, photoUrl, viewerId }: Props) {
  const router = useRouter();
  const timeZone = useTimeZone();
  const [memories, setMemories] = useState(() => new Map(model.encounters.map((item) => [item.id, item.memory])));
  const [note, setNote] = useState(model.note);
  const [editing, setEditing] = useState<string | null>(null);
  const { person } = model;

  // Server data wins whenever a refresh delivers a new model.
  const [synced, setSynced] = useState(model);
  if (synced !== model) {
    setSynced(model);
    setMemories(new Map(model.encounters.map((item) => [item.id, item.memory])));
    setNote(model.note);
  }

  const encounters = model.encounters.map((item) => ({ ...item, memory: memories.has(item.id) ? memories.get(item.id) ?? null : item.memory }));
  // The Where card shows the latest moment Setuvara or the viewer can place; otherwise the first.
  const placed = [...encounters].reverse().find((item) => item.known || item.memory);
  const whereEncounter = placed ?? encounters[0];
  const editingEncounter = encounters.find((item) => item.id === editing) ?? null;

  const saveMemory = useCallback(async (encounterId: string, draft: MemoryDraft, provenance: SavedMemory["provenance"]) => {
    const empty = !draft.event && !draft.city && !draft.venue && !draft.metOn;
    const supabase = createClient();
    const { error } = empty
      ? await supabase.from("encounter_context").delete().eq("encounter_id", encounterId).eq("user_id", viewerId)
      : await supabase.from("encounter_context").upsert({
        encounter_id: encounterId,
        user_id: viewerId,
        event_label: draft.event || null,
        city: draft.city || null,
        venue: draft.venue || null,
        met_on: draft.metOn,
        met_time: draft.metTime,
        provenance,
      }, { onConflict: "encounter_id,user_id" });
    if (error) return "Your memory couldn’t be saved. Try again.";
    setMemories((current) => new Map(current).set(encounterId, empty ? null : {
      event: draft.event || null, city: draft.city || null, venue: draft.venue || null,
      metOn: draft.metOn, metTime: draft.metTime, provenance, updatedAt: new Date().toISOString(),
    }));
    router.refresh();
    return null;
  }, [router, viewerId]);

  const removeMemory = useCallback(async (encounterId: string) => {
    const { error } = await createClient().from("encounter_context").delete().eq("encounter_id", encounterId).eq("user_id", viewerId);
    if (error) return "Your memory couldn’t be removed. Try again.";
    setMemories((current) => new Map(current).set(encounterId, null));
    router.refresh();
    return null;
  }, [router, viewerId]);

  const saveNote = useCallback(async (text: string) => {
    const supabase = createClient();
    const trimmed = text.trim();
    const { error } = trimmed
      ? await supabase.from("connection_notes").upsert({ connection_id: model.id, user_id: viewerId, note: text }, { onConflict: "connection_id,user_id" })
      : await supabase.from("connection_notes").delete().eq("connection_id", model.id).eq("user_id", viewerId);
    if (error) return "Your note couldn’t be saved. Try again.";
    setNote(trimmed ? { text, updatedAt: new Date().toISOString() } : null);
    router.refresh();
    return null;
  }, [model.id, router, viewerId]);

  return (
    <main className="min-h-dvh bg-[#f5f4ef] text-[#0d0d0d]">
      <div className="mx-auto w-full max-w-[1200px] px-4 pb-16 pt-3 md:px-8 lg:pt-6">
        <Link className="inline-flex min-h-11 items-center gap-2 rounded-full pr-3 text-sm font-semibold text-black/65 hover:text-[#0d0d0d] focus-visible:outline-2" href="/app/connections"><span aria-hidden="true">←</span>People</Link>

        <div className="mt-2 grid grid-cols-1 gap-7 lg:mt-4 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)] lg:gap-14 xl:gap-20">
          <PersonPanel person={person} photoUrl={photoUrl} />

          <div className="min-w-0 space-y-7 lg:space-y-9 lg:pt-1">
            <OriginCard model={model} timeZone={timeZone} />

            <section aria-labelledby="memory-heading">
              <SectionHeading id="memory-heading" kicker="Private to you">Your memory</SectionHeading>
              <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
                <WhereCard encounter={whereEncounter} onEdit={() => setEditing(whereEncounter.id)} person={person} timeZone={timeZone} />
                <NoteCard firstName={person.firstName} note={note} onSave={saveNote} />
              </div>
            </section>

            <section aria-labelledby="history-heading">
              <SectionHeading id="history-heading" kicker={encounters.length === 1 ? "One moment so far" : `${encounters.length} moments`}>Your story</SectionHeading>
              <ol className="mt-5">
                {encounters.map((item, position) => (
                  <TimelineEntry encounter={item} isLast={position === encounters.length - 1} key={item.id} onEdit={() => setEditing(item.id)} person={person} timeZone={timeZone} />
                ))}
              </ol>
              {encounters.length === 1 && <p className="mt-1 pl-9 text-[13px] leading-5 text-black/55">Connect again next time you meet and it becomes part of this story.</p>}
            </section>

            <p className="flex items-start gap-2 border-t border-black/10 pt-5 text-[13px] leading-5 text-black/55"><LockIcon className="mt-0.5 size-3.5 shrink-0" />Your note and memories stay private to you. {person.firstName} can’t see them, and nobody else can open this Connection.</p>
          </div>
        </div>
      </div>

      {editingEncounter && <MemorySheet
        encounter={editingEncounter}
        onClose={() => setEditing(null)}
        onRemove={() => removeMemory(editingEncounter.id)}
        onSave={(draft, provenance) => saveMemory(editingEncounter.id, draft, provenance)}
        personFirstName={person.firstName}
        timeZone={timeZone}
      />}
    </main>
  );
}

function SectionHeading({ id, kicker, children }: { id: string; kicker: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b-[1.5px] border-[#0d0d0d] pb-2.5">
      <h2 className="font-display text-[26px] font-bold tracking-[-0.035em] lg:text-[32px]" id={id}>{children}</h2>
      <p className="font-label text-[11px] uppercase tracking-[0.12em] text-black/55">{kicker}</p>
    </div>
  );
}

// ---------------------------------------------------------------- Person

function PersonPanel({ person, photoUrl }: { person: PersonModel; photoUrl: string | null }) {
  const accent = person.mode ? MODE_COLOR[person.mode] : "#F5F4EF";
  const roleLine = [person.role, person.company].filter(Boolean).join(" · ");
  return (
    <aside aria-label={`About ${person.name}`} className="min-w-0 lg:sticky lg:top-[100px] lg:self-start">
      <div className="grid grid-cols-[minmax(0,42%)_minmax(0,1fr)] items-end gap-4 sm:grid-cols-[180px_minmax(0,1fr)] sm:gap-6 lg:block">
        <Portrait accent={accent} person={person} photoUrl={photoUrl} />
        <div className="min-w-0 pb-1 lg:mt-6 lg:pb-0">
          {person.modeLabel && person.kind === "registered" && <p className="flex items-center gap-2 font-label text-[11px] uppercase tracking-[0.14em] text-black/60"><span aria-hidden="true" className="size-2 rounded-full" style={{ background: accent }} />{person.modeLabel}</p>}
          {person.kind === "guest" && <p className="font-label text-[11px] uppercase tracking-[0.14em] text-black/60">Guest connection</p>}
          <h1 className="mt-2 break-words font-display text-[clamp(28px,8.4vw,40px)] font-bold leading-[0.98] tracking-[-0.045em] [hyphens:auto] lg:text-[48px]">{person.name}</h1>
          {person.username && <p className="mt-2 truncate font-label text-[13px] text-black/60">@{person.username}</p>}
          {roleLine && <p className="mt-2.5 text-[15px] font-medium leading-snug lg:text-[17px]">{roleLine}</p>}
        </div>
      </div>

      <div className="mt-5 space-y-4 lg:mt-5">
        {(person.basedIn || person.pronouns) && (
          <ul className="flex flex-wrap gap-x-5 gap-y-2 text-[14px] text-black/70">
            {person.basedIn && <li className="flex items-center gap-1.5"><PinIcon />Based in {person.basedIn}</li>}
            {person.pronouns && <li>{person.pronouns}</li>}
          </ul>
        )}
        {person.about && <p className="line-clamp-4 max-w-prose text-[15px] leading-6 text-black/75">{person.about}</p>}
        <PersonStatus person={person} />
        {person.profileHref && (
          <a className="inline-flex min-h-12 items-center gap-2 rounded-full px-5 text-sm font-semibold shadow-[inset_0_0_0_1.5px_#0d0d0d] hover:bg-[#0d0d0d] hover:text-[#f5f4ef] focus-visible:outline-2" href={person.profileHref} rel="noreferrer" target="_blank">
            View {person.firstName}’s profile<span aria-hidden="true">↗</span>
          </a>
        )}
      </div>
    </aside>
  );
}

function PersonStatus({ person }: { person: PersonModel }) {
  const lines: string[] = [];
  if (person.kind === "guest") lines.push(`${person.firstName} connected as a guest and hasn’t claimed a Setuvara yet. When they do, their profile appears here.`);
  if (person.kind === "unavailable") lines.push("Their profile isn’t public right now. You still keep everything from when you connected.");
  if (person.claimedFromGuest) lines.push("Joined Setuvara after connecting as a guest.");
  if (person.connectedAsName) lines.push(`Connected as ${person.connectedAsName}.`);
  if (person.kind === "registered" && person.factsFrom === "snapshot" && (person.role || person.company)) lines.push("Role shown as they last shared it.");
  if (!lines.length) return null;
  return <div className="space-y-1 text-[13px] leading-5 text-black/55">{lines.map((line) => <p key={line}>{line}</p>)}</div>;
}

function Portrait({ person, photoUrl, accent }: { person: PersonModel; photoUrl: string | null; accent: string }) {
  const [failed, setFailed] = useState(false);
  const showPhoto = photoUrl && !failed;
  return (
    <div className="relative aspect-[4/5] w-full overflow-hidden bg-[#0d0d0d] lg:w-full" style={{ clipPath: cutCorner(44), borderRadius: 22 }}>
      {showPhoto ? (
        // eslint-disable-next-line @next/next/no-img-element -- signed, RLS-authorized private profile photo
        <img alt={person.name} className="absolute inset-0 size-full object-cover" decoding="async" onError={() => setFailed(true)} src={photoUrl} />
      ) : (
        <div aria-label={person.name} className="absolute inset-0 grid place-items-center" role="img" style={{ background: person.kind === "guest" ? "#E7E4DA" : accent }}>
          <MeetMark className="absolute -right-[18%] -top-[10%] size-[78%] text-[#0d0d0d] opacity-[0.08]" />
          <span className="font-display text-[clamp(44px,15vw,120px)] font-bold leading-none tracking-[-0.06em] text-[#0d0d0d]">{person.initials}</span>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- The Connection (origin)

function OriginCard({ model, timeZone }: { model: RelationshipModel; timeZone: string }) {
  const { origin, person } = model;
  const relative = relativeDay(origin.createdAt, timeZone);
  const first = model.encounters[0];
  const facts: { label: string; value: string; sub?: string }[] = [
    { label: "When", value: formatDate(origin.createdAt, timeZone), sub: [relative, formatTime(origin.createdAt, timeZone)].filter(Boolean).join(" · ") },
    { label: "How", value: origin.sourceLabel, sub: origin.sourceDetail },
    { label: "Shared first", value: origin.viewerSharedFirst ? "You" : person.firstName, sub: origin.modeLabel ?? undefined },
    { label: origin.viewerSharedFirst ? `${person.firstName} shared` : "You shared back", value: origin.viewerSharedFirst ? (first?.snapshot.asGuest ? "As a guest" : first?.counterpartModeLabel ?? "Their details") : origin.viewerSharedBackLabel ?? "Your details" },
  ];
  return (
    <section aria-labelledby="origin-heading" className="relative overflow-hidden rounded-[28px] bg-[#0d0d0d] px-5 pb-6 pt-5 text-[#f5f4ef] sm:px-8 sm:pb-8 sm:pt-7" style={{ clipPath: cutCorner(36) }}>
      <MeetMark className="pointer-events-none absolute -right-10 -top-12 size-56 text-[#f5f4ef] opacity-[0.05] sm:size-72" />
      <p className="relative font-label text-[11px] uppercase tracking-[0.16em] text-[#f5f4ef]/60">The connection</p>
      <h2 className="relative mt-2.5 max-w-[22ch] font-display text-[30px] font-bold leading-[1.02] tracking-[-0.045em] sm:text-[40px] xl:text-[46px]" id="origin-heading">{origin.headline}</h2>
      {origin.event && <p className="relative mt-2 text-[15px] text-[#f5f4ef]/75">{[origin.event, origin.eventCity].filter(Boolean).join(" · ")}<span className="text-[#f5f4ef]/50"> · from {first?.known?.from}</span></p>}
      <dl className="relative mt-6 grid grid-cols-2 gap-x-4 gap-y-5 border-t border-[#f5f4ef]/15 pt-5 sm:grid-cols-4">
        {facts.map((fact) => (
          <div className="min-w-0" key={fact.label}>
            <dt className="font-label text-[10px] uppercase tracking-[0.14em] text-[#f5f4ef]/55">{fact.label}</dt>
            <dd className="mt-1.5 break-words text-[16px] font-semibold leading-tight">{fact.value}</dd>
            {fact.sub && <dd className="mt-1 text-[12.5px] leading-[1.35] text-[#f5f4ef]/60">{fact.sub}</dd>}
          </div>
        ))}
      </dl>
    </section>
  );
}

// ---------------------------------------------------------------- Memory

function whereParts(encounter: EncounterModel) {
  const memory = encounter.memory;
  const known = encounter.known;
  return {
    place: [memory?.venue, memory?.city ?? known?.city].filter(Boolean).join(", ") || null,
    event: memory?.event ?? known?.event ?? null,
  };
}

function WhereCard({ encounter, person, timeZone, onEdit }: { encounter: EncounterModel; person: PersonModel; timeZone: string; onEdit: () => void }) {
  const { place, event } = whereParts(encounter);
  const memory = encounter.memory;
  if (!place && !event && !memory?.metOn) {
    return (
      <button className="group flex min-h-[176px] flex-col items-start justify-between rounded-[24px] bg-white p-5 text-left shadow-[inset_0_0_0_1px_rgba(13,13,13,.08)] transition hover:shadow-[inset_0_0_0_1.5px_#0d0d0d] focus-visible:outline-2 sm:p-6" onClick={onEdit} type="button">
        <span>
          <span className="font-label text-[11px] uppercase tracking-[0.14em] text-black/55">Where you met</span>
          <span className="mt-2 block text-[15px] leading-6 text-black/70">Setuvara doesn’t know where you and {person.firstName} met. Add it if you’d like to remember.</span>
        </span>
        <span className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full bg-[#0d0d0d] px-4 text-sm font-semibold text-[#f5f4ef]"><PlusIcon />Add where you met</span>
      </button>
    );
  }
  const provenance = memory ? provenanceLabel(memory.provenance) : `From ${encounter.known?.from}`;
  return (
    <div className="flex min-h-[176px] flex-col justify-between rounded-[24px] bg-white p-5 shadow-[inset_0_0_0_1px_rgba(13,13,13,.08)] sm:p-6">
      <div>
        <div className="flex items-start justify-between gap-3">
          <p className="font-label text-[11px] uppercase tracking-[0.14em] text-black/55">{encounter.index === 0 ? "Where you met" : "Where you last met"}</p>
          <EditButton label="Edit where you met" onClick={onEdit} />
        </div>
        <p className="mt-1 break-words font-display text-[26px] font-bold leading-[1.05] tracking-[-0.035em]">{place ?? event}</p>
        {place && event && <p className="mt-1.5 text-[15px] font-medium text-black/75">{event}</p>}
        <p className="mt-1.5 text-[14px] text-black/60">{memory?.metOn ? `${formatCalendarDate(memory.metOn)}${memory.metTime ? `, ${memory.metTime}` : ""}` : formatDate(encounter.at, timeZone)}</p>
      </div>
      <p className="mt-4 flex items-center gap-1.5 text-[12.5px] text-black/55">{memory && <LockIcon />}{provenance}</p>
    </div>
  );
}

function provenanceLabel(value: SavedMemory["provenance"]) {
  if (value === "confirmed") return "You confirmed this · only you";
  if (value === "corrected") return "You corrected this · only you";
  return "Your memory · only you";
}

function NoteCard({ note, firstName, onSave }: { note: RelationshipModel["note"]; firstName: string; onSave: (text: string) => Promise<string | null> }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note?.text ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const area = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!editing || !area.current) return;
    const element = area.current;
    element.focus();
    element.setSelectionRange(element.value.length, element.value.length);
  }, [editing]);
  useEffect(() => {
    if (area.current) { area.current.style.height = "auto"; area.current.style.height = `${area.current.scrollHeight}px`; }
  }, [draft, editing]);

  async function save() {
    if (draft.length > 2000) { setError("Keep a note under 2,000 characters."); return; }
    setBusy(true); setError("");
    const message = await onSave(draft);
    setBusy(false);
    if (message) setError(message); else setEditing(false);
  }

  if (editing) {
    return (
      <div className="flex flex-col rounded-[24px] bg-white p-5 shadow-[inset_0_0_0_1.5px_#0d0d0d] sm:p-6">
        <label className="font-label text-[11px] uppercase tracking-[0.14em] text-black/55" htmlFor="connection-note">Private note</label>
        <textarea className="mt-2 min-h-[96px] w-full resize-none bg-transparent text-[17px] leading-7 outline-none placeholder:text-black/35" id="connection-note" maxLength={2000} onChange={(change) => setDraft(change.target.value)} onKeyDown={(key) => { if (key.key === "Escape") { setDraft(note?.text ?? ""); setEditing(false); } if (key.key === "Enter" && (key.metaKey || key.ctrlKey)) void save(); }} placeholder={`What do you want to remember about ${firstName}?`} ref={area} rows={3} value={draft} />
        {error && <p aria-live="assertive" className="mt-2 text-sm text-[#a43d36]">{error}</p>}
        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="text-[12px] text-black/45">{draft.length > 1600 ? `${draft.length}/2000` : <span className="flex items-center gap-1.5"><LockIcon />Only you</span>}</span>
          <div className="flex gap-2">
            <button className="min-h-11 rounded-full px-4 text-sm font-semibold hover:bg-black/[0.06]" disabled={busy} onClick={() => { setDraft(note?.text ?? ""); setEditing(false); setError(""); }} type="button">Cancel</button>
            <button className="min-h-11 rounded-full bg-[#0d0d0d] px-5 text-sm font-semibold text-[#f5f4ef] disabled:opacity-60" disabled={busy} onClick={() => void save()} type="button">{busy ? "Saving…" : "Save note"}</button>
          </div>
        </div>
      </div>
    );
  }

  if (!note) {
    return (
      <button className="flex min-h-[176px] flex-col items-start justify-between rounded-[24px] bg-[#ebe8de] p-5 text-left transition hover:bg-[#e4e0d4] focus-visible:outline-2 sm:p-6" onClick={() => { setDraft(""); setEditing(true); }} type="button">
        <span>
          <span className="font-label text-[11px] uppercase tracking-[0.14em] text-black/55">Private note</span>
          <span className="mt-2 block text-[15px] leading-6 text-black/70">A detail, a promise, a follow-up. Something to remember about {firstName}.</span>
        </span>
        <span className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold shadow-[inset_0_0_0_1.5px_#0d0d0d]"><PlusIcon />Add a note</span>
      </button>
    );
  }

  return (
    <div className="flex min-h-[176px] flex-col justify-between rounded-[24px] bg-[#ebe8de] p-5 sm:p-6">
      <div>
        <div className="flex items-start justify-between gap-3">
          <p className="font-label text-[11px] uppercase tracking-[0.14em] text-black/55">Private note</p>
          <EditButton label="Edit note" onClick={() => { setDraft(note.text); setEditing(true); }} />
        </div>
        <blockquote className="relative mt-1 whitespace-pre-line break-words pl-5 text-[17px] leading-7">
          <span aria-hidden="true" className="absolute -left-0.5 -top-1 font-display text-[34px] leading-none text-[#ff5a4f]">“</span>
          {note.text}
        </blockquote>
      </div>
      <p className="mt-4 flex items-center gap-1.5 text-[12.5px] text-black/55"><LockIcon />Only you</p>
    </div>
  );
}

// ---------------------------------------------------------------- Story

function TimelineEntry({ encounter, person, timeZone, isLast, onEdit }: { encounter: EncounterModel; person: PersonModel; timeZone: string; isLast: boolean; onEdit: () => void }) {
  const { place, event } = whereParts(encounter);
  const memory = encounter.memory;
  const snapshotLine = [encounter.snapshot.role, encounter.snapshot.company].filter(Boolean).join(" · ");
  const showSnapshotName = encounter.snapshot.name.trim().toLowerCase() !== person.name.trim().toLowerCase();
  const dot = encounter.counterpartMode ? MODE_COLOR[encounter.counterpartMode] : "#f5f4ef";
  return (
    <li className="relative grid grid-cols-[24px_minmax(0,1fr)] gap-x-3 pb-7 last:pb-2">
      {!isLast && <span aria-hidden="true" className="absolute bottom-0 left-[11px] top-6 w-[1.5px] bg-black/15" />}
      <span aria-hidden="true" className="mt-1 grid size-6 place-items-center rounded-full bg-[#0d0d0d]"><span className="size-2.5 rounded-full" style={{ background: dot }} /></span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <p className="font-label text-[11px] uppercase tracking-[0.14em] text-[#c2392f]">{encounter.kindLabel}</p>
          <p className="text-[13px] text-black/55">{formatDate(encounter.at, timeZone)} · {formatTime(encounter.at, timeZone)}</p>
        </div>
        <p className="mt-1 font-display text-[21px] font-bold leading-tight tracking-[-0.03em]">{event && place ? `${event} · ${place}` : place ?? event ?? encounter.headline}</p>
        <p className="mt-1 text-[14px] leading-5 text-black/65">{[encounter.counterpartModeLabel && (encounter.viewerShared ? `${person.firstName} shared back ${encounter.counterpartModeLabel}` : `${encounter.counterpartModeLabel}`), encounter.snapshot.asGuest ? `${person.firstName} connected as a guest` : null, encounter.sourceDetail].filter(Boolean).join(" · ")}</p>
        {(snapshotLine || showSnapshotName) && <p className="mt-1 text-[13px] text-black/50">Then: {[showSnapshotName ? encounter.snapshot.name : null, snapshotLine || null].filter(Boolean).join(" · ")}</p>}
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          {encounter.known && <Tag>{capitalize(encounter.known.from)}</Tag>}
          {memory?.metOn && <Tag lock>You remember {formatCalendarDate(memory.metOn)}{memory.metTime ? `, ${memory.metTime}` : ""}</Tag>}
          {memory && <Tag lock>{provenanceLabel(memory.provenance).replace(" · only you", "")}</Tag>}
          <button className="inline-flex min-h-9 items-center gap-1.5 rounded-full px-2.5 text-[13px] font-semibold underline-offset-4 hover:underline focus-visible:outline-2" onClick={onEdit} type="button">{memory ? <><PencilIcon />Edit memory</> : <><PlusIcon />Add where &amp; when</>}</button>
        </div>
      </div>
    </li>
  );
}

function Tag({ children, lock = false }: { children: ReactNode; lock?: boolean }) {
  return <span className="inline-flex min-h-7 max-w-full items-center gap-1.5 truncate rounded-full bg-black/[0.06] px-2.5 text-[12px] text-black/70">{lock && <LockIcon className="size-3 shrink-0" />}{children}</span>;
}

function EditButton({ label, onClick }: { label: string; onClick: () => void }) {
  return <button aria-label={label} className="-mr-2 -mt-2 grid size-11 shrink-0 place-items-center rounded-full hover:bg-black/[0.06] focus-visible:outline-2" onClick={onClick} type="button"><PencilIcon /></button>;
}

function PlusIcon() {
  return <svg aria-hidden="true" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 16 16"><path d="M8 3v10M3 8h10" /></svg>;
}

function PencilIcon() {
  return <svg aria-hidden="true" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 16 16"><path d="M10.5 2.5l3 3L6 13H3v-3z" /></svg>;
}

function PinIcon() {
  return <svg aria-hidden="true" className="size-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 16 16"><path d="M8 14s4.5-4.2 4.5-7.5a4.5 4.5 0 0 0-9 0C3.5 9.8 8 14 8 14z" /><circle cx="8" cy="6.5" r="1.6" /></svg>;
}
