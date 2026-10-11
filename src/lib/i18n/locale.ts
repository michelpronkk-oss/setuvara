import { normalizeCountryCode, type CountryCode } from "./countries";

export const DEFAULT_LOCALE = "en";
export const LOCALE_COOKIE = "sv-locale";
export const SUPPORTED_LANGUAGES = ["en", "nl"] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];
export type Locale = Language | `${Language}-${string}`;

export function normalizeLocale(value: unknown): Locale | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const [canonical] = Intl.getCanonicalLocales(value.trim());
    if (!canonical) return null;
    const parts = canonical.split("-");
    if (parts.length > 2 || !SUPPORTED_LANGUAGES.includes(parts[0] as Language)) return null;
    if (parts[1] && !normalizeCountryCode(parts[1])) return null;
    return canonical as Locale;
  } catch {
    return null;
  }
}

export function languageFor(locale: Locale | string): Language {
  return locale.toLowerCase().startsWith("nl") ? "nl" : "en";
}

export function parseAcceptLanguage(header: string | null | undefined): Locale | null {
  if (!header) return null;
  const candidates = header.split(",").flatMap((entry, order) => {
    const [tag, ...parameters] = entry.trim().split(";");
    const qParameter = parameters.find((parameter) => parameter.trim().startsWith("q="));
    const quality = qParameter ? Number(qParameter.trim().slice(2)) : 1;
    const locale = normalizeLocale(tag);
    return locale && Number.isFinite(quality) && quality > 0 && quality <= 1
      ? [{ locale, quality, order }]
      : [];
  });
  candidates.sort((left, right) => right.quality - left.quality || left.order - right.order);
  return candidates[0]?.locale ?? null;
}

export function resolveLocale(input: {
  authenticated?: boolean;
  preferredLocale?: unknown;
  cookieLocale?: unknown;
  acceptLanguage?: string | null;
}): Locale {
  if (input.authenticated) {
    const preferred = normalizeLocale(input.preferredLocale);
    if (preferred) return preferred;
  }
  return normalizeLocale(input.cookieLocale)
    ?? parseAcceptLanguage(input.acceptLanguage)
    ?? DEFAULT_LOCALE;
}

/** Region is explicit account data. It is never inferred from language or request headers. */
export function resolveRegion(preferredRegion: unknown): CountryCode | null {
  return normalizeCountryCode(preferredRegion);
}

function asDate(value: Date | string): Date | null {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

export function formatDate(value: Date | string, locale: string, options: Intl.DateTimeFormatOptions = { dateStyle: "medium" }): string {
  const date = asDate(value);
  return date ? new Intl.DateTimeFormat(locale, options).format(date) : "";
}

export function formatTime(value: Date | string, locale: string, options: Intl.DateTimeFormatOptions = { timeStyle: "short" }): string {
  const date = asDate(value);
  return date ? new Intl.DateTimeFormat(locale, options).format(date) : "";
}

export function formatNumber(value: number, locale: string, options?: Intl.NumberFormatOptions): string {
  return Number.isFinite(value) ? new Intl.NumberFormat(locale, options).format(value) : "";
}

export function formatPercent(value: number, locale: string, maximumFractionDigits = 0): string {
  return formatNumber(value, locale, { style: "percent", maximumFractionDigits });
}

export function formatRelativeDate(value: Date | string, now: Date, locale: string): string {
  const date = asDate(value);
  if (!date || !Number.isFinite(now.getTime())) return "";
  const seconds = Math.round((date.getTime() - now.getTime()) / 1000);
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31_536_000], ["month", 2_592_000], ["week", 604_800],
    ["day", 86_400], ["hour", 3_600], ["minute", 60], ["second", 1],
  ];
  const [unit, divisor] = units.find(([, size]) => Math.abs(seconds) >= size) ?? ["second", 1];
  return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(Math.round(seconds / divisor), unit);
}
