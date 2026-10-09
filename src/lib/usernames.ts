export const usernamePattern = /^[a-z0-9_]{3,24}$/;

export const reservedUsernames = [
  "app",
  "login",
  "signup",
  "auth",
  "api",
  "pricing",
  "about",
  "help",
  "teams",
  "events",
  "security",
  "privacy",
  "terms",
  "settings",
  "account",
  "share",
  "connections",
  "wallet",
  "admin",
  "support",
  "contact",
  "careers",
  "brand",
  "status",
  "u",
  "_next",
  "next",
  "favicon",
  "icon",
  "robots",
  "sitemap",
  "manifest",
  "apple-touch-icon",
  "assets",
  "static",
  "images",
  "fonts",
  "favicon.ico",
  "robots.txt",
  "sitemap.xml",
  "manifest.json",
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
