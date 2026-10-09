import type { DemoLink } from "./primitives";

// Illustrative identity used across the homepage. One person, three Modes,
// rendered with the same structure as the real public profile.
export const person = { name: "Aanya Rao", firstName: "Aanya", username: "aanya", initials: "AR" };

export type DemoMode = {
  slug: "personal" | "event" | "business";
  label: string;
  audience: string;
  links: DemoLink[];
};

export const demoModes: DemoMode[] = [
  {
    slug: "personal",
    label: "Personal",
    audience: "Friends, communities, the people you choose.",
    links: [
      { provider: "instagram", title: "Instagram", detail: "@aanya.rao" },
      { provider: "spotify", title: "Sunday run mix", detail: "Spotify playlist" },
      { provider: "whatsapp", title: "WhatsApp", detail: "Message me" },
    ],
  },
  {
    slug: "event",
    label: "Event",
    audience: "The version of you that belongs in this room.",
    links: [
      { provider: "linkedin", title: "LinkedIn", detail: "in/aanyarao" },
      { provider: "pitch_deck", title: "Partner deck", detail: "Lumen Labs · 2026" },
      { provider: "schedule", title: "Find me at Slush", detail: "Thursday sessions" },
    ],
  },
  {
    slug: "business",
    label: "Business",
    audience: "Work, clients, founders, hiring.",
    links: [
      { provider: "linkedin", title: "LinkedIn", detail: "in/aanyarao" },
      { provider: "cal_com", title: "Book a 20-min intro", detail: "cal.com/aanya" },
      { provider: "company_website", title: "Lumen Labs", detail: "Partnerships & pilots" },
    ],
  },
];

export type DemoConnection = {
  id: string;
  name: string;
  role: string;
  event: string;
  city: string;
  mode: "Personal" | "Event" | "Business";
  lastMet: string;
  encounters: number;
};

export const demoConnections: DemoConnection[] = [
  { id: "marco", name: "Marco Silva", role: "Head of Sales · Northlight", event: "TNW Conference", city: "Amsterdam", mode: "Business", lastMet: "Jun 2026", encounters: 3 },
  { id: "priya", name: "Priya Nair", role: "Lisbon run club", event: "Saturday long run", city: "Lisbon", mode: "Personal", lastMet: "4 Oct 2026", encounters: 6 },
  { id: "tom", name: "Tom Okafor", role: "CTO · Gridline", event: "SaaStock", city: "Dublin", mode: "Business", lastMet: "30 Sep 2026", encounters: 1 },
  { id: "noah", name: "Noah Chen", role: "Founder · Tidewater", event: "Canal dinner", city: "Amsterdam", mode: "Personal", lastMet: "12 Sep 2026", encounters: 2 },
  { id: "lena", name: "Lena Fischer", role: "Product Designer · Atelier Nord", event: "Slush", city: "Helsinki", mode: "Event", lastMet: "20 Nov 2025", encounters: 1 },
  { id: "jonas", name: "Jonas Berg", role: "Talent · Lumen Labs", event: "Slush", city: "Helsinki", mode: "Event", lastMet: "19 Nov 2025", encounters: 2 },
  { id: "sofia", name: "Sofia Marques", role: "Partner · Ondas Ventures", event: "Web Summit", city: "Lisbon", mode: "Event", lastMet: "12 Nov 2025", encounters: 1 },
];
