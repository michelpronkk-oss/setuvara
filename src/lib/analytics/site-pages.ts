/**
 * Public site pages counted in admin traffic, grouped into sections. A visit stores the page's
 * path only when it is one of these public marketing paths; member pages are never stored by
 * path. Keys are shared with private.site_visits.section and the older private.site_page_views.page.
 */
export const SITE_PAGES = {
  home: "Homepage",
  pricing: "Pricing",
  modes: "Modes",
  personal: "Personal Mode",
  event: "Event Mode",
  business: "Business Mode",
  creator: "Creator Mode",
  features: "Features",
  compare: "Comparisons",
  use_cases: "Use cases",
  templates: "Templates",
  tools: "Free tools",
  blog: "Blog",
  gallery: "Gallery",
  guide: "What is Setuvara",
  help: "Help centre",
  product: "Product tour",
  teams: "Teams",
  roadmap: "Roadmap",
  contact: "Contact",
  legal: "Legal",
  privacy: "Privacy",
  terms: "Terms",
  cookies: "Cookies",
  refunds: "Refunds",
  events: "Events (old page)",
  login: "Log in",
  signup: "Sign up",
  profile: "Public profiles",
} as const;

export type SitePage = keyof typeof SITE_PAGES;

/** Top-level public paths and the section each belongs to. Everything else is a member page or the app. */
const SECTION_BY_SEGMENT: Record<string, SitePage> = {
  pricing: "pricing", modes: "modes", personal: "personal", event: "event", business: "business", creator: "creator",
  features: "features", compare: "compare", "use-cases": "use_cases", templates: "templates", tools: "tools", blog: "blog",
  gallery: "gallery", "what-is-setuvara": "guide", help: "help", product: "product", teams: "teams", roadmap: "roadmap",
  contact: "contact", privacy: "legal", terms: "legal", cookies: "legal", refunds: "legal", "data-deletion": "legal",
  login: "login", signup: "signup",
};

/** The section of a public site path, or null for member pages, the app and anything unknown. */
export function sectionForPath(pathname: string): SitePage | null {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (path === "/") return "home";
  if (!/^\/[a-z0-9/-]{1,120}$/.test(path)) return null;
  return SECTION_BY_SEGMENT[path.split("/")[1]] ?? null;
}

/** Kept for the older page-view call sites: fixed site paths only. */
export function sitePageForPath(pathname: string): SitePage | null {
  return sectionForPath(pathname);
}

/** Referrer hosts and the class stored for them (never the URL). Order matters: first match wins. */
const REFERRERS: [RegExp, string][] = [
  [/(^|\.)chatgpt\.com$|(^|\.)openai\.com$/, "chatgpt"],
  [/(^|\.)perplexity\.ai$/, "perplexity"],
  [/(^|\.)copilot\.microsoft\.com$|(^|\.)bing\.com\/chat/, "copilot"],
  [/(^|\.)gemini\.google\.com$|(^|\.)bard\.google\.com$/, "gemini"],
  [/(^|\.)claude\.ai$/, "claude"],
  [/(^|\.)you\.com$/, "you"],
  [/(^|\.)phind\.com$/, "phind"],
  [/(^|\.)chat\.mistral\.ai$/, "mistral"],
  [/(^|\.)meta\.ai$/, "meta_ai"],
  [/(^|\.)chat\.deepseek\.com$/, "deepseek"],
  [/(^|\.)grok\.com$/, "grok"],
  [/(^|\.)google\.[a-z.]+$/, "google"],
  [/(^|\.)bing\.com$/, "bing"],
  [/(^|\.)duckduckgo\.com$/, "duckduckgo"],
  [/(^|\.)search\.yahoo\.com$|(^|\.)yahoo\.com$/, "yahoo"],
  [/(^|\.)ecosia\.org$/, "ecosia"],
  [/(^|\.)yandex\.[a-z.]+$/, "yandex"],
  [/(^|\.)baidu\.com$/, "baidu"],
  [/(^|\.)search\.brave\.com$/, "brave"],
  [/(^|\.)naver\.com$/, "naver"],
  [/(^|\.)startpage\.com$/, "startpage"],
  [/(^|\.)qwant\.com$/, "qwant"],
  [/(^|\.)(x|twitter)\.com$|^t\.co$/, "x"],
  [/(^|\.)linkedin\.com$|^lnkd\.in$/, "linkedin"],
  [/(^|\.)instagram\.com$/, "instagram"],
  [/(^|\.)facebook\.com$|^fb\.me$|^l\.facebook\.com$/, "facebook"],
  [/(^|\.)tiktok\.com$/, "tiktok"],
  [/(^|\.)youtube\.com$|^youtu\.be$/, "youtube"],
  [/(^|\.)reddit\.com$/, "reddit"],
  [/(^|\.)threads\.net$/, "threads"],
  [/(^|\.)whatsapp\.com$|^wa\.me$/, "whatsapp"],
  [/(^|\.)t\.me$|(^|\.)telegram\.org$/, "telegram"],
  [/(^|\.)producthunt\.com$/, "producthunt"],
  [/^news\.ycombinator\.com$/, "hackernews"],
  [/(^|\.)bsky\.app$/, "bluesky"],
  [/(^|\.)pinterest\.[a-z.]+$/, "pinterest"],
];

/** utm_source values AI answer engines add to the links they cite. */
const UTM_SOURCES: Record<string, string> = {
  "chatgpt.com": "chatgpt", chatgpt: "chatgpt", openai: "chatgpt", "perplexity.ai": "perplexity", perplexity: "perplexity",
  copilot: "copilot", "copilot.com": "copilot", gemini: "gemini", claude: "claude", "claude.ai": "claude",
};

/**
 * A visit's referrer class from the referring URL and utm_source. Same-site referrers are
 * "internal", none is "direct", an unknown site is "other". Only the class is ever stored.
 */
export function classifyReferrer(referrer: string | null | undefined, utmSource: string | null | undefined, ownHost = "setuvara.com") {
  const utm = utmSource?.trim().toLowerCase();
  if (utm && UTM_SOURCES[utm]) return UTM_SOURCES[utm];
  if (!referrer) return "direct";
  let host: string;
  try { host = new URL(referrer).hostname.toLowerCase().replace(/^www\./, ""); } catch { return "other"; }
  if (!host) return "direct";
  if (host === ownHost || host.endsWith(`.${ownHost}`) || host === "localhost") return "internal";
  return REFERRERS.find(([pattern]) => pattern.test(host))?.[1] ?? "other";
}
