import type { ReactNode } from "react";

import type { Section } from "@/app/app/identity/editor-types";

// 24px line icons, 1.8 stroke, matching the app sidebar.
const ICONS: Record<Section, ReactNode> = {
  home: <><rect height="7" rx="1.8" width="7" x="3.5" y="3.5" /><rect height="7" rx="1.8" width="7" x="13.5" y="3.5" /><rect height="7" rx="1.8" width="7" x="3.5" y="13.5" /><rect height="7" rx="1.8" width="7" x="13.5" y="13.5" /></>,
  profile: <><circle cx="12" cy="8.5" r="3.6" /><path d="M5 20c.8-3.6 3.6-5.6 7-5.6s6.2 2 7 5.6" /></>,
  links: <><rect height="6" rx="1.8" width="16" x="4" y="4" /><rect height="6" rx="1.8" width="16" x="4" y="14" /></>,
  appearance: <><path d="M12 3.5a8.5 8.5 0 0 0 0 17c1 0 1.6-.7 1.6-1.6 0-.5-.2-.9-.5-1.2a1.6 1.6 0 0 1 1.2-2.7h1.9a4.3 4.3 0 0 0 4.3-4.3c0-4-3.8-7.2-8.5-7.2Z" /><circle cx="7.6" cy="11.6" fill="currentColor" r=".9" stroke="none" /><circle cx="10.4" cy="7.6" fill="currentColor" r=".9" stroke="none" /><circle cx="14.6" cy="7.6" fill="currentColor" r=".9" stroke="none" /></>,
  settings: <path d="M4 7h9M17 7h3M4 17h3M11 17h9M15 4.5v5M9 14.5v5" />,
  share: <><rect height="6" rx="1.2" width="6" x="4" y="4" /><rect height="6" rx="1.2" width="6" x="14" y="4" /><rect height="6" rx="1.2" width="6" x="4" y="14" /><path d="M14 14h2.5v2.5M20 14v.01M14 20h.01M17.5 17.5H20V20h-2.5" /></>,
};

export function SectionIcon({ name }: { name: Section }) {
  return <svg aria-hidden="true" className="size-[21px]" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24">{ICONS[name]}</svg>;
}

/** The Creator studio pages, listed under the editor sections whenever Creator Mode is open. */
export const STUDIO_PAGES = [
  { id: "work", title: "Work", href: "/app/identity/creator/work" },
  { id: "commerce", title: "Commerce", href: "/app/identity/creator/commerce" },
  { id: "actions", title: "Actions", href: "/app/identity/creator/actions" },
  { id: "collabs", title: "Deals", href: "/app/identity/creator/collabs" },
  { id: "builder", title: "Builder", href: "/app/identity/creator/builder" },
  { id: "audience", title: "Audience", href: "/app/identity/creator/audience" },
  { id: "kit", title: "Media kit", href: "/app/identity/creator/kit" },
  { id: "insights", title: "Insights", href: "/app/identity/creator/insights" },
  { id: "settings", title: "Studio settings", href: "/app/identity/creator/settings" },
] as const;
export type StudioPageId = (typeof STUDIO_PAGES)[number]["id"];

const STUDIO_ICONS: Record<StudioPageId, ReactNode> = {
  work: <><rect height="15" rx="2.2" width="17" x="3.5" y="4.5" /><path d="m3.5 16 4.6-4.4a1.6 1.6 0 0 1 2.2 0L15 16M13.5 14.5l1.6-1.5a1.6 1.6 0 0 1 2.2 0l3.2 3" /><circle cx="15.5" cy="9" r="1.4" /></>,
  commerce: <><path d="M5 8h14l-1.1 10.4a1.8 1.8 0 0 1-1.8 1.6H7.9a1.8 1.8 0 0 1-1.8-1.6L5 8Z" /><path d="M9 10V7a3 3 0 0 1 6 0v3" /></>,
  actions: <path d="M13.2 3.5 5.5 13.4h6l-.7 7.1 7.7-9.9h-6l.7-7.1Z" />,
  collabs: <><path d="M3.5 11.5 8 7l3 2 3-2.5 6.5 5" /><path d="m7 13.5 3.2 3.2a1.6 1.6 0 0 0 2.3 0l4-4M11 16l1.5 1.5" /></>,
  audience: <><circle cx="9" cy="8.5" r="3.2" /><path d="M3.5 19.5a5.5 5.5 0 0 1 11 0M15.5 5.6a3.2 3.2 0 0 1 0 5.8M17.5 14.6a5.5 5.5 0 0 1 3 4.9" /></>,
  kit: <><path d="M7 3.5h7l4 4v11.2a1.8 1.8 0 0 1-1.8 1.8H7a1.8 1.8 0 0 1-1.8-1.8V5.3A1.8 1.8 0 0 1 7 3.5Z" /><path d="M13.5 3.5v4.3h4.3M8.5 12.5h7M8.5 16h4.5" /></>,
  insights: <path d="M4.5 19.5h15M7 16v-4M11.5 16V7.5M16 16v-6.5" />,
  builder: <><path d="M4.5 19.5h15M6.5 19.5V9.5l5.5-5 5.5 5v10" /><path d="M10 19.5v-5h4v5" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M12 3.5v2.2M12 18.3v2.2M20.5 12h-2.2M5.7 12H3.5M18 6l-1.6 1.6M7.6 16.4 6 18M18 18l-1.6-1.6M7.6 7.6 6 6" /></>,
};

/** Creator studio's own mark: a four-point spark. */
export function StudioMark() {
  return <svg aria-hidden="true" className="size-[21px]" fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M12 3.5c.6 4.4 2.7 6.6 7.5 8.5-4.8 1.9-6.9 4.1-7.5 8.5-.6-4.4-2.7-6.6-7.5-8.5 4.8-1.9 6.9-4.1 7.5-8.5Z" /></svg>;
}

/** Event Mode's own page: its events. */
export function EventsIcon() {
  return <svg aria-hidden="true" className="size-[21px]" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24"><rect height="15.5" rx="2.4" width="17" x="3.5" y="5" /><path d="M3.5 10h17M8 3.5v3M16 3.5v3M8 14h3" /></svg>;
}

/** Business Mode's own page: its leads. */
export function LeadsIcon() {
  return <svg aria-hidden="true" className="size-[21px]" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M4 5.5h16l-6 7.2v5.8l-4 1.9v-7.7L4 5.5Z" /></svg>;
}

/** Business Mode's team: two people. */
export function TeamIcon() {
  return <svg aria-hidden="true" className="size-[21px]" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24"><circle cx="9" cy="8.5" r="3.2" /><path d="M3.5 19c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5" /><path d="M15.5 5.6a3.1 3.1 0 0 1 0 5.8M17.6 14.4c1.6.7 2.6 2.3 2.9 4.6" /></svg>;
}

/** Business Mode's testimonials: a quote. */
export function TestimonialsIcon() {
  return <svg aria-hidden="true" className="size-[21px]" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M5 18.5V12c0-3.6 1.8-5.9 5-6.5M14 18.5V12c0-3.6 1.8-5.9 5-6.5" /><path d="M5 12.5h4.5v6H5zM14 12.5h4.5v6H14z" /></svg>;
}

export function StudioIcon({ name }: { name: StudioPageId }) {
  return <svg aria-hidden="true" className="size-[21px]" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24">{STUDIO_ICONS[name]}</svg>;
}


// 24px line icons, 1.8 stroke, round joins. The current destination lights its icon coral.
export type GlobalIconName = "home" | "identity" | "wallet" | "analytics" | "people" | "passport" | "settings";
const navIcons: Record<GlobalIconName, ReactNode> = {
  home: <path d="M4 10.4 12 4l8 6.4V19a1 1 0 0 1-1 1h-4.25v-5.25h-5.5V20H5a1 1 0 0 1-1-1v-8.6Z" />,
  identity: <><rect height="14" rx="2.75" width="18" x="3" y="5" /><circle cx="9" cy="10.6" r="2.2" /><path d="M5.9 16.2c.6-1.5 1.75-2.3 3.1-2.3s2.5.8 3.1 2.3M14.6 10h4M14.6 13.4h2.8" /></>,
  wallet: <><path d="M4 7.6A2.6 2.6 0 0 1 6.6 5H17v3" /><path d="M4 7.6V17a2 2 0 0 0 2 2h13a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1H6.6A2.6 2.6 0 0 1 4 7.6Z" /><circle cx="16.3" cy="13.5" fill="currentColor" r="1.1" stroke="none" /></>,
  analytics: <path d="M5 20v-5.5M10 20V9M15 20v-7.5M20 20V4.5" />,
  people: <><circle cx="9" cy="8.4" r="3.2" /><path d="M3.4 19.4c.7-3.1 2.9-4.9 5.6-4.9s4.9 1.8 5.6 4.9" /><path d="M15.4 5.4a3 3 0 0 1 0 5.9M17.2 14.6c1.8.5 3 2 3.4 4.4" /></>,
  passport: <><rect height="18" rx="2.5" width="14" x="5" y="3" /><circle cx="12" cy="10" r="3" /><path d="M9.5 16.6h5" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 13.5a7.6 7.6 0 0 0 0-3l2-1.6-2-3.4-2.4 1a7.7 7.7 0 0 0-2.6-1.5L14 2.5h-4l-.4 2.5A7.7 7.7 0 0 0 7 6.5l-2.4-1-2 3.4 2 1.6a7.6 7.6 0 0 0 0 3l-2 1.6 2 3.4 2.4-1a7.7 7.7 0 0 0 2.6 1.5l.4 2.5h4l.4-2.5a7.7 7.7 0 0 0 2.6-1.5l2.4 1 2-3.4-2-1.6Z" /></>,
};

export function NavIcon({ name, className = "size-[21px]" }: { name: GlobalIconName; className?: string }) {
  return <svg aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24">{navIcons[name]}</svg>;
}

