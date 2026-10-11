import { normalizeCountryCode } from "@/lib/i18n/countries";

export const LIVE_CONTEXT_TYPES = ["event", "meeting", "place", "custom"] as const;
export type LiveContextType = (typeof LIVE_CONTEXT_TYPES)[number];
export type LiveContextSource = "manual" | "saved" | "recent" | "event" | "calendar" | "device_confirmed" | "organizer" | (string & {});

export type LiveContext = {
  id: string;
  owner_user_id: string;
  context_type: LiveContextType;
  label: string;
  venue: string | null;
  city: string | null;
  country_code: string | null;
  starts_at: string | null;
  expires_at: string;
  source: LiveContextSource;
  is_active: boolean;
  is_saved: boolean;
  created_at: string;
  updated_at: string;
};

export function isEffectiveLiveContext(context: LiveContext, timestamp: Date): boolean {
  const expiresAt = Date.parse(context.expires_at);
  const startsAt = context.starts_at ? Date.parse(context.starts_at) : null;
  return context.is_active
    && Number.isFinite(timestamp.getTime())
    && Number.isFinite(expiresAt)
    && expiresAt > timestamp.getTime()
    && (startsAt === null || (Number.isFinite(startsAt) && startsAt <= timestamp.getTime()));
}

export function getActiveLiveContext(contexts: readonly LiveContext[], userId: string, timestamp: Date): LiveContext | null {
  return [...contexts]
    .filter((context) => context.owner_user_id === userId && isEffectiveLiveContext(context, timestamp))
    .sort((left, right) => Date.parse(right.created_at) - Date.parse(left.created_at))[0] ?? null;
}

export function getRecentLiveContexts(contexts: readonly LiveContext[], userId: string, limit = 10, timestamp = new Date()): LiveContext[] {
  const safeLimit = Number.isFinite(limit) ? Math.max(0, Math.min(50, Math.floor(limit))) : 10;
  return [...contexts]
    .filter((context) => context.owner_user_id === userId && !context.is_saved && !isEffectiveLiveContext(context, timestamp))
    .sort((left, right) => Date.parse(right.created_at) - Date.parse(left.created_at))
    .slice(0, safeLimit);
}

export function getSavedLiveContexts(contexts: readonly LiveContext[], userId: string, limit = 50): LiveContext[] {
  const safeLimit = Number.isFinite(limit) ? Math.max(0, Math.min(100, Math.floor(limit))) : 50;
  return [...contexts]
    .filter((context) => context.owner_user_id === userId && context.is_saved)
    .sort((left, right) => Date.parse(right.updated_at) - Date.parse(left.updated_at))
    .slice(0, safeLimit);
}

export function normalizeCityForIdentity(city: string): string {
  return city.normalize("NFC").trim().replace(/\s+/gu, " ").toLowerCase();
}

/** Country stays in the identity key; display names retain their original Unicode form. */
export function cityStampIdentity(city: string, countryCode: string | null): string | null {
  const normalizedCity = normalizeCityForIdentity(city);
  if (!normalizedCity) return null;
  if (countryCode) {
    const country = normalizeCountryCode(countryCode);
    if (!country) return null;
    return `city:${country}:${normalizedCity}`;
  }
  return `city:unknown:${normalizedCity}`;
}
