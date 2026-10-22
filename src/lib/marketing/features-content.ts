import type { Faq, Feature } from "@/components/marketing/site/kit";

import { PLAN_LIMITS } from "./facts";

/**
 * The feature pages (/features/<slug>). Facts mirror the product and the plan tables in facts.ts;
 * anything not shipped (the Wallet pass) says so plainly.
 */

export type FeatureSlug = "actions" | "builder" | "analytics" | "qr-and-tap" | "wallet";

export type FeaturePage = {
  slug: FeatureSlug;
  name: string;
  metaTitle: string;
  metaDescription: string;
  eyebrow: string;
  title: string;
  lede: string;
  status?: "coming";
  steps: { title: string; body: string }[];
  capabilities: Feature[];
  /** The plan table group from facts.ts to show, if any. */
  planGroup?: string;
  faq: Faq[];
  related: { href: string; label: string; line: string }[];
};

export const FEATURE_PAGES: Record<FeatureSlug, FeaturePage> = {
  actions: {
    slug: "actions",
    name: "Actions",
    metaTitle: "Actions: forms, newsletter sign-ups, bookings and giveaways on your page | Setuvara",
    metaDescription: "Put a form, a newsletter sign-up, a booking request, questions, collaboration requests or a giveaway on your Setuvara page. Every response lands in its own inbox.",
    eyebrow: "Actions",
    title: "Your page, with a next step.",
    lede: "An Action is a card on your page with its own form: a newsletter, a sign-up, a booking request, questions, a collaboration request or a giveaway. Responses land in one inbox, with the people in your Audience.",
    steps: [
      { title: "Pick a kind", body: "Start from a goal or choose the kind yourself. Each Mode suggests the ones that suit it." },
      { title: "Place it on your page", body: "It sits among your links and content, in the order you set, and can open and close on a date." },
      { title: "Work the responses", body: "Every response arrives in the Action's inbox. Business inquiries become Leads; sign-ups join your Audience." },
    ],
    capabilities: [
      { title: "Newsletter", tag: "Every plan", body: "Grow your list. Every sign-up is confirmed by email, one per address." },
      { title: "Form", tag: "Every plan", body: "Your own questions: sign-ups, RSVPs, leads or feedback." },
      { title: "Booking", tag: "Every plan", body: "Requests for sessions, appearances or applications, with the dates people want." },
      { title: "Questions", tag: "Every plan", body: "Questions, ideas and fan submissions, without opening your chat." },
      { title: "Collaboration requests", tag: "Every plan", body: "Brands and creators send a structured proposal." },
      { title: "Giveaway", tag: "Plus and Pro", body: "People enter with a confirmed email, one entry each." },
    ],
    planGroup: "Actions",
    faq: [
      { q: "What is an Action on Setuvara?", a: "An Action is a card on your Setuvara page with its own form, such as a newsletter sign-up, a booking request or a giveaway. Each Action has its own inbox for responses." },
      { q: "How many Actions can I have?", a: "Free has 2 live Actions, Plus 8 and Pro 24, counted across all your Modes. Drafts don't count." },
      { q: "Are newsletter sign-ups confirmed?", a: "Yes. Every newsletter sign-up and giveaway entry is confirmed by email, so your list has one real address per person." },
      { q: "Can I email the people who signed up?", a: "Yes, on Plus and Pro. Plus sends up to 2,500 emails a month to your Audience and Pro up to 20,000. On Free you collect sign-ups and can export them after upgrading." },
    ],
    related: [
      { href: "/business", label: "Business Mode", line: "Actions that become Leads." },
      { href: "/creator", label: "Creator Mode", line: "Collabs, giveaways and a store." },
      { href: "/features/analytics", label: "Analytics", line: "See which Actions work." },
      { href: "/pricing", label: "Pricing", line: "2, 8 or 24 live Actions." },
    ],
  },
  builder: {
    slug: "builder",
    name: "Builder",
    metaTitle: "Builder: share what you're building, with verified revenue | Setuvara",
    metaDescription: "Show your projects on your Setuvara page: a public roadmap with voting, updates and revenue verified from Stripe, RevenueCat, Dodo Payments or Paddle. Build in public, with proof.",
    eyebrow: "Builder and Verified Revenue",
    title: "Build in public, with proof.",
    lede: "Builder puts what you're building on your page: the project, a roadmap people can vote on, updates and a revenue figure checked against your payment provider instead of typed in.",
    steps: [
      { title: "Add a project", body: "Name, category, link and what it is. It shows on your Business or Creator page." },
      { title: "Open the roadmap", body: "Planned, in progress and shipped. Visitors vote on what's next; on Plus and Pro they suggest features too." },
      { title: "Verify your revenue", body: "Connect Stripe, RevenueCat, Dodo Payments or Paddle with a read-only key. Your figure updates on its own." },
    ],
    capabilities: [
      { title: "Projects", tag: "Every plan", body: "Each project with its category, status, link and the date it launched." },
      { title: "Public roadmap", tag: "Every plan", body: "Planned, in progress and shipped items, with voting from visitors." },
      { title: "Feature suggestions", tag: "Plus and Pro", body: "Signed-in visitors suggest what to build next." },
      { title: "Verified revenue", tag: "Plus and Pro", body: "Stripe, RevenueCat, Dodo Payments or Paddle, read-only, refreshed automatically." },
      { title: "Revenue history", tag: "Plus and Pro", body: "A trend line over the past year on Plus and three years on Pro." },
      { title: "Updates", tag: "Every plan", body: "Short notes on what shipped, right on the project." },
    ],
    planGroup: "Builder",
    faq: [
      { q: "What is verified revenue?", a: "Verified revenue is a revenue figure Setuvara reads from your payment provider with a read-only key and shows on your page, instead of a number you typed. It is available on Plus and Pro." },
      { q: "Which payment providers are supported?", a: "Stripe, RevenueCat, Dodo Payments and Paddle. Plus connects one provider at a time and Pro up to three." },
      { q: "Is my key safe?", a: "Use a restricted, read-only key. Setuvara stores it encrypted and only reads revenue figures; it can't move money or change anything in your account." },
      { q: "Where does Builder appear?", a: "On your Business or Creator Mode page, as a project card with its roadmap and, if you connect a provider, the verified figure." },
    ],
    related: [
      { href: "/business", label: "Business Mode", line: "Builder beside Leads and bookings." },
      { href: "/creator", label: "Creator Mode", line: "Builder beside your store." },
      { href: "/features/analytics", label: "Analytics", line: "Who looks at your page." },
      { href: "/pricing", label: "Pricing", line: "1, 5 or 20 public projects." },
    ],
  },
  analytics: {
    slug: "analytics",
    name: "Analytics",
    metaTitle: "Analytics: views, scans and connections for your link in bio | Setuvara",
    metaDescription: "See who opens your Setuvara: profile views, QR and Tap scans, link taps and connections, by source and Mode, with period comparison and a conversion funnel on Pro. No tracking of who your visitors are.",
    eyebrow: "Analytics",
    title: "See it working.",
    lede: "Views, scans, link taps and the people who connected, for every Mode. Free shows your last seven days; Plus and Pro show where they came from, which Mode they saw and how many became a connection.",
    steps: [
      { title: "Every share counts", body: "Links, QR codes, Quick QR and Tap each report their own scans and views." },
      { title: "Every Mode on its own", body: "See which page people open and which one turns views into connections." },
      { title: "No spying", body: "Signals are private to you. Setuvara never shows you who viewed your page, their IP or their email." },
    ],
    capabilities: [
      { title: "Views, scans and connections", tag: "Every plan", body: "Your seven-day picture on Free, with the trend against the week before." },
      { title: "Link taps", tag: "Every plan", body: "Which of your links people tap, per day." },
      { title: "Sources and Modes", tag: "Plus and Pro", body: "Where visitors came from and which Mode they saw." },
      { title: "Conversion", tag: "Plus and Pro", body: "How many views became a connection." },
      { title: "Then and now", tag: "Pro", body: "Every period against the one before, and your loop per Mode." },
      { title: "Devices, funnel and CSV", tag: "Pro", body: "The connection journey, device and Tap insights, and any range up to two years." },
    ],
    planGroup: "Analytics",
    faq: [
      { q: "Can I see who viewed my profile?", a: "No. Setuvara counts views, scans and connections but never shows who a visitor was, their IP address or their email. Connections are the people who chose to connect." },
      { q: "How far back do analytics go?", a: "Seven days on Free, 30 and 90 days on Plus, and any range up to two years on Pro." },
      { q: "Does Setuvara send a weekly summary?", a: "Yes. On Mondays, members whose page had activity get one email with last week's views, scans and connections against the week before. It can be turned off." },
      { q: "Can I export my analytics?", a: "Yes, on Pro, as a CSV file." },
    ],
    related: [
      { href: "/features/qr-and-tap", label: "QR and Tap", line: "Every scan, counted." },
      { href: "/features/actions", label: "Actions", line: "Turn views into sign-ups." },
      { href: "/event", label: "Event Mode", line: "See what an event brought." },
      { href: "/pricing", label: "Pricing", line: "7 days free, more on Plus and Pro." },
    ],
  },
  "qr-and-tap": {
    slug: "qr-and-tap",
    name: "QR and Tap",
    metaTitle: "QR code business card and NFC tap: share your page in person | Setuvara",
    metaDescription: "Share your Setuvara by QR code or a tap of an NFC card, ring or sticker. Change which Mode it opens without reprinting. Five QR styles, Quick QR and tap analytics.",
    eyebrow: "QR and Tap",
    title: "Meet in person, share in one move.",
    lede: "Your page has its own QR code in the style you choose. Quick QR and Setuvara Tap open the Mode you've equipped, so the same card or sticker opens your Event page today and your Business page tomorrow.",
    steps: [
      { title: "Show your QR", body: "Every Mode has its own link and QR. Download it for a badge, a slide or a table stand." },
      { title: "Or let them tap", body: "Write your Tap link to any NFC card, ring, sticker or badge you own. A phone tap opens your page." },
      { title: "Switch, don't reprint", body: "Change which Mode Quick QR and Tap open, any time. The printed code never changes." },
    ],
    capabilities: [
      { title: "A QR for every Mode", tag: "Every plan", body: "Each Mode's own link and code, in the Standard style on Free." },
      { title: "Five QR styles", tag: "Plus and Pro", body: "Standard, Accent frame, Identity label, Inverse and Rounded, in your colours." },
      { title: "Quick QR", tag: "Every plan", body: "One code that opens your equipped Mode, ready from the app in a tap." },
      { title: "Setuvara Tap", tag: "Every plan", body: "Use any NFC card, ring or sticker you own. Manage and switch off each one." },
      { title: "Connect on the spot", tag: "Every plan", body: "Scanners can connect in one tap, no app or account needed." },
      { title: "Scan insights", tag: "Every plan", body: "QR, Quick QR and Tap scans in Analytics; device and Tap insights on Pro." },
    ],
    planGroup: "Your page",
    faq: [
      { q: "Can I use Setuvara as a QR code business card?", a: "Yes. Every Setuvara Mode has its own QR code you can print on a card, badge or slide. It opens your live page, so you update the page, not the card." },
      { q: "Does my QR code expire?", a: "No. Your Setuvara QR codes don't expire and have no watermark, on every plan." },
      { q: "What NFC devices work with Setuvara Tap?", a: "Any NFC card, ring, sticker or badge you can write a link to. Setuvara gives you the link; you write it once with any NFC writer app." },
      { q: "Can one card open different pages?", a: "Yes. Quick QR and Tap open whichever Mode you've equipped, so you can switch between Event and Business without changing the card." },
    ],
    related: [
      { href: "/event", label: "Event Mode", line: "Scan, connect, remember the event." },
      { href: "/business", label: "Business Mode", line: "A business card that books." },
      { href: "/features/analytics", label: "Analytics", line: "Count every scan." },
      { href: "/features/wallet", label: "Wallet", line: "Your page in Apple and Google Wallet." },
    ],
  },
  wallet: {
    slug: "wallet",
    name: "Wallet",
    metaTitle: "Wallet pass: your Setuvara in Apple and Google Wallet (coming soon) | Setuvara",
    metaDescription: "A Setuvara pass in Apple Wallet and Google Wallet: your QR one swipe away, even offline. Coming soon. Share by QR, Quick QR and Tap today.",
    eyebrow: "Wallet",
    status: "coming",
    title: "Your QR, one swipe away.",
    lede: "A Setuvara pass for Apple Wallet and Google Wallet: your equipped Mode's QR on your lock screen, ready even without signal. The pass is coming soon; Quick QR and Tap do the same job today.",
    steps: [
      { title: "Add the pass", body: "One tap from the app adds your Setuvara to Apple Wallet or Google Wallet." },
      { title: "Show it anywhere", body: "Your QR on the lock screen, at the door, in a queue, without opening anything." },
      { title: "It follows your Mode", body: "The pass opens the Mode you've equipped, like Quick QR and Tap." },
    ],
    capabilities: [
      { title: "Standard pass", tag: "Coming soon", body: "Your name and QR in Setuvara's own design, on every plan." },
      { title: "Premium pass", tag: "Coming soon", body: "The pass in your Look's colours, on Plus and Pro." },
      { title: "Quick QR", tag: "Live today", body: "Your equipped Mode's QR, one tap from the app.", href: "/features/qr-and-tap" },
      { title: "Setuvara Tap", tag: "Live today", body: "Any NFC card, ring or sticker opens your page.", href: "/features/qr-and-tap" },
    ],
    faq: [
      { q: "Is the Setuvara Wallet pass available?", a: "Not yet. The Apple Wallet and Google Wallet pass is coming soon. Quick QR and Setuvara Tap are live today on every plan." },
      { q: "Will the pass be free?", a: "Yes. The standard pass will be on every plan; Plus and Pro add a pass in your Look's colours." },
    ],
    related: [
      { href: "/features/qr-and-tap", label: "QR and Tap", line: "Live today." },
      { href: "/event", label: "Event Mode", line: "Made for the door." },
      { href: "/personal", label: "Personal Mode", line: "For the people you choose." },
      { href: "/pricing", label: "Pricing", line: "Free to start." },
    ],
  },
};

export const FEATURE_ORDER: FeatureSlug[] = ["actions", "builder", "analytics", "qr-and-tap", "wallet"];

export const planRowsFor = (group?: string) => PLAN_LIMITS.find((item) => item.group === group);
