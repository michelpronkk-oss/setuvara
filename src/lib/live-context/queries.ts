import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getActiveLiveContext, getRecentLiveContexts, getSavedLiveContexts, type LiveContext } from "./model";

const LIVE_CONTEXT_COLUMNS = "id,owner_user_id,context_type,label,venue,city,country_code,starts_at,expires_at,source,is_active,is_saved,created_at,updated_at";

export async function listLiveContexts(supabase: SupabaseClient, ownerUserId: string, limit = 50): Promise<LiveContext[]> {
  const { data, error } = await supabase.from("live_contexts")
    .select(LIVE_CONTEXT_COLUMNS)
    .eq("owner_user_id", ownerUserId)
    .order("created_at", { ascending: false })
    .limit(Math.max(0, Math.min(100, Math.floor(limit))));
  return error ? [] : (data ?? []) as LiveContext[];
}

export async function getActiveLiveContextForUser(supabase: SupabaseClient, ownerUserId: string, timestamp = new Date()): Promise<LiveContext | null> {
  const { data, error } = await supabase.from("live_contexts")
    .select(LIVE_CONTEXT_COLUMNS)
    .eq("owner_user_id", ownerUserId)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(10);
  if (error) return null;
  const contexts = (data ?? []) as LiveContext[];
  return getActiveLiveContext(contexts, ownerUserId, timestamp);
}

export async function getRecentLiveContextsForUser(supabase: SupabaseClient, ownerUserId: string, limit = 10): Promise<LiveContext[]> {
  return getRecentLiveContexts(await listLiveContexts(supabase, ownerUserId, 100), ownerUserId, limit);
}

export async function getSavedLiveContextsForUser(supabase: SupabaseClient, ownerUserId: string, limit = 50): Promise<LiveContext[]> {
  return getSavedLiveContexts(await listLiveContexts(supabase, ownerUserId, 100), ownerUserId, limit);
}
