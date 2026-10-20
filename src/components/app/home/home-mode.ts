import type { ModeSlug } from "@/components/profile/types";

// The Mode shown on Home, remembered per device. The Home stage and the app sidebar both read it,
// so picking a Mode in one place moves the other.
export const HOME_MODE_KEY = "sv-home-mode";
export type HomeMode = Exclude<ModeSlug, "creator">;

export function subscribeHomeMode(listener: () => void) {
  window.addEventListener("storage", listener);
  window.addEventListener(HOME_MODE_KEY, listener);
  return () => { window.removeEventListener("storage", listener); window.removeEventListener(HOME_MODE_KEY, listener); };
}

export function rememberedHomeMode(): HomeMode | null {
  try {
    const saved = window.localStorage.getItem(HOME_MODE_KEY);
    return saved === "personal" || saved === "event" || saved === "business" ? saved : null;
  } catch { return null; }
}

export function rememberHomeMode(mode: HomeMode) {
  try { window.localStorage.setItem(HOME_MODE_KEY, mode); window.dispatchEvent(new Event(HOME_MODE_KEY)); } catch { /* Selection still works without storage. */ }
}
