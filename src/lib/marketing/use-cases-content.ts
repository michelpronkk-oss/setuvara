import { PRICES } from "./facts";
import type { ModePageContent } from "./modes-content";

/** Use-case pages at /use-cases/<slug>. Every claim maps to a shipped feature in facts.ts. */

export type UseCase = {
  slug: string;
  mode: ModePageContent["slug"];
  name: string;
  metaTitle: string;
  metaDescription: string;
  eyebrow: string;
  title: string;
  lede: string;
  problem: { title: string; body: string };
  steps: { title: string; body: string }[];
  features: { title: string; body: string; href?: string }[];
  faq: { q: string; a: string }[];
  related: { href: string; label: string; line: string }[];
};

export const USE_CASES: Record<string, UseCase> = {
  "digital-business-card-for-founders": {
    slug: "digital-business-card-for-founders",
    mode: "business",
    name: "Digital business card for founders",
    metaTitle: "Digital business card for founders, with verified revenue | Setuvara",
    metaDescription: "A digital business card for founders: what you’re building, a booking link, leads and a roadmap with revenue verified from Stripe. Share it by QR or tap. Free to start.",
    eyebrow: "For founders",
    title: "The business card that shows what you’re building.",
    lede: "Business Mode puts your company, your role and your next step on one page, with your product’s roadmap and revenue verified from your payment provider. Share it by QR or a tap of your phone.",
    problem: { title: "A paper card says who you were.", body: "Investors, partners and early customers want to know what you’re building now, how it’s going and how to talk to you next. A static card or a LinkedIn link answers none of it." },
    steps: [
      { title: "Fill in Business Mode", body: "Role, company, city and what you do. Add a booking link and it gets its own button." },
      { title: "Add your project to Builder", body: "A roadmap people can vote on, a changelog from what you ship, and revenue verified from Stripe, RevenueCat, Dodo or Paddle." },
      { title: "Share it in the room", body: "Your QR code, Quick QR from the lock screen, or a tap of any NFC card. They see Business Mode only." },
      { title: "Follow up from Leads", body: "Every inquiry and every booking becomes a lead with its history, so nothing from the meetup gets lost." },
    ],
    features: [
      { title: "Verified revenue", body: "A read-only key, daily snapshots, and a public figure that you didn’t type. On Plus (1 provider) and Pro (3).", href: "/features/builder" },
      { title: "Booking", body: "Weekly hours, slot length and buffers, with overlaps prevented.", href: "/features/actions" },
      { title: "Leads", body: "Every inquiry in one list; notes and CSV on Plus and Pro.", href: "/business" },
      { title: "Testimonials", body: "Invite clients with a single-use link and approve what shows.", href: "/business" },
      { title: "Team", body: "Five seats on Pro, sharing the same Leads.", href: "/pricing" },
      { title: "Separate from personal", body: "Your Personal Mode stays for friends; nobody sees both unless you share both.", href: "/modes" },
    ],
    faq: [
      { q: "What is the best digital business card for a startup founder?", a: "One that shows what you’re building, not just your contact details. Setuvara’s Business Mode adds a roadmap, verified revenue, booking and lead capture to a card you share by QR or NFC tap." },
      { q: "How is revenue verified?", a: "You connect a read-only key from Stripe, RevenueCat, Dodo or Paddle. Setuvara reads revenue daily from the provider, so the figure on your page comes from the source, not from you." },
      { q: "Can I hide the revenue?", a: "Yes. Verified revenue is optional per project, and Builder is optional on your page." },
      { q: "Is it free?", a: `Business Mode, Leads, booking and Builder are free. Verified revenue starts on Plus at ${PRICES.plus.monthly} a month.` },
    ],
    related: [
      { href: "/use-cases/share-saas-revenue-publicly", label: "Share your SaaS revenue publicly", line: "Build in public with numbers people can trust." },
      { href: "/business", label: "Business Mode", line: "Everything on the card." },
      { href: "/compare/popl", label: "Setuvara vs Popl", line: "Digital business cards, compared." },
    ],
  },
  "link-in-bio-for-creators": {
    slug: "link-in-bio-for-creators",
    mode: "creator",
    name: "Link in bio for creators",
    metaTitle: "Link in bio for creators: store, media kit and brand deals | Setuvara",
    metaDescription: "A link in bio for creators that leads with your work: a store with 0% fees on Plus, a media kit, brand deals and an audience you can email. Free to start.",
    eyebrow: "For creators",
    title: "A link in bio that leads with your work.",
    lede: "Creator Mode opens on what you make, not on a list of buttons. Sell from a store, send brands your media kit, take collaborations as Deals and keep your Audience. On every plan, with no application.",
    problem: { title: "Your bio link is your shop window.", body: "Most link pages are a stack of buttons. Brands want numbers, fans want the latest thing, and every extra tool takes a cut." },
    steps: [
      { title: "Pick a Look", body: "Film, Social, Stack and seven more. Two are free; all ten on Plus." },
      { title: "Put the work first", body: "Videos, music and pictures sit at the top; links follow." },
      { title: "Open the store", body: "Digital products and paid access through your own Stripe account." },
      { title: "Say what you’re open to", body: "Collab Actions turn brand inquiries into Deals you can track." },
    ],
    features: [
      { title: "Store", body: "5% Setuvara fee on Free, 0% on Plus and Pro, plus Stripe’s processing.", href: "/creator" },
      { title: "Media kit", body: "A shareable page with your platforms and audience, on every plan.", href: "/creator" },
      { title: "Deals", body: "A pipeline for brand collaborations, from inquiry to paid.", href: "/creator" },
      { title: "Audience", body: "Collect followers on Free; email 2,500 a month on Plus, 20,000 on Pro.", href: "/pricing" },
      { title: "Actions", body: "Giveaways, questions and sign-ups with an auditable winner draw.", href: "/features/actions" },
      { title: "Analytics", body: "Which links and sources work: 7 days on Free, 90 on Plus, up to 2 years on Pro.", href: "/features/analytics" },
    ],
    faq: [
      { q: "What is the best link in bio for creators?", a: "One that shows your work first and lets you sell and take brand deals without extra tools. Setuvara’s Creator Mode does that, with 0% platform fees on Plus and Pro." },
      { q: "Do I need to apply for Creator Mode?", a: "No. Every Setuvara account has Creator Mode on every plan, including Free. Paid selling needs a connected Stripe account." },
      { q: "Can I use it on Instagram and TikTok?", a: "Yes. Put your Creator Mode link in your bio. Business and Creator Modes can also claim their own handle, like setuvara.com/yourname_creates." },
      { q: "What are the fees?", a: "A 5% Setuvara fee on sales on Free, 0% on Plus and Pro. Stripe’s processing applies on every plan." },
    ],
    related: [
      { href: "/creator", label: "Creator Mode", line: "Everything Creator Mode does." },
      { href: "/compare/beacons", label: "Setuvara vs Beacons", line: "Creator pages, compared." },
      { href: "/compare/linktree", label: "Setuvara vs Linktree", line: "The classic link in bio, compared." },
    ],
  },
  "event-networking-app": {
    slug: "event-networking-app",
    mode: "event",
    name: "Event networking app",
    metaTitle: "Event networking app: meet people, remember everyone | Setuvara",
    metaDescription: "An event networking app with no app for the other person: share your Event Mode by QR or tap, connect in one tap, and remember where and when you met everyone.",
    eyebrow: "For events",
    title: "Meet everyone at the event. Remember them after.",
    lede: "Set Event Mode before you arrive: the event, your role and who you’re here to meet. Share it in the room by QR or tap. Every connection keeps the event, the city and the time.",
    problem: { title: "Business cards end up in a drawer.", body: "You meet thirty people in two days and remember five. Event apps need everyone to install them, and they forget you when the event ends." },
    steps: [
      { title: "Set Event Mode", body: "Event name, dates, your role and who you want to meet." },
      { title: "Go Live", body: "A live badge with the event and the time it ends, which clears by itself." },
      { title: "Share in person", body: "QR, Quick QR or NFC Tap. They see Event Mode on a private link with no username in it." },
      { title: "Connect and remember", body: "One tap saves you both, with where and when you met, and a private note for later." },
    ],
    features: [
      { title: "No app on their side", body: "Visitors open your page in the browser and connect without an account.", href: "/event" },
      { title: "Where you met", body: "Every connection keeps the event, city and time. Search Connections by event.", href: "/event" },
      { title: "Host your own", body: "Event pages with RSVPs, a guest list, a waitlist and a door scanner, on every plan.", href: "/event" },
      { title: "Passport", body: "Stamps and milestones for the places and events you’ve been.", href: "/features/wallet" },
      { title: "Private links", body: "Event Mode shares on an /s/ link that never shows your username.", href: "/features/qr-and-tap" },
      { title: "Analytics", body: "How many people opened your page from each share.", href: "/features/analytics" },
    ],
    faq: [
      { q: "Does the other person need to install an app?", a: "No. Your Event Mode opens in any phone browser, and they can connect in one tap without an account." },
      { q: "Can I host events with Setuvara?", a: "Yes. Create an event page with RSVPs, a guest list and a door scanner, on every plan, with up to 50 upcoming events." },
      { q: "What happens after the event?", a: "Your Connections keep the event, city and time you met. Switch back to Personal or Business Mode; the connections stay." },
      { q: "Is it free?", a: "Yes. Event Mode, Connections, events and the door scanner are all on Free." },
    ],
    related: [
      { href: "/event", label: "Event Mode", line: "Everything Event Mode does." },
      { href: "/use-cases/qr-business-card", label: "QR business card", line: "Print a code that opens the right page." },
      { href: "/events", label: "Setuvara for events", line: "For organisers and attendees." },
    ],
  },
  "qr-business-card": {
    slug: "qr-business-card",
    mode: "business",
    name: "QR business card",
    metaTitle: "QR business card that you can update any time | Setuvara",
    metaDescription: "Put a QR code on your business card that opens a page you can edit any time, with booking, links and lead capture. Free QR code with your Setuvara page.",
    eyebrow: "QR business card",
    title: "Print once. Update forever.",
    lede: "A Setuvara QR code opens your page, not a fixed file. Change your role, your links or the whole Look, and every card you’ve handed out shows the new version.",
    problem: { title: "Printed details go out of date.", body: "New role, new number, new company: every change makes a box of cards wrong. A QR code to a PDF has the same problem." },
    steps: [
      { title: "Make your page", body: "Business Mode with your role, company, booking link and contact." },
      { title: "Pick a QR style", body: "Standard on Free; Accent frame, Label, Rounded and Inverse on Plus." },
      { title: "Download and print", body: "Put it on your card, your badge, your slides or your desk." },
      { title: "Keep it current", body: "Edit your page any time. The code never changes." },
    ],
    features: [
      { title: "Choose what it opens", body: "Your Business Mode, or your Personal or Event Mode on a different code.", href: "/modes" },
      { title: "Quick QR", body: "Your code on your phone’s lock screen, for when there’s no card.", href: "/features/qr-and-tap" },
      { title: "Setuvara Tap", body: "Program any NFC card, ring or sticker to open your page.", href: "/features/qr-and-tap" },
      { title: "Lead capture", body: "Inquiries and bookings land in Leads with their history.", href: "/business" },
      { title: "Scan analytics", body: "See which shares and sources bring people in.", href: "/features/analytics" },
      { title: "Save contact", body: "Visitors save your details to their phone in one tap.", href: "/business" },
    ],
    faq: [
      { q: "Can I change where my QR code points?", a: "Your Setuvara code opens your page, and you can change everything on the page any time. The printed code stays valid." },
      { q: "Do I need Setuvara for a QR code?", a: "No. For a plain code to any link, use our free QR code generator, with no sign-up. A Setuvara code adds a page you can update and Connections." },
      { q: "How big should the QR code be on a business card?", a: "At least 2 × 2 cm (about 0.8 in), with a clear white margin around it." },
      { q: "Is it free?", a: "Yes. Your page and the Standard QR style are free; the other four styles are on Plus." },
    ],
    related: [
      { href: "/tools/qr-code-generator", label: "Free QR code generator", line: "Any link, four styles, PNG or SVG." },
      { href: "/features/qr-and-tap", label: "QR and Tap", line: "Every way to share in person." },
      { href: "/use-cases/digital-business-card-for-founders", label: "Digital business card for founders", line: "With verified revenue." },
    ],
  },
  "share-saas-revenue-publicly": {
    slug: "share-saas-revenue-publicly",
    mode: "business",
    name: "Share your SaaS revenue publicly",
    metaTitle: "Share your SaaS revenue publicly, verified from Stripe | Setuvara",
    metaDescription: "Build in public with revenue people can trust: connect a read-only Stripe, RevenueCat, Dodo or Paddle key and show verified revenue on your page, next to your roadmap.",
    eyebrow: "Build in public",
    title: "Revenue people can trust.",
    lede: "Builder shows your project’s verified revenue, read daily from your payment provider with a read-only key, next to a roadmap people can vote on and a changelog of what you shipped.",
    problem: { title: "Screenshots can be edited.", body: "Building in public works when people believe the numbers. A screenshot of a dashboard proves nothing, and nobody wants to give out a full API key." },
    steps: [
      { title: "Add your project", body: "Name, link, category and tagline in Builder on Business or Creator Mode." },
      { title: "Connect a read-only key", body: "Stripe, RevenueCat, Dodo or Paddle. Setuvara keeps the key encrypted and only reads revenue." },
      { title: "Show the number", body: "Revenue updates daily from the provider and is marked verified." },
      { title: "Ship in public", body: "Roadmap with votes, suggestions on Plus and Pro, and a changelog from what you ship." },
    ],
    features: [
      { title: "Four providers", body: "Stripe, RevenueCat, Dodo and Paddle. One provider on Plus, three on Pro.", href: "/features/builder" },
      { title: "History", body: "365 days of revenue history on Plus, 3 years on Pro.", href: "/features/builder" },
      { title: "Roadmap and votes", body: "Planned, in progress and shipped, with one vote per member. On every plan.", href: "/features/builder" },
      { title: "Projects", body: "1 project on Free, 5 on Plus, 20 on Pro.", href: "/pricing" },
      { title: "Suggestions", body: "Ideas from members, private until you approve them. Plus and Pro.", href: "/features/builder" },
      { title: "On your card", body: "The same page you share by QR or tap at a meetup.", href: "/use-cases/digital-business-card-for-founders" },
    ],
    faq: [
      { q: "How do I share my SaaS revenue publicly?", a: "Add your project to Builder on Setuvara, connect a read-only key from Stripe, RevenueCat, Dodo or Paddle, and turn on verified revenue. The figure on your page is read from the provider daily." },
      { q: "Is my Stripe key safe?", a: "Use a restricted, read-only key: a key like that can’t move money or change anything. Setuvara keeps it encrypted in a vault and only reads revenue with it." },
      { q: "Which plan do I need?", a: `Builder is free. Verified revenue needs Plus (${PRICES.plus.monthly} a month, 1 provider) or Pro (${PRICES.pro.monthly} a month, 3 providers).` },
      { q: "Can people see my customers?", a: "No. Only revenue totals are shown. Customer data never leaves your provider." },
    ],
    related: [
      { href: "/features/builder", label: "Builder and verified revenue", line: "Everything Builder does." },
      { href: "/use-cases/digital-business-card-for-founders", label: "Digital business card for founders", line: "Show it in person too." },
      { href: "/pricing", label: "Pricing", line: "Plus and Pro compared." },
    ],
  },
};

export const USE_CASE_ORDER = ["digital-business-card-for-founders", "link-in-bio-for-creators", "event-networking-app", "qr-business-card", "share-saas-revenue-publicly"] as const;
