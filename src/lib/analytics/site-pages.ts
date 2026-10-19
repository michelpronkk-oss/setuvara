/** Public site pages counted in admin traffic. Keys match private.site_page_views.page. */
export const SITE_PAGES = {
  home: "Homepage",
  pricing: "Pricing",
  modes: "Modes",
  events: "Events",
  teams: "Teams",
  contact: "Contact",
  roadmap: "Roadmap",
  privacy: "Privacy",
  terms: "Terms",
  cookies: "Cookies",
  refunds: "Refunds",
  login: "Log in",
  signup: "Sign up",
  profile: "Public profiles",
} as const;

export type SitePage = keyof typeof SITE_PAGES;

/** Profile views are counted server-side with the profile view itself, so only fixed site paths map here. */
export function sitePageForPath(pathname: string): SitePage | null {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (path === "/") return "home";
  const key = path.slice(1);
  return key !== "profile" && Object.hasOwn(SITE_PAGES, key) ? key as SitePage : null;
}
