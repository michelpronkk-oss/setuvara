import "server-only";

import { loginHref, rememberNext } from "@/lib/app/login-next";
import { cache } from "react";
import { redirect } from "next/navigation";

import { getPublicOrigin } from "@/lib/app/viewer";
import { createClient } from "@/lib/supabase/server";
import { headers } from "next/headers";
import { EVENT_COLUMNS, GUEST_COLUMNS, type EventRecord, type Guest } from "./model";

/** The signed-in organizer's Event Mode and its events, read under RLS. */
const loadOrganizerData = cache(async () => {
  const supabase = await createClient();
  const { data: claims, error } = await supabase.auth.getClaims();
  const userId = typeof claims?.claims?.sub === "string" ? claims.claims.sub : null;
  if (error || !userId) redirect(loginHref());
  const [{ data: profile }, { data: mode }, events, origin] = await Promise.all([
    supabase.from("profiles").select("id, is_published").eq("id", userId).maybeSingle(),
    supabase.from("profile_modes").select("id, is_enabled").eq("profile_id", userId).eq("slug", "event").maybeSingle(),
    supabase.from("events").select(EVENT_COLUMNS).order("starts_at", { ascending: false }).limit(200),
    headers().then(getPublicOrigin),
  ]);
  return {
    supabase,
    userId,
    mode,
    modeLive: Boolean(profile?.is_published && mode?.is_enabled),
    ready: !events.error,
    events: (events.data ?? []) as EventRecord[],
    origin,
  };
});

/** loadOrganizer for this request; `next` is where sign-in returns to. */
export function loadOrganizer(next: string) {
  rememberNext(next);
  return loadOrganizerData();
}

/** One event and its guest list, for its organizer. */
export const loadOrganizerEvent = cache(async (id: string) => {
  const data = await loadOrganizer(`/app/identity/events/${id}`);
  const [{ data: event }, { data: guests }] = await Promise.all([
    data.supabase.from("events").select(EVENT_COLUMNS).eq("id", id).maybeSingle(),
    data.supabase.from("event_registrations").select(GUEST_COLUMNS).eq("event_id", id).order("created_at", { ascending: true }).limit(10000),
  ]);
  return { ...data, event: (event ?? null) as EventRecord | null, guests: (event ? guests ?? [] : []) as Guest[] };
});
