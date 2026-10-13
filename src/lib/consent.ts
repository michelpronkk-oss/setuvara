"use client";

import { useSyncExternalStore } from "react";

/**
 * Cookie consent. Setuvara itself only sets cookies it needs to work, so the one choice is
 * whether third-party media players (Spotify, SoundCloud, Apple Music, Deezer, YouTube) may load
 * on their own. The choice lives in a first-party cookie for a year; "just this once" lasts for
 * the page session only.
 */

export const CONSENT_COOKIE = "sv-consent";
const MAX_AGE = 60 * 60 * 24 * 365;
const OPEN_EVENT = "sv-consent:open";

export type ConsentChoice = "unset" | "essential" | "media";
type State = { choice: ConsentChoice; session: boolean };

let state: State | null = null;
const listeners = new Set<() => void>();
const SERVER: State = { choice: "unset", session: false };

function read(): State {
  if (state) return state;
  const match = typeof document === "undefined" ? null : document.cookie.match(/(?:^|;\s*)sv-consent=(essential|media)(?:;|$)/);
  state = { choice: (match?.[1] as ConsentChoice | undefined) ?? "unset", session: false };
  return state;
}

function emit(next: State) {
  state = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Saves the visitor's choice for a year. */
export function setConsent(choice: Exclude<ConsentChoice, "unset">) {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${CONSENT_COOKIE}=${choice}; Max-Age=${MAX_AGE}; Path=/; SameSite=Lax${secure}`;
  emit({ ...read(), choice });
}

/** Loads media players for this page session only, after the visitor asked for one. */
export function allowMediaForSession() {
  if (!mediaAllowed(read())) emit({ ...read(), session: true });
}

/** Opens the cookie preferences panel from anywhere (footer link, Cookie policy page). */
export function openConsentPreferences() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

export function onOpenConsentPreferences(listener: () => void) {
  window.addEventListener(OPEN_EVENT, listener);
  return () => window.removeEventListener(OPEN_EVENT, listener);
}

const mediaAllowed = (current: State) => current.choice === "media" || current.session;

export function useConsent() {
  const current = useSyncExternalStore(subscribe, read, () => SERVER);
  return { choice: current.choice, mediaAllowed: mediaAllowed(current) };
}
