import { PUBLIC_PLAN_CATALOG, type PlanCode } from "@/lib/billing/catalog";

/**
 * Setuvara's public facts, in one place. The site, the FAQ answers, /llms.txt and the "What is
 * Setuvara" page all read from here, so the same one-liner, prices and limits appear everywhere
 * (search and AI tools trust facts that agree). Prices come from the billing catalog; limits
 * mirror the database's plan tables (private.*_plan_limits), named beside each value.
 */

export const ONE_LINER = "Setuvara is a digital identity you share by link, QR code or tap: one account with a page for each part of your life (Personal, Event, Business and Creator), that remembers everyone you meet.";
export const SHORT_LINER = "One identity. Every version of you.";
export const CATEGORY_LINE = "A link in bio, digital business card and event networking app in one.";

const plan = (code: PlanCode) => PUBLIC_PLAN_CATALOG.find((item) => item.code === code)!;
const usd = (minor: number) => `$${(minor / 100).toFixed(minor % 100 ? 2 : 0)}`;

export const PRICES = {
  plus: { monthly: usd(plan("plus").monthlyPriceMinor), yearly: usd(plan("plus").yearlyPriceMinor) },
  pro: { monthly: usd(plan("pro").monthlyPriceMinor), yearly: usd(plan("pro").yearlyPriceMinor) },
} as const;

/** The same prices as numbers, for structured data (Offer.price). */
export const PRICE_NUMBERS = {
  plus: { monthly: plan("plus").monthlyPriceMinor / 100, yearly: plan("plus").yearlyPriceMinor / 100 },
  pro: { monthly: plan("pro").monthlyPriceMinor / 100, yearly: plan("pro").yearlyPriceMinor / 100 },
} as const;

export const PRICE_LINE = `Free to start. Plus is ${PRICES.plus.monthly} a month or ${PRICES.plus.yearly} a year; Pro is ${PRICES.pro.monthly} a month or ${PRICES.pro.yearly} a year. Prices in USD.`;

export const MODES = [
  { slug: "personal", name: "Personal", line: "For friends and the people you choose: bio, city, music and links." },
  { slug: "event", name: "Event", line: "For conferences and meetups: the event, your role and who you're here to meet." },
  { slug: "business", name: "Business", line: "A digital business card with bookings, Leads, Testimonials, Builder and a Team." },
  { slug: "creator", name: "Creator", line: "Work first, with a store, a media kit, brand Deals and an Audience." },
] as const;

export const LOOKS = {
  total: 10,
  free: ["Immersive", "Clean"],
  all: ["Immersive", "Motion", "Aura", "Clean", "Glow", "Scene", "Frame", "Stack", "Social", "Film"],
} as const;

type Row = { label: string; free: string; plus: string; pro: string };

/** Per-plan limits. Each group cites the database table or code it mirrors. */
export const PLAN_LIMITS: { group: string; source: string; rows: Row[] }[] = [
  {
    group: "Your page",
    source: "components/profile/appearance.ts, name-type.ts",
    rows: [
      { label: "Modes (Personal, Event, Business, Creator)", free: "All four", plus: "All four", pro: "All four" },
      { label: "Looks", free: "2 (Immersive, Clean)", plus: "All 10", pro: "All 10" },
      { label: "Name styles", free: "2", plus: "6", pro: "6" },
      { label: "Photo slideshow", free: "—", plus: "2 photos", pro: "4 photos" },
      { label: "Content blocks (Text, Section, FAQ, Location, Countdown and more)", free: "Yes", plus: "Yes", pro: "Yes" },
      { label: "Card styles", free: "Solid", plus: "Solid, Glass, Outline", pro: "Solid, Glass, Outline" },
      { label: "Text fonts", free: "Sans", plus: "Sans, Serif, Mono", pro: "Sans, Serif, Mono" },
      { label: "Embeds (Calendly, Cal.com, Typeform, Tally, Google Forms, Substack)", free: "—", plus: "Yes", pro: "Yes" },
      { label: "QR styles", free: "Standard", plus: "All 5", pro: "All 5" },
      { label: "“Made with Setuvara”", free: "Shown", plus: "Removed", pro: "Removed" },
      { label: "Member badge", free: "—", plus: "Plus", pro: "Pro" },
    ],
  },
  {
    group: "Actions",
    source: "private.action_plan_limits",
    rows: [
      { label: "Live Actions (across all Modes)", free: "2", plus: "8", pro: "24" },
      { label: "Open giveaways", free: "—", plus: "1", pro: "5" },
      { label: "Questions per Action", free: "3", plus: "6", pro: "12" },
      { label: "Thank-you reward (link or code)", free: "—", plus: "Yes", pro: "Yes" },
      { label: "Responses CSV export", free: "—", plus: "Yes", pro: "Yes" },
      { label: "Action insights", free: "7 days", plus: "90 days", pro: "365 days" },
    ],
  },
  {
    group: "Audience",
    source: "private.audience_plan_limits",
    rows: [
      { label: "Collect subscribers", free: "Yes", plus: "Yes", pro: "Yes" },
      { label: "Emails to your list per month", free: "—", plus: "2,500", pro: "20,000" },
    ],
  },
  {
    group: "Business",
    source: "private.business_plan_limits",
    rows: [
      { label: "Leads with stages and funnel", free: "Yes", plus: "Yes", pro: "Yes" },
      { label: "Lead notes and CSV export", free: "—", plus: "Yes", pro: "Yes" },
      { label: "Funnel window", free: "7 days", plus: "90 days", pro: "365 days" },
      { label: "Bookings ahead", free: "14 days", plus: "60 days", pro: "120 days" },
      { label: "Testimonials shown", free: "3", plus: "24", pro: "60" },
      { label: "Team seats", free: "—", plus: "—", pro: "5" },
    ],
  },
  {
    group: "Builder",
    source: "private.builder_plan_limits, verified revenue limits",
    rows: [
      { label: "Public projects", free: "1", plus: "5", pro: "20" },
      { label: "Roadmap items per project", free: "15", plus: "60", pro: "200" },
      { label: "Voting", free: "Yes", plus: "Yes", pro: "Yes" },
      { label: "Feature suggestions", free: "—", plus: "Yes", pro: "Yes" },
      { label: "Verified revenue providers", free: "—", plus: "1", pro: "3" },
      { label: "Revenue history", free: "—", plus: "365 days", pro: "3 years" },
    ],
  },
  {
    group: "Creator store",
    source: "creator_fee_policies (commerce_pricing_reconcile)",
    rows: [
      { label: "Sell digital products and services", free: "Yes", plus: "Yes", pro: "Yes" },
      { label: "Setuvara fee on sales", free: "5%", plus: "0%", pro: "0%" },
    ],
  },
  {
    group: "Analytics",
    source: "lib/billing/capabilities.ts (analytics.*)",
    rows: [
      { label: "History", free: "7 days", plus: "30 and 90 days", pro: "Any range, up to 2 years" },
      { label: "Source and Mode breakdowns", free: "—", plus: "Yes", pro: "Yes" },
      { label: "View-to-connection conversion", free: "—", plus: "Yes", pro: "Yes" },
      { label: "Period comparison, loop per Mode, funnel", free: "—", plus: "—", pro: "Yes" },
      { label: "Device and Tap insights, CSV export", free: "—", plus: "—", pro: "Yes" },
    ],
  },
];

/** Shipped on every plan with no limit worth a row. */
export const EVERY_PLAN = [
  "Public page for each Mode, with links, pictures, video and music",
  "Profile soundtrack",
  "Share by link, QR code, Quick QR and Setuvara Tap (NFC)",
  "Connect without an account, and Connections with where and when you met",
  "Private notes on every connection",
  "Passport stamps and milestones",
  "Events with RSVPs, a guest list and a door scanner",
] as const;

/** Designed, not shipped. Named plainly wherever it appears. */
/** What Setuvara is not, said plainly so nobody (or no model) files it under the wrong thing. */
export const NOT_THIS = [
  "Not only a link in bio: each Mode is a full page, and Setuvara remembers who you meet.",
  "Not a social network: there is no feed and no public friend list.",
  "Not a CRM: Leads and Connections cover meeting people and following up, not a sales pipeline for a large team.",
  "Not an ID check: the member badge means a Plus or Pro plan, not a verified identity.",
] as const;

export const COMING = ["Your own domain (Pro)", "Webhooks and integrations (Pro)", "Apple and Google Wallet pass"] as const;
