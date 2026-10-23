import { htmlHead, tagAttr } from "@/lib/net/safe-fetch";

/**
 * The link-in-bio checker's rules, separate from fetching so they can be tested on plain HTML.
 * Every check reads the page's own markup; nothing is scored on guesses.
 */

export type CheckStatus = "pass" | "warn" | "fail";
export type Check = { id: string; label: string; status: CheckStatus; detail: string };

export const MAX_BYTES = 600_000;

export function metaContent(head: string, key: string) {
  for (const tag of head.match(/<meta\b[^>]*>/gi) ?? []) {
    const name = (tagAttr(tag, "name") ?? tagAttr(tag, "property") ?? "").toLowerCase();
    if (name === key) return tagAttr(tag, "content") ?? "";
  }
  return null;
}

export function checkPage({ html, finalUrl, status, ms, truncated }: { html: string; finalUrl: URL; status: number; ms: number; truncated: boolean }): Check[] {
  const head = htmlHead(html);
  const title = head.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.replace(/\s+/g, " ").trim() ?? "";
  const description = metaContent(head, "description") ?? metaContent(head, "og:description");
  const image = metaContent(head, "og:image") ?? metaContent(head, "twitter:image");
  const viewport = metaContent(head, "viewport");
  const icon = (head.match(/<link\b[^>]*>/gi) ?? []).some((tag) => /\bicon\b/i.test(tagAttr(tag, "rel") ?? ""));
  const outbound = new Set<string>();
  for (const tag of html.match(/<a\b[^>]*>/gi) ?? []) {
    const href = tagAttr(tag, "href");
    if (!href) continue;
    try {
      const url = new URL(href, finalUrl);
      if ((url.protocol === "https:" || url.protocol === "http:") && url.hostname !== finalUrl.hostname) outbound.add(url.origin + url.pathname);
    } catch { /* not a link */ }
  }
  const links = outbound.size;
  const kb = Math.round(html.length / 1000);

  return [
    { id: "reachable", label: "Opens for visitors", status: status < 400 ? "pass" : "fail", detail: status < 400 ? `Answered with status ${status}.` : `Answered with status ${status}: visitors see an error.` },
    { id: "https", label: "Secure link (HTTPS)", status: finalUrl.protocol === "https:" ? "pass" : "fail", detail: finalUrl.protocol === "https:" ? "The page is served over HTTPS." : "The page isn’t on HTTPS, so browsers may warn visitors." },
    { id: "speed", label: "Fast first response", status: ms < 800 ? "pass" : ms < 2000 ? "warn" : "fail", detail: `The server answered in ${(ms / 1000).toFixed(1)} s${ms < 800 ? "." : ". Visitors on mobile data may leave before it loads."}` },
    { id: "title", label: "Page title", status: !title ? "fail" : title.length > 70 ? "warn" : "pass", detail: !title ? "No title: search results and browser tabs show the bare address." : title.length > 70 ? `“${title.slice(0, 70)}…” is long and gets cut off in search results.` : `“${title}”` },
    { id: "description", label: "Description", status: description ? "pass" : "warn", detail: description ? "Has a description for search results and link previews." : "No description: search engines and apps guess one from the page." },
    { id: "preview", label: "Preview image", status: image ? "pass" : "fail", detail: image ? "Shows an image when shared in messages and on social apps." : "No preview image: shared links show up as plain text." },
    { id: "mobile", label: "Made for phones", status: viewport && /width\s*=\s*device-width/i.test(viewport) ? "pass" : "fail", detail: viewport ? "Sets a mobile viewport." : "No mobile viewport: on phones the page may render tiny." },
    { id: "icon", label: "Site icon", status: icon ? "pass" : "warn", detail: icon ? "Has an icon for tabs and home screens." : "No icon: tabs and bookmarks show a blank square." },
    { id: "links", label: "Focused number of links", status: links === 0 ? "warn" : links <= 12 ? "pass" : "warn", detail: links === 0 ? "No outbound links found in the page’s HTML. They may load with JavaScript, which some apps can’t read." : links <= 12 ? `${links} outbound link${links === 1 ? "" : "s"}: easy to choose from.` : `${links} outbound links. Past about a dozen, visitors tap fewer of them.` },
    { id: "weight", label: "Light page", status: truncated ? "fail" : kb > 250 ? "warn" : "pass", detail: truncated ? `Over ${MAX_BYTES / 1000} KB of HTML before any images: slow on mobile data.` : `${kb} KB of HTML.` },
  ];
}

export function scoreOf(checks: Check[]) {
  const points = checks.reduce((sum, check) => sum + (check.status === "pass" ? 1 : check.status === "warn" ? 0.5 : 0), 0);
  return Math.round((points / checks.length) * 100);
}
