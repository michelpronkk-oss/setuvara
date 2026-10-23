import { LOOKS, PRICES } from "./facts";

/**
 * Comparison pages at /compare/<slug>. Setuvara's side cites facts.ts and the plan catalog. The
 * other side describes only what each product is built to do, never its prices or fees: those
 * change often, so every page sends readers to the other product's own pricing page instead.
 */

export type CompareRow = { topic: string; setuvara: string; them: string };
export type ComparePage = {
  slug: string;
  name: string;
  pricingUrl: string;
  metaTitle: string;
  metaDescription: string;
  title: string;
  lede: string;
  /** The intro on phones: one short line. */
  ledeShort?: string;
  summary: { setuvara: string; them: string };
  rows: CompareRow[];
  pickSetuvara: string[];
  pickThem: string[];
  faq: { q: string; a: string }[];
  related: { href: string; label: string; line: string }[];
};

const PLUS = `Plus is ${PRICES.plus.monthly} a month or ${PRICES.plus.yearly} a year`;
const PRO = `Pro is ${PRICES.pro.monthly} a month or ${PRICES.pro.yearly} a year`;

export const COMPARE_PAGES: Record<string, ComparePage> = {
  linktree: {
    slug: "linktree",
    name: "Linktree",
    pricingUrl: "https://linktr.ee/s/pricing",
    metaTitle: "Setuvara vs Linktree: a link in bio that meets people | Setuvara",
    metaDescription: "Linktree is a list of links. Setuvara gives you four pages from one account, shared by link, QR or NFC tap, and remembers everyone you meet. Compare them side by side.",
    title: "Setuvara vs Linktree",
    lede: "Linktree is the classic link in bio: one page, a list of links. Setuvara is built for meeting people too: a page for each part of your life, shared in person by QR or tap, and a record of who you met.",
    ledeShort: "A link in bio, plus a page for meeting people.",
    summary: {
      setuvara: "One account with four Modes (Personal, Event, Business, Creator), each with its own page, look, link and QR. Visitors connect in one tap, and you keep where and when you met.",
      them: "One public page of links per account, made for a social media bio. Strong on link management, integrations and its large ecosystem.",
    },
    rows: [
      { topic: "Pages per account", setuvara: "Four Modes, each with its own page, look and link", them: "One link page per account" },
      { topic: "Made for", setuvara: "Your bio and in-person sharing: QR, Quick QR, NFC Tap", them: "Social media bios" },
      { topic: "Who you met", setuvara: "Connections with where and when you met, plus private notes", them: "Not a contact or networking tool" },
      { topic: "Design", setuvara: `${LOOKS.total} Looks, each with its own desktop layout; ${LOOKS.free.join(" and ")} on Free`, them: "Themes and custom styling" },
      { topic: "Selling", setuvara: "Store in Creator Mode: 5% Setuvara fee on Free, 0% on Plus and Pro", them: "Selling tools; fees depend on plan" },
      { topic: "Work tools", setuvara: "Actions, Leads, Builder with verified revenue, Events", them: "Link-focused, with add-on apps" },
      { topic: "Price", setuvara: `Free to start. ${PLUS}; ${PRO}.`, them: "Free plan and paid tiers: see Linktree’s pricing page" },
    ],
    pickSetuvara: ["You meet people in person and want them to land on the right version of you", "You want a record of who you met, where and when", "You need a work page with bookings, leads or a project roadmap next to your personal one"],
    pickThem: ["You only need a list of links in your Instagram or TikTok bio", "You rely on a specific Linktree integration", "Your audience already knows your Linktree URL and you don’t want to move"],
    faq: [
      { q: "Is Setuvara a Linktree alternative?", a: "Yes. Setuvara does what a link in bio does, with links to 60 providers or your own, and adds what Linktree doesn’t: four Modes from one account, sharing by QR and NFC tap, and Connections that remember where you met." },
      { q: "Can I use Setuvara as my Instagram link in bio?", a: "Yes. Put setuvara.com/yourname in your bio. It opens your Personal Mode, or whichever Mode you choose to share." },
      { q: "Can I move my links from Linktree?", a: "Add them in Setuvara in a few minutes: paste each link and Setuvara recognises the provider and its icon." },
      { q: "Is Setuvara free?", a: `Yes. Free includes all four Modes, sharing, Actions, Leads, Builder and Connections. ${PLUS}; ${PRO}.` },
    ],
    related: [
      { href: "/use-cases/link-in-bio-for-creators", label: "Link in bio for creators", line: "Work first, with a store and a media kit." },
      { href: "/personal", label: "Personal Mode", line: "Your bio, city, music and links." },
      { href: "/compare/beacons", label: "Setuvara vs Beacons", line: "Another creator link in bio, compared." },
    ],
  },
  beacons: {
    slug: "beacons",
    name: "Beacons",
    pricingUrl: "https://beacons.ai/i/plans",
    metaTitle: "Setuvara vs Beacons: creator pages compared | Setuvara",
    metaDescription: "Beacons is a creator link in bio with a store and media kit. Setuvara adds Personal, Event and Business Modes, in-person sharing by QR and tap, and 0% fees on Plus.",
    title: "Setuvara vs Beacons",
    lede: "Beacons is an all-in-one link in bio for creators, with a store, a media kit and email. Setuvara’s Creator Mode covers that ground, and the same account has pages for your personal life, events and business.",
    ledeShort: "Creator tools too, plus Modes and connections.",
    summary: {
      setuvara: "Creator Mode puts your work first, with a store, a media kit, brand Deals and an Audience you can email. Three more Modes cover the rest of your life, shared by link, QR or tap.",
      them: "A creator-focused link in bio with a store, media kit, email marketing and AI tools, built around your online audience.",
    },
    rows: [
      { topic: "Pages per account", setuvara: "Four Modes: Personal, Event, Business, Creator", them: "A creator page" },
      { topic: "Store fee", setuvara: "5% Setuvara fee on Free, 0% on Plus and Pro, plus Stripe’s processing", them: "Depends on plan: see Beacons’ pricing page" },
      { topic: "Media kit", setuvara: "Media kit on every plan", them: "Media kit included" },
      { topic: "Brand deals", setuvara: "Deals pipeline from Collab Actions", them: "Brand outreach tools" },
      { topic: "Email your audience", setuvara: "2,500 emails a month on Plus, 20,000 on Pro", them: "Email marketing tools" },
      { topic: "In person", setuvara: "QR, Quick QR and NFC Tap, with Connections that remember where you met", them: "Online-first" },
      { topic: "Price", setuvara: `Free to start. ${PLUS}; ${PRO}.`, them: "Free plan and paid tiers: see Beacons’ pricing page" },
    ],
    pickSetuvara: ["You sell, and also meet brands, clients and fans in person", "You want one account for your creator work and your personal or business life", "You want 0% platform fees for a predictable monthly price"],
    pickThem: ["You want AI writing and content tools built into your link page", "Your whole business is online and you never share in person", "You already run your email list in Beacons"],
    faq: [
      { q: "Is Setuvara a Beacons alternative?", a: "Yes, for creators who want a store, a media kit and brand deals, plus pages for the rest of their life and in-person sharing by QR or NFC tap." },
      { q: "What does Setuvara charge on sales?", a: "A 5% Setuvara fee on Free and 0% on Plus and Pro. Stripe’s payment processing applies on every plan. Paid selling needs a connected Stripe account." },
      { q: "Do I need to apply for Creator Mode?", a: "No. Every Setuvara account has Creator Mode on every plan, including Free." },
      { q: "Can I send emails to my audience?", a: "Yes, on Plus (2,500 a month) and Pro (20,000 a month). Free collects your Audience; sending starts on Plus." },
    ],
    related: [
      { href: "/creator", label: "Creator Mode", line: "Work, store, media kit and deals." },
      { href: "/use-cases/link-in-bio-for-creators", label: "Link in bio for creators", line: "How creators use Setuvara." },
      { href: "/compare/linktree", label: "Setuvara vs Linktree", line: "The classic link in bio, compared." },
    ],
  },
  popl: {
    slug: "popl",
    name: "Popl",
    pricingUrl: "https://popl.co/pages/pricing",
    metaTitle: "Setuvara vs Popl: digital business cards compared | Setuvara",
    metaDescription: "Popl is an NFC digital business card for people and sales teams. Setuvara is one too, with four Modes, Events, Leads and a free plan that does the job.",
    title: "Setuvara vs Popl and digital business cards",
    lede: "Popl and other digital business cards share your contact details with a tap or a scan. Setuvara does that, and gives you the right page for the room: Business at a meeting, Event at a conference, Personal with friends.",
    ledeShort: "A tap card that also remembers who you met.",
    summary: {
      setuvara: "A Business Mode with booking, Leads, Testimonials, Builder and a Team, next to Event, Personal and Creator Modes. Share by QR, Quick QR or tap any NFC card, ring or sticker.",
      them: "Digital business cards and NFC products for individuals and sales teams, with lead capture and CRM integrations.",
    },
    rows: [
      { topic: "Pages per account", setuvara: "Four Modes, so work and personal never mix", them: "A digital card per person" },
      { topic: "NFC", setuvara: "Setuvara Tap works with any NFC card, ring or sticker you own", them: "Sells its own NFC cards and accessories" },
      { topic: "Lead capture", setuvara: "Leads on every plan; notes and CSV on Plus and Pro", them: "Lead capture and CRM integrations" },
      { topic: "Events", setuvara: "Event Mode, plus events with RSVPs, a guest list and a door scanner", them: "Event lead capture for teams" },
      { topic: "Teams", setuvara: "Team of 5 on Pro", them: "Team plans" },
      { topic: "The other side", setuvara: "Visitors connect in one tap, no app or account needed", them: "Contact exchange" },
      { topic: "Price", setuvara: `Free to start. ${PLUS}; ${PRO}.`, them: "See Popl’s pricing page" },
    ],
    pickSetuvara: ["You want your card to show a different page at a conference than with friends", "You already own an NFC card or sticker and don’t want to buy hardware", "You want bookings, testimonials and a project roadmap on your card"],
    pickThem: ["You need native CRM sync for a large sales team today", "You want a company-managed rollout with branded hardware", "You need badge scanning built for trade-show booths"],
    faq: [
      { q: "Is Setuvara a digital business card?", a: "Yes. Business Mode is a digital business card you share by link, QR code or Setuvara Tap, with booking, lead capture, testimonials and Builder built in." },
      { q: "Do I need to buy an NFC card?", a: "No. Setuvara Tap works with any NFC card, ring or sticker you already own, and QR and Quick QR work from your phone." },
      { q: "Does the other person need the app?", a: "No. They open your page in their browser and can connect in one tap without an account." },
      { q: "Can my team use it?", a: "Pro includes a Team of 5 on your Business Mode’s Leads." },
    ],
    related: [
      { href: "/use-cases/digital-business-card-for-founders", label: "Digital business card for founders", line: "Business Mode with verified revenue." },
      { href: "/use-cases/qr-business-card", label: "QR business card", line: "A printed code that opens a page you keep editing." },
      { href: "/business", label: "Business Mode", line: "Booking, Leads, Testimonials, Builder, Team." },
    ],
  },
  carrd: {
    slug: "carrd",
    name: "Carrd",
    pricingUrl: "https://carrd.co/pro",
    metaTitle: "Setuvara vs Carrd: a page builder or a page that works | Setuvara",
    metaDescription: "Carrd builds simple one-page sites you design yourself. Setuvara gives you finished pages for four parts of your life, shared by QR or tap.",
    title: "Setuvara vs Carrd",
    lede: "Carrd is a one-page website builder: a blank canvas you design. Setuvara starts from you instead: pick a Look, add your links and details, and every Mode is a finished page on phone and desktop.",
    ledeShort: "No blank canvas: start from you, live in minutes.",
    summary: {
      setuvara: `Finished pages from ${LOOKS.total} Looks, with forms, sign-ups, bookings and a store built in, plus QR and NFC sharing and Connections.`,
      them: "A flexible builder for simple one-page sites, landing pages and portfolios, with your own domain on paid plans.",
    },
    rows: [
      { topic: "How you build", setuvara: "Pick a Look and fill in your details; it’s done on phone and desktop", them: "Design your page element by element" },
      { topic: "Pages", setuvara: "Four Modes from one account", them: "Several sites on paid plans" },
      { topic: "Your own domain", setuvara: "Coming to Pro; today setuvara.com/yourname", them: "On paid plans" },
      { topic: "Forms and sign-ups", setuvara: "Actions: forms, giveaways, bookings and sign-ups on every plan", them: "Forms on paid plans" },
      { topic: "In person", setuvara: "QR, Quick QR, NFC Tap and Connections", them: "A website, not a networking tool" },
      { topic: "Price", setuvara: `Free to start. ${PLUS}; ${PRO}.`, them: "Free plan and yearly Pro plans: see Carrd’s pricing page" },
    ],
    pickSetuvara: ["You want a great page without designing one", "You share your page in person and want to know who you met", "You want forms, bookings and a store without integrations"],
    pickThem: ["You want full control of the layout, pixel by pixel", "You need your own domain today", "You’re building a landing page for a product, not a page for yourself"],
    faq: [
      { q: "Is Setuvara a Carrd alternative?", a: "For a personal or professional page, yes: Setuvara gives you finished pages from a Look instead of a blank canvas. For product landing pages with a custom layout, Carrd is the better fit." },
      { q: "Can I use my own domain?", a: "Not yet. Your own domain is coming to Pro. Today every page lives at setuvara.com/yourname, and Business and Creator Modes can claim their own handle." },
      { q: "Does my page work on desktop?", a: "Yes. Every Look has its own desktop composition, so a laptop shows a full page, not a phone in the middle of the screen." },
    ],
    related: [
      { href: "/templates", label: "Templates", line: "Every Look and Mode, ready to use." },
      { href: "/features/actions", label: "Actions", line: "Forms, giveaways, bookings and sign-ups." },
      { href: "/compare/linktree", label: "Setuvara vs Linktree", line: "Link in bio, compared." },
    ],
  },
};

export const COMPARE_ORDER = ["linktree", "beacons", "popl", "carrd"] as const;
