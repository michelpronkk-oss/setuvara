"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { settleEvent } from "@/app/app/identity/events/actions";
import { Field, Segmented, TextArea, TextInput, Toggle } from "@/app/app/identity/editor-ui";
import { coralButton, inkButton, lineButton } from "@/components/creator/studio-ui";
import { isTimeZone, slugify, utcToZoned, zonedToUtc, type EventRecord } from "@/lib/events/model";
import { createClient } from "@/lib/supabase/client";

type Draft = {
  title: string; summary: string; date: string; start: string; end: string; timezone: string;
  where: "place" | "online"; venue_name: string; address: string; city: string; online_url: string;
  limit: boolean; capacity: string; waitlist_enabled: boolean; closes: "start" | "end";
};

const ERRORS: Record<string, string> = {
  event_timezone_invalid: "Pick a time zone from the list.",
  event_already_ended: "This time is in the past. Pick a future date.",
  event_has_guests: "People have RSVPed, so this can't go back to draft. Cancel it instead.",
  event_cancelled: "This event was cancelled and can't be changed.",
  event_limit: "You have 50 upcoming events, the most for now.",
  event_mode_mismatch: "Events live in your Event Mode.",
};
const errorMessage = (message?: string) => Object.entries(ERRORS).find(([key]) => message?.includes(key))?.[1] ?? "That didn't save. Check the details and try again.";

function deviceZone() {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; } catch { return "UTC"; }
}
function zones(current: string) {
  let list: string[] = [];
  try { list = (Intl as unknown as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf?.("timeZone") ?? []; } catch { list = []; }
  return Array.from(new Set([current, "UTC", ...list])).filter(isTimeZone);
}
function tomorrow() {
  const day = new Date(Date.now() + 86_400_000);
  return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
}

function fromEvent(event: EventRecord | null): Draft {
  if (!event) return { title: "", summary: "", date: tomorrow(), start: "19:00", end: "22:00", timezone: deviceZone(), where: "place", venue_name: "", address: "", city: "", online_url: "", limit: false, capacity: "50", waitlist_enabled: true, closes: "start" };
  const start = utcToZoned(event.starts_at, event.timezone);
  const end = utcToZoned(event.ends_at, event.timezone);
  return {
    title: event.title, summary: event.summary, date: start.date, start: start.time, end: end.time, timezone: event.timezone,
    where: event.online_url && !event.venue_name ? "online" : "place", venue_name: event.venue_name, address: event.address, city: event.city, online_url: event.online_url ?? "",
    limit: event.capacity !== null, capacity: String(event.capacity ?? 50), waitlist_enabled: event.waitlist_enabled,
    closes: event.registration_closes_at && new Date(event.registration_closes_at).getTime() === new Date(event.ends_at).getTime() ? "end" : "start",
  };
}

/**
 * Create or edit one event. The essentials sit on one screen: what, when, where; seats and RSVP rules
 * come after. Times are entered in the event's own time zone and stored in UTC. It saves straight to the
 * database as the organizer, which re-checks everything.
 */
export function EventEditor({ event, profileId, modeId, modeLive, ended = false }: { event: EventRecord | null; profileId: string; modeId: string; modeLive: boolean; ended?: boolean }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>(() => fromEvent(event));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tried, setTried] = useState(false);
  const zoneList = useMemo(() => zones(draft.timezone), [draft.timezone]);
  const set = (next: Partial<Draft>) => setDraft((current) => ({ ...current, ...next }));
  const locked = event?.status === "cancelled";
  const guests = (event?.confirmed_count ?? 0) + (event?.waitlist_count ?? 0);
  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(fromEvent(event)), [draft, event]);

  // End before start means it runs past midnight.
  const startsAt = zonedToUtc(draft.date, draft.start, draft.timezone);
  let endsAt = zonedToUtc(draft.date, draft.end, draft.timezone);
  if (startsAt && endsAt && endsAt <= startsAt) endsAt = new Date(new Date(endsAt).getTime() + 86_400_000).toISOString();
  const capacity = draft.limit ? Number(draft.capacity) : null;

  const problems: Record<string, string> = {};
  if (!draft.title.trim()) problems.title = "Give it a name.";
  if (!startsAt) problems.date = "Pick a date and time.";
  if (!isTimeZone(draft.timezone)) problems.timezone = "Pick a time zone.";
  if (draft.where === "online" && !/^https:\/\/[^\s/]+\.[^\s]+$/i.test(draft.online_url.trim())) problems.online_url = "Add the https:// link people join with.";
  if (draft.where === "place" && draft.online_url.trim() && !/^https:\/\/[^\s/]+\.[^\s]+$/i.test(draft.online_url.trim())) problems.online_url = "Start the link with https://";
  if (capacity !== null && (!Number.isInteger(capacity) || capacity < 1 || capacity > 10000)) problems.capacity = "Between 1 and 10,000.";
  const show = (key: string) => (tried ? problems[key] : undefined);

  async function save(status: EventRecord["status"]) {
    setTried(true);
    if (Object.keys(problems).length) { setError(Object.values(problems)[0]); return; }
    setBusy(true);
    setError(null);
    const online = draft.online_url.trim() || null;
    const row = {
      title: draft.title.trim(),
      slug: slugify(draft.title),
      summary: draft.summary.trim(),
      starts_at: startsAt!,
      ends_at: endsAt!,
      timezone: draft.timezone,
      venue_name: draft.where === "place" ? draft.venue_name.trim() : "",
      address: draft.where === "place" ? draft.address.trim() : "",
      city: draft.where === "place" ? draft.city.trim() : "",
      online_url: online,
      capacity,
      waitlist_enabled: draft.waitlist_enabled,
      registration_closes_at: draft.closes === "end" ? endsAt! : null,
      status,
    };
    const supabase = createClient();
    const result = event
      ? await supabase.from("events").update(row).eq("id", event.id).eq("profile_id", profileId).select("id").single()
      : await supabase.from("events").insert({ ...row, profile_id: profileId, mode_id: modeId }).select("id").single();
    if (result.error || !result.data) { setBusy(false); setError(errorMessage(result.error?.message)); return; }
    // More seats may have promoted the waitlist; those guests get their email now.
    if (event && event.waitlist_count > 0) await settleEvent(event.id).catch(() => null);
    setBusy(false);
    if (!event) router.replace(`/app/identity/events/${result.data.id}`);
    else router.refresh();
  }

  async function cancelEvent() {
    if (!event || !window.confirm(guests ? `Cancel this event? ${guests} ${guests === 1 ? "guest stays" : "guests stay"} on the record, and the page shows it's cancelled. This can't be undone.` : "Cancel this event? This can't be undone.")) return;
    setBusy(true);
    const { error: cancelError } = await createClient().from("events").update({ status: "cancelled" }).eq("id", event.id).eq("profile_id", profileId);
    setBusy(false);
    if (cancelError) { setError(errorMessage(cancelError.message)); return; }
    router.refresh();
  }

  async function remove() {
    if (!event) return;
    const what = event.status === "draft" ? "this draft" : "this event";
    const note = guests || locked || ended ? " Its page, guest list and check-ins go with it. Connections made at the door stay." : "";
    if (!window.confirm(`Delete ${what}?${note} This can't be undone.`)) return;
    setBusy(true);
    const { data: gone, error: deleteError } = await createClient().from("events").delete().eq("id", event.id).eq("profile_id", profileId).select("id");
    setBusy(false);
    if (deleteError) { setError("That didn't delete. Try again."); return; }
    // The database keeps a coming event that people joined; it has to be cancelled first.
    if (!gone?.length) { setError("People have RSVPed to this event. Cancel it first, then you can delete it."); return; }
    router.replace("/app/identity/events");
    router.refresh();
  }

  const published = event?.status === "published";
  // Over, cancelled, or nobody ever joined (the database has the final say).
  const deletable = Boolean(event) && (locked || ended || guests === 0);
  const deleteButton = <button className="min-h-11 rounded-full px-4 text-[15px] font-semibold text-black/55 transition hover:text-black" data-delete-event disabled={busy} onClick={() => void remove()} type="button">{event?.status === "draft" ? "Delete draft" : "Delete event"}</button>;
  return (
    <form className="flex min-w-0 flex-col gap-8" onSubmit={(submit) => { submit.preventDefault(); void save(published ? "published" : "draft"); }}>
      <fieldset className="flex min-w-0 flex-col gap-5" disabled={locked || busy}>
        <Field error={show("title")} htmlFor="ev-title" label="Event name">
          <TextInput big id="ev-title" maxLength={100} onChange={(change) => set({ title: change.target.value })} placeholder="Founders dinner" value={draft.title} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-[1.3fr_1fr_1fr]">
          <Field error={show("date")} htmlFor="ev-date" label="Date"><TextInput id="ev-date" onChange={(change) => set({ date: change.target.value })} type="date" value={draft.date} /></Field>
          <Field htmlFor="ev-start" label="Starts"><TextInput id="ev-start" onChange={(change) => set({ start: change.target.value })} step={300} type="time" value={draft.start} /></Field>
          <Field hint={draft.end <= draft.start ? "Next day" : undefined} htmlFor="ev-end" label="Ends"><TextInput id="ev-end" onChange={(change) => set({ end: change.target.value })} step={300} type="time" value={draft.end} /></Field>
        </div>
        <Field error={show("timezone")} hint="Guests see times in this zone" htmlFor="ev-zone" label="Time zone">
          <select className="min-h-[52px] w-full rounded-[18px] bg-white px-4 text-[16px] shadow-[inset_0_0_0_1px_rgba(13,13,13,.14)] outline-none focus:shadow-[inset_0_0_0_2px_#0D0D0D]" id="ev-zone" onChange={(change) => set({ timezone: change.target.value })} value={draft.timezone}>
            {zoneList.map((zone) => <option key={zone} value={zone}>{zone.replaceAll("_", " ")}</option>)}
          </select>
        </Field>

        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3"><p className="text-sm font-semibold">Where</p><Segmented label="Where" onChange={(where) => set({ where })} options={[{ value: "place", label: "In person" }, { value: "online", label: "Online" }]} size="sm" value={draft.where} /></div>
          {draft.where === "place" ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field htmlFor="ev-venue" label="Venue"><TextInput id="ev-venue" maxLength={120} onChange={(change) => set({ venue_name: change.target.value })} placeholder="Hotel V Fizeaustraat" value={draft.venue_name} /></Field>
                <Field htmlFor="ev-city" label="City"><TextInput id="ev-city" maxLength={80} onChange={(change) => set({ city: change.target.value })} placeholder="Amsterdam" value={draft.city} /></Field>
              </div>
              <Field hint="Optional" htmlFor="ev-address" label="Address"><TextInput autoComplete="street-address" id="ev-address" maxLength={240} onChange={(change) => set({ address: change.target.value })} placeholder="Fizeaustraat 2, 1097 SC" value={draft.address} /></Field>
            </>
          ) : (
            <Field error={show("online_url")} hint="Shown on the page" htmlFor="ev-online" label="Join link"><TextInput id="ev-online" inputMode="url" maxLength={300} onChange={(change) => set({ online_url: change.target.value })} placeholder="https://" value={draft.online_url} /></Field>
          )}
        </div>

        <Field hint="Optional" htmlFor="ev-summary" label="About the event"><TextArea id="ev-summary" maxLength={2000} onChange={(change) => set({ summary: change.target.value })} placeholder="What it is, who it's for, what to bring." value={draft.summary} /></Field>

        <div className="flex flex-col gap-4 rounded-[24px] bg-white p-5 shadow-[inset_0_0_0_1px_rgba(13,13,13,.08)]">
          <p className="font-label text-[11px] uppercase tracking-[0.16em] text-black/50">RSVPs</p>
          <div className="flex items-center justify-between gap-4">
            <div><p className="text-[15px] font-semibold">Limit spots</p><p className="text-[13px] text-black/55">{draft.limit ? "RSVPs stop at this number." : "Anyone can RSVP."}</p></div>
            <Toggle label="Limit spots" on={draft.limit} onChange={(limit) => set({ limit })} />
          </div>
          {draft.limit && (
            <>
              <Field error={show("capacity")} hint={event ? `${event.confirmed_count} going now` : undefined} htmlFor="ev-capacity" label="Spots"><TextInput id="ev-capacity" inputMode="numeric" max={10000} min={1} onChange={(change) => set({ capacity: change.target.value.replace(/[^0-9]/g, "") })} value={draft.capacity} /></Field>
              <div className="flex items-center justify-between gap-4">
                <div><p className="text-[15px] font-semibold">Waitlist when full</p><p className="text-[13px] text-black/55">Freed spots go to the next person, who gets an email.</p></div>
                <Toggle label="Waitlist when full" on={draft.waitlist_enabled} onChange={(waitlist_enabled) => set({ waitlist_enabled })} />
              </div>
            </>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[15px] font-semibold">RSVPs close</p>
            <Segmented label="RSVPs close" onChange={(closes) => set({ closes })} options={[{ value: "start", label: "When it starts" }, { value: "end", label: "When it ends" }]} size="sm" value={draft.closes} />
          </div>
        </div>
      </fieldset>

      {!modeLive && !locked && <p className="rounded-[18px] bg-[#FFF3D6] px-4 py-3 text-[14px] leading-[1.5]">Your Event Mode is off or your profile isn&apos;t live, so the event page stays hidden until you turn them on.</p>}
      {error && <p className="text-[14px] font-semibold text-[#B42318]" role="alert">{error}</p>}

      {!locked && (
        <div className="flex flex-wrap items-center gap-3">
          {published
            ? <button className={inkButton} disabled={busy || !dirty} type="submit">{busy ? "Saving…" : dirty ? "Save changes" : "Saved"}</button>
            : <>
              <button className={coralButton} disabled={busy} onClick={() => void save("published")} type="button">{busy ? "Saving…" : "Publish event"}</button>
              <button className={lineButton} disabled={busy} type="submit">Save draft</button>
            </>}
          <span className="ml-auto flex flex-wrap gap-1">
            {deletable && deleteButton}
            {event && published && !ended && <button className="min-h-11 rounded-full px-4 text-[15px] font-semibold text-[#B42318] transition hover:bg-[#B42318]/[0.06]" disabled={busy} onClick={() => void cancelEvent()} type="button">Cancel event</button>}
          </span>
        </div>
      )}
      {locked && <div className="flex justify-end">{deleteButton}</div>}
    </form>
  );
}
