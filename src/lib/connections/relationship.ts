/**
 * The canonical Connection model.
 *
 * A Connection page answers six questions: who is this person, which version of
 * themselves did they share, how and when did we connect, where (only if known),
 * what do I want to remember, and have we met again. Four concepts feed it and are
 * never merged:
 *
 *   PERSON     who they are now: current profile + current Mode (may change any time)
 *   CONNECTION the edge itself: connections.created_at, first encounter's Mode/source
 *   ENCOUNTER  each share moment: immutable snapshots on connection_encounters
 *   MEMORY     the viewer's own private note + per-encounter context (encounter_context)
 *
 * This module is pure (no Supabase, no React) so the rules are unit-tested.
 * The counterpart's profile location, bio, company or Mode city are deliberately NOT
 * inputs to any encounter/"where" field or memory suggestion: they can only appear in
 * `person`, which describes who they are, never where you met.
 */
import type { ModeSlug } from "@/components/profile/types";

export type ConnectionRow = {
  id: string;
  user_id: string;
  connected_user_id: string | null;
  user_display_name_snapshot: string;
  connected_display_name_snapshot: string;
  guest_display_name: string | null;
  created_at: string;
};

export type EncounterRow = {
  id: string;
  connection_id: string;
  created_by_user_id: string | null;
  shared_by_user_id: string;
  shared_mode_slug: string;
  share_back_mode_slug: string | null;
  shared_display_name: string;
  shared_role: string | null;
  shared_company: string | null;
  share_back_display_name: string | null;
  share_back_role: string | null;
  share_back_company: string | null;
  event_name: string | null;
  city: string | null;
  date_label: string | null;
  source: string;
  created_at: string;
};

export type MemoryRow = {
  encounter_id: string;
  city: string | null;
  venue: string | null;
  event_label: string | null;
  met_on?: string | null;
  met_time?: string | null;
  provenance?: string | null;
  updated_at: string;
};

export type CounterpartProfile = { id: string; username: string | null; display_name: string; bio: string | null };
export type CounterpartMode = { settings: Record<string, unknown>; image_path: string | null };

export type RelationshipInput = {
  viewerId: string;
  connection: ConnectionRow;
  encounters: EncounterRow[];
  /** Current, published profile of a registered counterpart (null for guests or unpublished). */
  counterpart: CounterpartProfile | null;
  /** Counterpart's currently enabled Modes, as RLS lets the viewer read them. */
  counterpartModes: Partial<Record<ModeSlug, CounterpartMode>>;
  note: { note: string; updated_at: string } | null;
  /** The viewer's memory rows for THIS connection's encounters. */
  memories: MemoryRow[];
  /** The viewer's own memory rows from other connections (suggestions only). */
  viewerHistory: Pick<MemoryRow, "city" | "venue" | "event_label" | "updated_at">[];
  /** The viewer's own Passport city/event stamps (suggestions only). */
  passport: { stamp_type: string; title: string }[];
  /** The viewer's own current Event Mode, if enabled (suggestions only). */
  viewerEventMode: { eventName: string | null; city: string | null } | null;
  now?: Date;
};

export type SourceKind = "qr" | "link" | "pass" | "tap" | "profile";
export type Provenance = "viewer" | "confirmed" | "corrected" | "suggested";

export type Suggestion = { value: string; reason: string; city?: string | null };

export type EncounterModel = {
  id: string;
  index: number;
  /** Canonical, immutable timestamp of this encounter. */
  at: string;
  kindLabel: string;
  headline: string;
  counterpartMode: ModeSlug | null;
  counterpartModeLabel: string | null;
  viewerMode: ModeSlug | null;
  viewerShared: boolean;
  sourceKind: SourceKind;
  sourceLabel: string;
  sourceDetail: string;
  /** How the counterpart presented themselves at that moment (never rewritten). */
  snapshot: { name: string; role: string | null; company: string | null; asGuest: boolean };
  /** Context Setuvara recorded with the encounter: the sharer's Event Mode at that time. */
  known: { event: string | null; city: string | null; dateLabel: string | null; from: string } | null;
  memory: {
    event: string | null;
    city: string | null;
    venue: string | null;
    metOn: string | null;
    metTime: string | null;
    provenance: Provenance;
    updatedAt: string;
  } | null;
  suggestions: { event: Suggestion[]; city: Suggestion[]; venue: Suggestion[] };
  /** Single known value per field, used to prefill the memory editor. */
  prefill: { event: string | null; city: string | null };
};

export type PersonModel = {
  kind: "registered" | "guest" | "unavailable";
  name: string;
  firstName: string;
  initials: string;
  username: string | null;
  profileHref: string | null;
  /** Which of their Modes this page describes them through. */
  mode: ModeSlug | null;
  modeLabel: string | null;
  photoPath: string | null;
  role: string | null;
  company: string | null;
  /** Their own profile location. About the person; never a meeting place. */
  basedIn: string | null;
  pronouns: string | null;
  about: string | null;
  /** current = from their live profile; snapshot = profile not readable, last shared details. */
  factsFrom: "current" | "snapshot";
  claimedFromGuest: boolean;
  /** Set when the name they connected with differs from their current name. */
  connectedAsName: string | null;
};

export type RelationshipModel = {
  id: string;
  person: PersonModel;
  origin: {
    /** Canonical connections.created_at. */
    createdAt: string;
    headline: string;
    modeLabel: string | null;
    sourceLabel: string;
    sourceDetail: string;
    viewerSharedFirst: boolean;
    viewerSharedBackLabel: string | null;
    event: string | null;
    eventCity: string | null;
  };
  /** Oldest first. */
  encounters: EncounterModel[];
  note: { text: string; updatedAt: string } | null;
  /** True only when an encounter snapshot or the viewer's own memory says where. */
  hasWhere: boolean;
};

const MODE_LABEL: Record<ModeSlug, string> = { personal: "Personal", event: "Event", business: "Business" };

export function modeSlug(value: string | null | undefined): ModeSlug | null {
  return value === "personal" || value === "event" || value === "business" ? value : null;
}

export function modeLabel(value: ModeSlug | null): string | null {
  return value ? `${MODE_LABEL[value]} Mode` : null;
}

function text(value: unknown, max = 280): string | null {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;
}

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || name;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : (parts[0] ?? "S").slice(0, 1);
  return letters.toUpperCase();
}

export function sourceKind(source: string): SourceKind {
  if (source === "qr") return "qr";
  if (source === "link" || source === "share" || source === "native_share") return "link";
  if (source === "direct_share") return "pass";
  if (source === "tap") return "tap";
  return "profile";
}

/**
 * Human source wording. A Tap/QR/pass source records the share surface only,
 * not proof of physical presence or where two people were.
 */
export function describeSource(source: string, viewerShared: boolean, name: string): { kind: SourceKind; label: string; detail: string } {
  const kind = sourceKind(source);
  const first = firstName(name);
  switch (kind) {
    case "qr":
      return { kind, label: "Scanned QR code", detail: viewerShared ? `${first} scanned your QR code` : `You scanned ${first}’s QR code` };
    case "link":
      return { kind, label: "Shared link", detail: viewerShared ? `${first} opened a link you shared` : `You opened a link ${first} shared` };
    case "pass":
      return { kind, label: "Connection Pass", detail: viewerShared ? `You shared a Connection Pass directly with ${first}` : `${first} shared a Connection Pass directly with you` };
    case "tap":
      return { kind, label: "Setuvara Tap", detail: viewerShared ? `You shared Setuvara Tap with ${first}` : `You opened ${first}’s Setuvara Tap` };
    default:
      return { kind, label: "Profile visit", detail: viewerShared ? `${first} connected from your profile` : `You connected from ${first}’s profile` };
  }
}

function sameText(a: string | null | undefined, b: string | null | undefined) {
  return (a ?? "").trim().toLowerCase() === (b ?? "").trim().toLowerCase();
}

/** Provenance for a memory the viewer saves against what Setuvara already knew. */
export function memoryProvenance(
  known: { event: string | null; city: string | null } | null,
  values: { event: string | null; city: string | null },
): Provenance {
  const comparable = (["event", "city"] as const).filter((key) => known?.[key]);
  if (!comparable.length) return "viewer";
  return comparable.every((key) => sameText(known?.[key], values[key])) ? "confirmed" : "corrected";
}

function parseProvenance(value: string | null | undefined): Provenance {
  return value === "confirmed" || value === "corrected" || value === "suggested" ? value : "viewer";
}

function pushUnique(list: Suggestion[], value: string | null | undefined, reason: string, city?: string | null) {
  const clean = text(value, 120);
  if (!clean || list.some((item) => sameText(item.value, clean))) return;
  list.push(city === undefined ? { value: clean, reason } : { value: clean, reason, city });
}

function byFrequency<T>(rows: T[], pick: (row: T) => string | null | undefined) {
  const counts = new Map<string, { value: string; count: number; order: number }>();
  rows.forEach((row, order) => {
    const value = text(pick(row), 120);
    if (!value) return;
    const key = value.toLowerCase();
    const entry = counts.get(key);
    if (entry) entry.count += 1;
    else counts.set(key, { value, count: 1, order });
  });
  return [...counts.values()].sort((a, b) => b.count - a.count || a.order - b.order).map((entry) => entry.value);
}

export function buildRelationship(input: RelationshipInput): RelationshipModel {
  const { viewerId, connection } = input;
  const now = input.now ?? new Date();
  const ordered = [...input.encounters].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
  const memoryByEncounter = new Map(input.memories.map((row) => [row.encounter_id, row]));
  const isGuestEdge = !connection.connected_user_id;
  const viewerIsOwner = connection.user_id === viewerId;
  const historicalName = isGuestEdge
    ? connection.guest_display_name ?? connection.connected_display_name_snapshot
    : viewerIsOwner ? connection.connected_display_name_snapshot : connection.user_display_name_snapshot;

  // ---- Encounters: each one keeps its own snapshot from the moment it happened.
  const shells = ordered.map((encounter) => {
    const viewerShared = encounter.shared_by_user_id === viewerId;
    const asGuest = viewerShared && encounter.share_back_mode_slug === null;
    const snapshot = viewerShared
      ? { name: encounter.share_back_display_name ?? historicalName, role: encounter.share_back_role, company: encounter.share_back_company, asGuest }
      : { name: encounter.shared_display_name, role: encounter.shared_role, company: encounter.shared_company, asGuest: false };
    const counterpartMode = modeSlug(viewerShared ? encounter.share_back_mode_slug : encounter.shared_mode_slug);
    const viewerMode = modeSlug(viewerShared ? encounter.shared_mode_slug : encounter.share_back_mode_slug);
    const hasKnown = Boolean(encounter.event_name || encounter.city || encounter.date_label);
    const known = hasKnown ? {
      event: text(encounter.event_name, 100),
      city: text(encounter.city, 80),
      dateLabel: text(encounter.date_label, 80),
      from: viewerShared ? "your Event Mode at the time" : `${firstName(encounter.shared_display_name)}’s Event Mode at the time`,
    } : null;
    const row = memoryByEncounter.get(encounter.id);
    const memory = row && (row.city || row.venue || row.event_label || row.met_on) ? {
      event: text(row.event_label, 100),
      city: text(row.city, 80),
      venue: text(row.venue, 120),
      metOn: row.met_on ?? null,
      metTime: row.met_time ? row.met_time.slice(0, 5) : null,
      provenance: parseProvenance(row.provenance),
      updatedAt: row.updated_at,
    } : null;
    return { encounter, viewerShared, snapshot, counterpartMode, viewerMode, known, memory };
  });

  // ---- Person: current identity first, the latest snapshot only as a fallback.
  const latest = shells[shells.length - 1];
  const counterpart = input.counterpart;
  const kind: PersonModel["kind"] = isGuestEdge ? "guest" : counterpart ? "registered" : "unavailable";
  // A guest who later claimed an account never shared a Mode: describe them through Personal.
  const personMode = latest?.counterpartMode
    ?? shells.map((shell) => shell.counterpartMode).filter(Boolean).pop()
    ?? (counterpart && input.counterpartModes.personal ? "personal" : null);
  const liveMode = counterpart && personMode ? input.counterpartModes[personMode] ?? null : null;
  const personal = counterpart ? input.counterpartModes.personal ?? null : null;
  const settings = liveMode?.settings ?? {};
  const name = counterpart?.display_name?.trim() || latest?.snapshot.name || historicalName;
  let role: string | null = null;
  let company: string | null = null;
  let basedIn: string | null = null;
  let pronouns: string | null = null;
  let about: string | null = null;
  let factsFrom: PersonModel["factsFrom"] = "current";
  if (liveMode) {
    if (personMode === "personal") {
      basedIn = text(settings.location, 80);
      pronouns = text(settings.pronouns, 40);
      about = [text(counterpart?.bio, 280), text(settings.note)].filter(Boolean).join(" · ") || null;
    } else if (personMode === "event") {
      role = text(settings.role, 80);
      about = text(settings.hereToMeet);
    } else {
      role = text(settings.role, 80);
      company = text(settings.company, 100);
      basedIn = text(settings.city, 80);
      about = text(settings.description);
    }
  } else if (latest) {
    factsFrom = "snapshot";
    role = latest.snapshot.role;
    company = latest.snapshot.company;
    if (counterpart && personal) about = text(counterpart.bio, 280);
  }
  const photoPath = counterpart ? liveMode?.image_path ?? personal?.image_path ?? null : null;
  const username = counterpart?.username ?? null;
  const profileMode = liveMode ? personMode : personal ? "personal" : null;
  const firstShell = shells[0];
  const person: PersonModel = {
    kind,
    name,
    firstName: firstName(name),
    initials: initials(name),
    username,
    profileHref: username && profileMode ? `/${username}${profileMode === "personal" ? "" : `?mode=${profileMode}`}` : null,
    mode: personMode,
    modeLabel: modeLabel(personMode),
    photoPath,
    role,
    company,
    basedIn,
    pronouns,
    about,
    factsFrom,
    claimedFromGuest: !isGuestEdge && shells.some((shell) => shell.snapshot.asGuest),
    connectedAsName: firstShell && !sameText(firstShell.snapshot.name, name) ? firstShell.snapshot.name : null,
  };

  // ---- Suggestions: only the viewer's own context and this relationship's encounters.
  const historyEvents = byFrequency(input.viewerHistory, (row) => row.event_label);
  const historyCities = byFrequency(input.viewerHistory, (row) => row.city);
  const venueRows = input.viewerHistory.filter((row) => text(row.venue, 120));
  const passportCities = input.passport.filter((stamp) => stamp.stamp_type === "city").map((stamp) => stamp.title);
  const passportEvents = input.passport.filter((stamp) => stamp.stamp_type === "event").map((stamp) => stamp.title);

  const encounters: EncounterModel[] = shells.map((shell, index) => {
    const { encounter, viewerShared, known, memory } = shell;
    const counterpartName = person.name;
    const source = describeSource(encounter.source, viewerShared, counterpartName);
    const recent = now.getTime() - Date.parse(encounter.created_at) < 48 * 3_600_000;
    const ownEvent = !viewerShared && shell.viewerMode === "event" && input.viewerEventMode ? input.viewerEventMode : null;

    const event: Suggestion[] = [];
    const city: Suggestion[] = [];
    const venue: Suggestion[] = [];
    pushUnique(event, known?.event, known?.from ?? "");
    pushUnique(city, known?.city, known?.from ?? "");
    if (ownEvent) {
      pushUnique(event, ownEvent.eventName, "Your Event Mode");
      pushUnique(city, ownEvent.city, "Your Event Mode");
    }
    shells.forEach((other, otherIndex) => {
      if (otherIndex === index) return;
      const reason = "Another time you connected";
      pushUnique(event, other.memory?.event ?? other.known?.event, reason);
      pushUnique(city, other.memory?.city ?? other.known?.city, reason);
      pushUnique(venue, other.memory?.venue, reason, other.memory?.city ?? other.known?.city ?? null);
    });
    historyEvents.forEach((value) => pushUnique(event, value, "You’ve used before"));
    historyCities.forEach((value) => pushUnique(city, value, "You’ve used before"));
    for (const value of byFrequency(venueRows, (row) => row.venue)) {
      const where = venueRows.find((row) => sameText(row.venue, value))?.city ?? null;
      pushUnique(venue, value, "You’ve used before", where);
    }
    passportEvents.forEach((value) => pushUnique(event, value, "In your Passport"));
    passportCities.forEach((value) => pushUnique(city, value, "In your Passport"));

    const ownPrefillEvent = ownEvent && recent ? text(ownEvent.eventName, 100) : null;
    const ownPrefillCity = ownEvent && recent ? text(ownEvent.city, 80) : null;
    const where = memory?.event || memory?.city || memory?.venue || known?.event || known?.city;
    return {
      id: encounter.id,
      index,
      at: encounter.created_at,
      kindLabel: index === 0 ? "First connected" : where ? "Met again" : "Connected again",
      headline: known?.event
        ? `Connected at ${known.event}`
        : viewerShared
          ? `Connected through your ${MODE_LABEL[modeSlug(encounter.shared_mode_slug) ?? "personal"]} Mode`
          : `Connected through ${MODE_LABEL[modeSlug(encounter.shared_mode_slug) ?? "personal"]} Mode`,
      counterpartMode: shell.counterpartMode,
      counterpartModeLabel: modeLabel(shell.counterpartMode),
      viewerMode: shell.viewerMode,
      viewerShared,
      sourceKind: source.kind,
      sourceLabel: source.label,
      sourceDetail: source.detail,
      snapshot: shell.snapshot,
      known,
      memory,
      suggestions: { event: event.slice(0, 12), city: city.slice(0, 12), venue: venue.slice(0, 12) },
      prefill: { event: known?.event ?? ownPrefillEvent, city: known?.city ?? ownPrefillCity },
    };
  });

  const first = encounters[0];
  const firstRow = ordered[0];
  return {
    id: connection.id,
    person,
    origin: {
      createdAt: connection.created_at,
      headline: first?.headline ?? "Connected on Setuvara",
      modeLabel: firstRow ? modeLabel(modeSlug(firstRow.shared_mode_slug)) : null,
      sourceLabel: first?.sourceLabel ?? "Setuvara",
      sourceDetail: first?.sourceDetail ?? "",
      viewerSharedFirst: Boolean(first?.viewerShared),
      viewerSharedBackLabel: first ? modeLabel(first.viewerMode) : null,
      event: first?.known?.event ?? null,
      eventCity: first?.known?.city ?? null,
    },
    encounters,
    note: input.note && input.note.note.trim() ? { text: input.note.note, updatedAt: input.note.updated_at } : null,
    hasWhere: encounters.some((item) => Boolean(item.known?.event || item.known?.city || item.memory?.city || item.memory?.venue || item.memory?.event)),
  };
}
