import { normalizeCountryCode, type CountryCode } from "./countries";

export const DEFAULT_LOCALE = "en";
export const SUPPORTED_LANGUAGES = ["en"] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];
export type Locale = typeof DEFAULT_LOCALE;

export function normalizeLocale(value: unknown): Locale | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const [canonical] = Intl.getCanonicalLocales(value.trim());
    if (!canonical) return null;
    return canonical.split("-")[0]?.toLowerCase() === "en" ? DEFAULT_LOCALE : null;
  } catch {
    return null;
  }
}

export function languageFor(_locale?: Locale | string): Language {
  void _locale;
  return "en";
}

export function resolveLocale(_input?: {
  authenticated?: boolean;
  preferredLocale?: unknown;
  cookieLocale?: unknown;
  acceptLanguage?: string | null;
}): Locale {
  void _input;
  return DEFAULT_LOCALE;
}

/** Region is explicit account data. It is never inferred from language or request headers. */
export function resolveRegion(preferredRegion: unknown): CountryCode | null {
  return normalizeCountryCode(preferredRegion);
}

function asDate(value: Date | string): Date | null {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

export function formatDate(value: Date | string, _locale: string, options: Intl.DateTimeFormatOptions = { dateStyle: "medium" }): string {
  const date = asDate(value);
  return date ? new Intl.DateTimeFormat("en-US", options).format(date) : "";
}

export function formatTime(value: Date | string, _locale: string, options: Intl.DateTimeFormatOptions = { timeStyle: "short" }): string {
  const date = asDate(value);
  return date ? new Intl.DateTimeFormat("en-US", options).format(date) : "";
}

export function formatNumber(value: number, _locale: string, options?: Intl.NumberFormatOptions): string {
  void _locale;
  return Number.isFinite(value) ? new Intl.NumberFormat("en-US", options).format(value) : "";
}

export function formatPercent(value: number, locale: string, maximumFractionDigits = 0): string {
  return formatNumber(value, locale, { style: "percent", maximumFractionDigits });
}

export function formatRelativeDate(value: Date | string, now: Date, _locale: string): string {
  void _locale;
  const date = asDate(value);
  if (!date || !Number.isFinite(now.getTime())) return "";
  const seconds = Math.round((date.getTime() - now.getTime()) / 1000);
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31_536_000], ["month", 2_592_000], ["week", 604_800],
    ["day", 86_400], ["hour", 3_600], ["minute", 60], ["second", 1],
  ];
  const [unit, divisor] = units.find(([, size]) => Math.abs(seconds) >= size) ?? ["second", 1];
  return new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(Math.round(seconds / divisor), unit);
}
