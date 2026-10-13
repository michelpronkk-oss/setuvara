import { modeShareTokenPattern } from "@/lib/share/mode-share-pattern";
import { isReservedUsername, usernamePattern } from "@/lib/usernames";

/**
 * Turns the text of a scanned QR into a same-origin path, or null when it is
 * not a Setuvara identity. It only recognises the URLs Setuvara already puts
 * in QR codes and Tap chips, so the scanner opens them through the existing
 * resolvers instead of a second share system:
 *
 *   /<username>        Personal Mode (canonical profile URL)
 *   /s/<id>            Event and Business share links
 *   /q/<token>         Quick QR
 *   /t/<token>         Setuvara Tap (NFC chips also carry this URL)
 *   /connect/<token>   Connection Pass
 *   /u/<username>      legacy profile links
 *
 * Only setuvara.com and the app's own origin are accepted, never another site.
 */

const productionHosts = new Set(["setuvara.com", "www.setuvara.com"]);
const longTokenPattern = /^[A-Za-z0-9_-]{43}$/;
const sourcePattern = /^[a-z_]{1,32}$/;

export type ScanTarget = { path: string; kind: "profile" | "mode_share" | "quick_qr" | "tap" | "connect" };

export function scanTarget(raw: string, appOrigin?: string): ScanTarget | null {
  const text = raw.trim();
  if (!text || text.length > 512) return null;
  let url: URL;
  try {
    // Bare "setuvara.com/name" QR text is common in printed material.
    url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
  } catch { return null; }
  const isProduction = url.protocol === "https:" && productionHosts.has(url.hostname.toLowerCase()) && !url.port;
  const isApp = Boolean(appOrigin) && url.origin === appOrigin;
  if (!isProduction && !isApp) return null;
  if (url.username || url.password) return null;

  const parts = url.pathname.replace(/\/+$/, "").split("/").slice(1);
  const source = url.searchParams.get("source");
  const withSource = (path: string) => (source && sourcePattern.test(source) ? `${path}?source=${source}` : path);

  if (parts.length === 1) {
    const username = safeDecode(parts[0])?.toLowerCase();
    if (!username || !usernamePattern.test(username) || isReservedUsername(username)) return null;
    return { path: withSource(`/${username}`), kind: "profile" };
  }
  if (parts.length !== 2) return null;
  const [route, value] = parts;
  if (route === "s" && modeShareTokenPattern.test(value)) return { path: withSource(`/s/${value}`), kind: "mode_share" };
  if (route === "q" && longTokenPattern.test(value)) return { path: `/q/${value}`, kind: "quick_qr" };
  if (route === "t" && longTokenPattern.test(value)) return { path: `/t/${value}`, kind: "tap" };
  if (route === "connect" && longTokenPattern.test(value)) return { path: `/connect/${value}`, kind: "connect" };
  if (route === "u") {
    const username = safeDecode(value)?.toLowerCase();
    if (username && usernamePattern.test(username) && !isReservedUsername(username)) return { path: `/${username}`, kind: "profile" };
  }
  return null;
}

function safeDecode(value: string) {
  try { return decodeURIComponent(value); } catch { return null; }
}
