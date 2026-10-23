import type { MetadataRoute } from "next";

import { SETUVARA_ORIGIN } from "@/lib/marketing/metadata";

/**
 * IndexNow tells Bing, Yandex, Naver, Seznam and Yep that pages changed, so they recrawl in hours
 * instead of days (Bing's index also feeds ChatGPT search and Copilot). The key is public by
 * design: engines fetch /<key>.txt from setuvara.com to confirm the site sent the ping.
 */
export const INDEXNOW_KEY = "ef468c138cd27ee2321b2c045a9d6b35";

const ENDPOINT = "https://api.indexnow.org/indexnow";
const DAY_MS = 24 * 60 * 60 * 1000;
// A little over a day, so a daily run never misses a change made just before the previous one.
const WINDOW_MS = DAY_MS + 2 * 60 * 60 * 1000;
const MAX_URLS = 10_000;

/**
 * The sitemap entries that changed since the last daily run: member pages and posts by their own
 * lastModified, and the entries without one (marketing pages) when this deployment was built
 * inside the window, since a deploy is when they change.
 */
export function changedUrls(entries: MetadataRoute.Sitemap, builtAt: string | undefined, now = Date.now()) {
  const built = builtAt ? Date.parse(builtAt) : Number.NaN;
  const freshDeploy = Number.isFinite(built) && now - built < WINDOW_MS;
  const urls = entries.filter((entry) => {
    const modified = entry.lastModified ? new Date(entry.lastModified).getTime() : Number.NaN;
    return Number.isFinite(modified) ? now - modified < WINDOW_MS : freshDeploy;
  }).map((entry) => entry.url);
  return [...new Set(urls)].slice(0, MAX_URLS);
}

/** Submits the URLs in one request. Returns IndexNow's status: 200 or 202 is accepted. */
export async function submitToIndexNow(urls: string[]) {
  if (!urls.length) return 0;
  const host = new URL(SETUVARA_ORIGIN).host;
  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ host, key: INDEXNOW_KEY, keyLocation: `${SETUVARA_ORIGIN}/${INDEXNOW_KEY}.txt`, urlList: urls }),
    signal: AbortSignal.timeout(20_000),
  });
  return response.status;
}
