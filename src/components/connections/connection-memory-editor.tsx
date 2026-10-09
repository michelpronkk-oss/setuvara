"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type EncounterMemory = { city: string; venue: string; eventLabel: string };

export function ConnectionMemoryEditor({ connectionId, encounterId, userId, initialNote, initialContext }: { connectionId: string; encounterId?: string; userId: string; initialNote: string; initialContext?: EncounterMemory | null }) {
  const [note, setNote] = useState(initialNote);
  const [context, setContext] = useState<EncounterMemory>(initialContext ?? { city: "", venue: "", eventLabel: "" });
  const [saving, setSaving] = useState<"note" | "context" | null>(null);
  const [status, setStatus] = useState("");

  async function saveNote() {
    if (note.length > 2000) { setStatus("Keep a note under 2,000 characters."); return; }
    setSaving("note"); setStatus("");
    const { error } = await createClient().from("connection_notes").upsert({ connection_id: connectionId, user_id: userId, note }, { onConflict: "connection_id,user_id" });
    setSaving(null); setStatus(error ? "Your note could not be saved. Try again." : "Private note saved.");
  }

  async function saveContext() {
    if (!encounterId) return;
    setSaving("context"); setStatus("");
    const { error } = await createClient().from("encounter_context").upsert({
      encounter_id: encounterId,
      user_id: userId,
      city: context.city.trim() || null,
      venue: context.venue.trim() || null,
      event_label: context.eventLabel.trim() || null,
    }, { onConflict: "encounter_id,user_id" });
    setSaving(null); setStatus(error ? "Where you met could not be saved. Try again." : "Where you met saved for you.");
  }

  return (
    <div className="mt-8 grid gap-5 md:grid-cols-2">
      <section className="rounded-[1.7rem] bg-white p-5 sm:p-7">
        <p className="text-[10px] font-bold tracking-[0.2em] text-black/45">PRIVATE NOTE · ONLY YOU</p>
        <label className="mt-3 block text-sm font-semibold" htmlFor="connection-note">A thought to remember</label>
        <textarea className="mt-3 min-h-36 w-full rounded-2xl border border-black/15 px-4 py-3 text-base leading-6 focus-visible:outline-2" id="connection-note" maxLength={2000} onChange={(event) => setNote(event.target.value)} placeholder="A detail you want to remember or follow up on…" value={note} />
        <div className="mt-3 flex items-center justify-between gap-3"><span className="text-[11px] text-black/40">{note.length}/2000</span><button className="min-h-11 rounded-full bg-[#0d0d0d] px-5 text-xs font-semibold text-white disabled:opacity-50" disabled={saving !== null} onClick={() => void saveNote()} type="button">{saving === "note" ? "Saving…" : "Save note"}</button></div>
      </section>
      <section className="rounded-[1.7rem] bg-white p-5 sm:p-7">
        <p className="text-[10px] font-bold tracking-[0.2em] text-black/45">WHERE YOU MET · PRIVATE TO YOU</p>
        <p className="mt-3 text-sm text-black/55">Add a place or event to your own memory. The other person won’t see these details.</p>
        <div className="mt-4 space-y-3"><label className="block space-y-2 text-sm font-semibold">City<input className="min-h-12 w-full rounded-xl border border-black/15 px-4 text-base font-normal focus-visible:outline-2" maxLength={80} onChange={(event) => setContext((value) => ({ ...value, city: event.target.value }))} value={context.city} /></label><label className="block space-y-2 text-sm font-semibold">Venue<input className="min-h-12 w-full rounded-xl border border-black/15 px-4 text-base font-normal focus-visible:outline-2" maxLength={120} onChange={(event) => setContext((value) => ({ ...value, venue: event.target.value }))} value={context.venue} /></label><label className="block space-y-2 text-sm font-semibold">Event<input className="min-h-12 w-full rounded-xl border border-black/15 px-4 text-base font-normal focus-visible:outline-2" maxLength={100} onChange={(event) => setContext((value) => ({ ...value, eventLabel: event.target.value }))} value={context.eventLabel} /></label></div>
        <div className="mt-4 flex justify-end"><button className="min-h-11 rounded-full px-5 text-xs font-semibold" disabled={!encounterId || saving !== null} onClick={() => void saveContext()} style={{ backgroundColor: "#ff5a4f" }} type="button">{saving === "context" ? "Saving…" : "Save Where You Met"}</button></div>
      </section>
      <p aria-live="polite" className="text-sm text-black/60 md:col-span-2">{status}</p>
    </div>
  );
}
