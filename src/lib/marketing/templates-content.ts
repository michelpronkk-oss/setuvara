import { APPEARANCE_LINES, APPEARANCE_NAMES, FREE_APPEARANCES } from "@/components/profile/appearance";
import type { AppearanceId } from "@/components/profile/types";

import { DEMO_PEOPLE } from "@/components/marketing/home/mode-phone";
import { MODE_ORDER, MODE_PAGES } from "./modes-content";

/**
 * Templates at /templates/<slug>: one per Look (its id) and one per Mode (<mode>-mode). A Look
 * template opens sign-up with ?appearance=, which is only a hint: Plus Looks still need Plus.
 */

type ModeSlug = (typeof MODE_ORDER)[number];
type Person = (typeof DEMO_PEOPLE)[keyof typeof DEMO_PEOPLE];

export type LookTemplate = {
  kind: "look";
  slug: AppearanceId;
  name: string;
  line: string;
  free: boolean;
  mode: ModeSlug;
  who: Person;
  bestFor: string;
  details: string[];
  /** Content pictures the Look draws with (Scene's backdrop, Stack's prints). */
  pictures?: string[];
};

export type ModeTemplate = { kind: "mode"; slug: `${ModeSlug}-mode`; name: string; line: string; mode: ModeSlug; look: AppearanceId };

const LOOK_DETAILS: Record<AppearanceId, { mode: ModeSlug; who: Person; bestFor: string; details: string[]; pictures?: string[] }> = {
  immersive: { mode: "personal", who: DEMO_PEOPLE.aanya, bestFor: "A strong portrait. Friends, communities, anyone who wants to be seen first.", details: ["Full-bleed photo with face-safe name placement", "Name over the photo, platforms underneath", "Free"] },
  motion: { mode: "event", who: DEMO_PEOPLE.theo, bestFor: "Events and launches, when you want the page to feel alive.", details: ["Kinetic name with a drifting portrait", "Holds still for visitors who prefer less motion", "Plus and Pro"] },
  aura: { mode: "personal", who: DEMO_PEOPLE.aanya, bestFor: "A softer, calmer page built from the colours of your own photo.", details: ["A soft colour halo around a round portrait", "Calm and centred", "Plus and Pro"] },
  clean: { mode: "business", who: DEMO_PEOPLE.lucasClose, bestFor: "Work pages that need to read fast and look polished.", details: ["Light, warm and quiet", "Clear buttons for booking and contact", "Free"] },
  glow: { mode: "business", who: DEMO_PEOPLE.lucasClose, bestFor: "Founders and consultants: dark, confident, one accent.", details: ["Dark page with a restrained accent glow", "Arched portrait", "Plus and Pro"] },
  scene: { mode: "personal", who: DEMO_PEOPLE.noor, pictures: ["/pricing/noor-wide.webp"], bestFor: "When the place matters: you, inside your own world.", details: ["One of your pictures becomes the backdrop", "Your portrait set into it, like a postcard", "Plus and Pro"] },
  frame: { mode: "creator", who: DEMO_PEOPLE.sena, bestFor: "Artists and photographers: a gallery print on a matte.", details: ["Your portrait mounted like a print", "A quiet, gallery feel", "Plus and Pro"] },
  stack: { mode: "personal", who: DEMO_PEOPLE.aanya, pictures: ["/pricing/aanya-wide.webp"], bestFor: "Show your portrait and your work at once, fanned like prints.", details: ["Portrait and pictures in a fanned stack", "Great with a slideshow", "Plus and Pro"] },
  social: { mode: "creator", who: DEMO_PEOPLE.sena, bestFor: "Creators whose platforms are the point.", details: ["Your platforms up front", "Made for bios and fans", "Plus and Pro"] },
  film: { mode: "creator", who: DEMO_PEOPLE.sena, bestFor: "Music, film and video: cinematic, like a still from your own film.", details: ["Letterboxed, warm-graded portrait", "The first line of your bio as a subtitle", "Plus and Pro"] },
};

export const LOOK_TEMPLATES: LookTemplate[] = (Object.keys(APPEARANCE_NAMES) as AppearanceId[]).map((id) => ({
  kind: "look",
  slug: id,
  name: APPEARANCE_NAMES[id],
  line: APPEARANCE_LINES[id],
  free: FREE_APPEARANCES.includes(id),
  ...LOOK_DETAILS[id],
}));

const MODE_LOOK: Record<ModeSlug, AppearanceId> = { personal: "stack", event: "immersive", business: "glow", creator: "film" };

export const MODE_TEMPLATES: ModeTemplate[] = MODE_ORDER.map((mode) => ({
  kind: "mode",
  slug: `${mode}-mode`,
  name: `${MODE_PAGES[mode].name} Mode`,
  line: MODE_PAGES[mode].title,
  mode,
  look: MODE_LOOK[mode],
}));

export const TEMPLATE_SLUGS = [...LOOK_TEMPLATES.map((t) => t.slug), ...MODE_TEMPLATES.map((t) => t.slug)];

export function findTemplate(slug: string): LookTemplate | ModeTemplate | null {
  return LOOK_TEMPLATES.find((t) => t.slug === slug) ?? MODE_TEMPLATES.find((t) => t.slug === slug) ?? null;
}
