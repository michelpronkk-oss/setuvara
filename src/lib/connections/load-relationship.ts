import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ModeSlug } from "@/components/profile/types";
import { resolveConnectionProfiles, signHomeImage } from "@/lib/app/media";
import {
  buildRelationship,
  type ConnectionRow,
  type CounterpartMode,
  type EncounterRow,
  type MemoryRow,
  type RelationshipModel,
} from "@/lib/connections/relationship";

const CONNECTION_COLUMNS = "id,user_id,connected_user_id,user_display_name_snapshot,connected_display_name_snapshot,guest_display_name,created_at";
const ENCOUNTER_COLUMNS = "id,connection_id,created_by_user_id,shared_by_user_id,shared_mode_slug,share_back_mode_slug,shared_display_name,shared_role,shared_company,share_back_display_name,share_back_role,share_back_company,event_name,city,date_label,source,created_at";
const MEMORY_COLUMNS = "encounter_id,city,venue,event_label,met_on,met_time,provenance,updated_at";

/**
 * Loads one Connection for the signed-in viewer through RLS only (no service role):
 * a viewer who is not a participant gets null, and every private row is filtered to
 * the viewer's own user_id by both the query and the table policies.
 */
export async function loadRelationship(supabase: SupabaseClient, viewerId: string, connectionId: string): Promise<{ model: RelationshipModel; photoUrl: string | null } | null> {
  const { data: connection } = await supabase.from("connections").select(CONNECTION_COLUMNS).eq("id", connectionId).maybeSingle<ConnectionRow>();
  if (!connection || (connection.user_id !== viewerId && connection.connected_user_id !== viewerId)) return null;
  const counterpartId = connection.user_id === viewerId ? connection.connected_user_id : connection.user_id;

  const [{ data: encounters }, { data: note }, { data: counterpart }, { data: history }, { data: passport }, { data: viewerEvent }] = await Promise.all([
    supabase.from("connection_encounters").select(ENCOUNTER_COLUMNS).eq("connection_id", connectionId).order("created_at", { ascending: true }).limit(200),
    supabase.from("connection_notes").select("note,updated_at").eq("connection_id", connectionId).eq("user_id", viewerId).maybeSingle(),
    counterpartId
      ? supabase.from("profiles").select("id,username,display_name,bio").eq("id", counterpartId).eq("is_published", true).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("encounter_context").select("encounter_id,city,venue,event_label,updated_at").eq("user_id", viewerId).order("updated_at", { ascending: false }).limit(200),
    supabase.from("passport_stamps").select("stamp_type,title").eq("user_id", viewerId).in("stamp_type", ["city", "event"]).order("earned_at", { ascending: false }).limit(40),
    supabase.from("profile_modes").select("settings,is_enabled").eq("profile_id", viewerId).eq("slug", "event").maybeSingle(),
  ]);
  const encounterRows = (encounters ?? []) as EncounterRow[];
  if (!encounterRows.length) return null;
  const encounterIds = new Set(encounterRows.map((row) => row.id));
  const { data: memories } = await supabase.from("encounter_context").select(MEMORY_COLUMNS).eq("user_id", viewerId).in("encounter_id", [...encounterIds]);

  const latest = encounterRows[encounterRows.length - 1];
  const viewerShared = latest.shared_by_user_id === viewerId;
  const requestedMode = (viewerShared ? latest.share_back_mode_slug : latest.shared_mode_slug) ?? "personal";
  const mode: ModeSlug = requestedMode === "event" || requestedMode === "business" ? requestedMode : "personal";
  const resolved = counterpart
    ? await resolveConnectionProfiles(supabase, [{ connectionId, profileId: counterpart.id, mode }])
    : null;
  const modes = counterpart ? resolved?.modesByProfile.get(counterpart.id) : undefined;
  const counterpartModes: Partial<Record<ModeSlug, CounterpartMode>> = {};
  for (const [slug, row] of modes ?? []) counterpartModes[slug] = { settings: row.settings, image_path: row.image_path };

  const eventSettings = viewerEvent?.is_enabled && viewerEvent.settings && typeof viewerEvent.settings === "object" ? viewerEvent.settings as Record<string, unknown> : null;
  const model = buildRelationship({
    viewerId,
    connection,
    encounters: encounterRows,
    counterpart: counterpart ?? null,
    counterpartModes,
    note: note ?? null,
    memories: (memories ?? []) as MemoryRow[],
    viewerHistory: ((history ?? []) as MemoryRow[]).filter((row) => !encounterIds.has(row.encounter_id)),
    passport: passport ?? [],
    viewerEventMode: eventSettings ? {
      eventName: typeof eventSettings.eventName === "string" ? eventSettings.eventName : null,
      city: typeof eventSettings.city === "string" ? eventSettings.city : null,
    } : null,
  });
  const photoUrl = await signHomeImage(supabase, model.person.photoPath);
  return { model, photoUrl };
}
