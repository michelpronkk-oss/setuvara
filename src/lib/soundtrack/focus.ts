/**
 * One intentional audio source at a time. Media blocks (videos, other music)
 * claim focus while they play; a profile soundtrack listens and steps aside,
 * then comes back when the claim is released. Browser only, page-wide.
 */

type Claim = { pause?: () => void };

const claims = new Map<string, Claim>();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

export const mediaFocus = {
  /** Something other than the soundtrack started playing. */
  claim(id: string, pause?: () => void) {
    claims.set(id, { pause });
    emit();
  },
  release(id: string) {
    if (claims.delete(id)) emit();
  },
  busy() {
    return claims.size > 0;
  },
  /** The visitor explicitly chose the soundtrack: ask controllable media to pause.
   * Keep its blocker until its real pause/end event so the two sources cannot overlap. */
  yield() {
    let releasedUntracked = false;
    for (const [id, claim] of [...claims]) {
      if (claim.pause) {
        try { claim.pause(); } catch { claims.delete(id); releasedUntracked = true; }
      } else {
        // Third-party embeds without a player API cannot be paused. An explicit
        // Sound on choice yields to the Setuvara soundtrack as before.
        claims.delete(id);
        releasedUntracked = true;
      }
    }
    if (releasedUntracked) emit();
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  },
};

/** Only one Mode soundtrack plays on a page, even with several previews mounted. */
const soundtracks = new Set<(owner: string) => void>();

export const soundtrackFocus = {
  /** Announce that `owner` started playing; every other soundtrack stops. */
  take(owner: string) {
    soundtracks.forEach((stop) => stop(owner));
  },
  subscribe(stop: (owner: string) => void) {
    soundtracks.add(stop);
    return () => { soundtracks.delete(stop); };
  },
};

export type SoundPreference = "on" | "off";
const KEY = "setuvara:sound";
let remembered: SoundPreference | null = null;
const preferenceListeners = new Set<() => void>();

/** For useSyncExternalStore: changes in this tab and in other tabs. */
export const soundPreferenceStore = {
  subscribe(listener: () => void) {
    preferenceListeners.add(listener);
    const onStorage = (event: StorageEvent) => { if (event.key === KEY) listener(); };
    window.addEventListener("storage", onStorage);
    return () => { preferenceListeners.delete(listener); window.removeEventListener("storage", onStorage); };
  },
};

/** The visitor's Sound on / Sound off choice, shared by every Setuvara they open. */
export function readSoundPreference(): SoundPreference | null {
  try {
    const value = window.localStorage.getItem(KEY);
    return value === "on" || value === "off" ? value : remembered;
  } catch {
    return remembered;
  }
}

export function writeSoundPreference(value: SoundPreference) {
  remembered = value;
  try { window.localStorage.setItem(KEY, value); } catch { /* private mode: the choice lasts this visit */ }
  preferenceListeners.forEach((listener) => listener());
}
