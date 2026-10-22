export const usernamePattern = /^[a-z0-9_]{3,24}$/;

/**
 * Every top-level route and system word. The database holds the same list in
 * private.reserved_handles (migration 20261021110000); tests/handles checks they match
 * and that every folder in src/app is covered.
 */
export const reservedUsernames = [
  "about",
  "account",
  "admin",
  "api",
  "app",
  "apple-touch-icon",
  "assets",
  "auth",
  "blog",
  "brand",
  "business",
  "careers",
  "compare",
  "connect",
  "connections",
  "contact",
  "cookies",
  "creator",
  "d",
  "data",
  "data-deletion",
  "e",
  "event",
  "events",
  "favicon",
  "favicon.ico",
  "features",
  "fonts",
  "gallery",
  "handles",
  "help",
  "icon",
  "images",
  "internal",
  "login",
  "manifest",
  "manifest.json",
  "modes",
  "next",
  "nl",
  "og",
  "personal",
  "pricing",
  "privacy",
  "purchase",
  "q",
  "refunds",
  "roadmap",
  "robots",
  "robots.txt",
  "s",
  "security",
  "settings",
  "share",
  "signup",
  "sitemap",
  "sitemap.xml",
  "static",
  "status",
  "support",
  "t",
  "teams",
  "templates",
  "terms",
  "tools",
  "u",
  "wallet",
  "_next",
] as const;

const reservedUsernameSet = new Set<string>(reservedUsernames);

export function normalizeUsername(value: string) {
  return value.trim().toLowerCase();
}

export function isReservedUsername(value: string) {
  return reservedUsernameSet.has(normalizeUsername(value));
}

export function isAllowedUsername(value: string) {
  return usernamePattern.test(value) && !isReservedUsername(value);
}
