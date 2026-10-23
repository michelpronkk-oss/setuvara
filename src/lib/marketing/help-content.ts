import { CONTACT_EMAIL } from "./contact";
import { LOOKS, PRICE_LINE, PRICES } from "./facts";

/**
 * The Help centre at /help. Every answer restates what the product does today, from the same
 * facts the rest of the site uses (facts.ts and the feature, pricing and policy pages). Where a
 * thing is designed but not shipped, the answer says so.
 */

export type HelpItem = { q: string; a: string; links?: { href: string; label: string }[] };
export type HelpTopic = { id: string; title: string; line: string; icon: HelpIcon; items: HelpItem[] };
export type HelpIcon = "start" | "modes" | "share" | "people" | "actions" | "store" | "builder" | "billing" | "privacy";

export const HELP_TOPICS: HelpTopic[] = [
  {
    id: "getting-started",
    title: "Getting started",
    line: "Your name, your first Mode, your first share.",
    icon: "start",
    items: [
      { q: "What is Setuvara?", a: "Setuvara is a digital identity you share by link, QR code or tap: one account with a page for each part of your life (Personal, Event, Business and Creator) that remembers everyone you meet.", links: [{ href: "/what-is-setuvara", label: "What is Setuvara" }] },
      { q: "How do I start?", a: "Claim your name at setuvara.com/yourname, add a photo and a few links to your Personal Mode, and publish. Then share it by link, QR code or Setuvara Tap. Other Modes can wait until you need them.", links: [{ href: "/signup", label: "Get Setuvara" }] },
      { q: "Is Setuvara free?", a: `Yes. All four Modes, sharing by link, QR and Setuvara Tap, Actions, Leads, Builder and Connections are free. ${PRICE_LINE}`, links: [{ href: "/pricing", label: "Pricing" }] },
      { q: "Does the other person need Setuvara or an app?", a: "No. Your page opens in any browser. They tap Connect and leave their name and email, without an account. If they join Setuvara later, the connection is already waiting for them." },
      { q: "Can I use Setuvara like an app on my phone?", a: "Yes. Add Setuvara to your Home Screen from the account menu in the app. It opens straight into sharing, so your QR is one tap away." },
    ],
  },
  {
    id: "modes",
    title: "Modes and your page",
    line: "Four pages, ten Looks, one account.",
    icon: "modes",
    items: [
      { q: "What is a Mode?", a: "A version of your page for one part of your life: Personal for friends, Event for conferences and meetups, Business for clients and Creator for your audience. Each has its own links, Look, link and QR code, and visitors only see the Mode you share.", links: [{ href: "/modes", label: "All Modes" }] },
      { q: "Do I have to fill in all four?", a: "No. Turn on the Modes you need. A Mode that is off doesn't open for anyone." },
      { q: "How do I change how my page looks?", a: `Pick a Look in Identity → Appearance. There are ${LOOKS.total}; ${LOOKS.free.join(" and ")} are free and Plus unlocks all ${LOOKS.total}. Every Look has its own phone and desktop layout.`, links: [{ href: "/templates", label: "See the Looks" }] },
      { q: "What happens to a Plus Look if my plan ends?", a: "Nothing is deleted. The page falls back to a free Look, and your Look comes back if you upgrade again." },
      { q: "Can my Business or Creator page have its own address?", a: "Yes. Business and Creator Modes can claim their own handle, like setuvara.com/yourname_creates, and you choose whether search engines may list it. Your own domain is coming to Pro; it isn't available yet." },
      { q: "Can I add music?", a: "Yes. Paste a link from Spotify, Apple Music, SoundCloud or YouTube for your profile soundtrack. It never autoplays: visitors tap to listen." },
    ],
  },
  {
    id: "sharing",
    title: "Sharing, QR and Tap",
    line: "Link, QR code, Quick QR and NFC.",
    icon: "share",
    items: [
      { q: "How do I share my page?", a: "Open Home in the app, pick a Mode and tap Share. You get the link, a QR code and your phone's share sheet. People only see the Mode you shared." },
      { q: "Do my QR codes expire?", a: "No. Setuvara QR codes don't expire and have no watermark, on every plan. They open your live page, so you update the page, not the printed code." },
      { q: "What are Quick QR and Setuvara Tap?", a: "Quick QR shows your code from your phone in one tap. Setuvara Tap gives you a link to write to any NFC card, ring, sticker or badge with an NFC writer app. Both open the Mode you've equipped, so one card can open Event at a conference and Business afterwards.", links: [{ href: "/features/qr-and-tap", label: "QR and Tap" }] },
      { q: "Do I need to buy a Setuvara card?", a: "No. Setuvara Tap works with any NFC card, ring or sticker you already own, and QR and Quick QR work from your phone." },
      { q: "How big should a printed QR code be?", a: "At least 2 × 2 cm (about 0.8 in), with a clear white margin around it. The Standard QR style is free; the other four styles are on Plus." },
      { q: "Is there an Apple or Google Wallet pass?", a: "Not yet. The Wallet pass is coming soon. Quick QR and Setuvara Tap are live today on every plan." },
    ],
  },
  {
    id: "connections",
    title: "Connections",
    line: "Who you met, where, when, and your note.",
    icon: "people",
    items: [
      { q: "What is a Connection?", a: "Someone who chose to connect with you from your page. Setuvara keeps the Mode, the place and the time you met, and you can add a private note only you see.", links: [{ href: "/features", label: "Features" }] },
      { q: "Can I search the people I've met?", a: "Yes. Search Connections by name, company, event or city, and filter by Mode, so “who did I meet in Amsterdam?” has an answer." },
      { q: "Can I see who viewed my profile?", a: "No. Setuvara counts views, scans and connections but never shows who a visitor was, their IP address or their email. Connections are only the people who chose to connect." },
      { q: "What is Live Context?", a: "Set where you are, like an event, and your page shows it while it's true. It ends by itself afterwards, so your page never shows an old event, and the connections you make are saved with it." },
      { q: "Can I host my own event?", a: "Yes. Events gives you an event page with RSVPs, a guest list and a door scanner, on every plan, with up to 50 upcoming events.", links: [{ href: "/event", label: "Event Mode" }] },
    ],
  },
  {
    id: "actions",
    title: "Actions, Leads and analytics",
    line: "Sign-ups, bookings, inquiries and numbers.",
    icon: "actions",
    items: [
      { q: "What is an Action?", a: "A card on your page with its own form, such as a newsletter sign-up, a booking request or a giveaway. Each Action has its own inbox for responses. Free has 2 live Actions, Plus 8 and Pro 24, across all your Modes.", links: [{ href: "/features/actions", label: "Actions" }] },
      { q: "Can I email the people who signed up?", a: `Yes, on Plus and Pro. Plus sends up to 2,500 emails a month to your Audience and Pro up to 20,000. On Free you collect sign-ups.` },
      { q: "How do Leads work?", a: "An inquiry on your Business Mode becomes a lead with its stage and history. Move it from new to contacted, qualified, won or lost. Notes and CSV export are on Plus and Pro; Pro adds a Team of 5." },
      { q: "How far back do analytics go?", a: "Seven days on Free, 30 and 90 days on Plus, and any range up to two years on Pro. CSV export is on Pro.", links: [{ href: "/features/analytics", label: "Analytics" }] },
      { q: "Does Setuvara send a weekly summary?", a: "Yes. On Mondays, if your page had activity, you get one email with last week's views, scans and connections against the week before. Turn it off in Settings → Email preferences." },
    ],
  },
  {
    id: "creator",
    title: "Creator store and payouts",
    line: "Selling, fees, media kit and Deals.",
    icon: "store",
    items: [
      { q: "Do I need to apply for Creator Mode?", a: "No. Every account has Creator Mode on every plan, including Free. Switch it on and fill it in.", links: [{ href: "/creator", label: "Creator Mode" }] },
      { q: "What are the fees on sales?", a: "A 5% Setuvara fee on Free and 0% on Plus and Pro. Stripe's own processing fee applies on every plan." },
      { q: "How do I get paid?", a: "Paid products use your own connected Stripe account, so payouts come from Stripe. Free downloads and shop links work without Stripe." },
      { q: "Is there a media kit?", a: "Yes. Creator Mode has a live media kit page you share by link, next to your store and brand Deals, on every plan." },
    ],
  },
  {
    id: "builder",
    title: "Builder and verified revenue",
    line: "Projects, roadmaps and revenue from the source.",
    icon: "builder",
    items: [
      { q: "What is Builder?", a: "Projects on your Business or Creator page with a roadmap people can vote on and a changelog. Free has 1 public project, Plus 5 and Pro 20.", links: [{ href: "/features/builder", label: "Builder" }] },
      { q: "What is verified revenue?", a: `A revenue figure Setuvara reads daily from your payment provider with a read-only key, instead of a number you typed. Stripe, RevenueCat, Dodo Payments and Paddle are supported: one provider on Plus (${PRICES.plus.monthly} a month), three on Pro.` },
      { q: "Is my key safe?", a: "Use a restricted, read-only key: it can't move money or change anything. Setuvara stores it encrypted and only reads revenue totals. Customer data never leaves your provider." },
      { q: "Can I hide the number?", a: "Yes. Verified revenue is optional per project, and Builder is optional on your page." },
    ],
  },
  {
    id: "billing",
    title: "Plans and billing",
    line: "Free, Plus and Pro. Upgrades, cancelling, refunds.",
    icon: "billing",
    items: [
      { q: "What do Plus and Pro cost?", a: `${PRICE_LINE} Billing runs through Dodo Payments, our payment provider.`, links: [{ href: "/pricing", label: "Compare plans" }] },
      { q: "How do I upgrade or change plan?", a: "Go to Settings → Billing in the app. Upgrading starts right away and you only pay the difference for the rest of your period. Downgrading or switching between monthly and yearly starts at your next billing date." },
      { q: "How do I cancel?", a: "Cancel any time in Settings → Billing. Your plan stays active until the end of the period you've paid for, then moves to Free. You won't be charged again, and nothing is deleted." },
      { q: "Can I get a refund?", a: `If you're a consumer in the EU or UK, you can withdraw from a new subscription within 14 days of your first payment for a full refund. Email ${CONTACT_EMAIL} from your account's address. This applies to a first payment, not renewals.`, links: [{ href: "/refunds", label: "Refund policy" }] },
      { q: "What does the member badge mean?", a: "It shows a Plus or Pro plan. It is not an identity check." },
    ],
  },
  {
    id: "privacy",
    title: "Privacy and your account",
    line: "Your data, connected platforms, deleting.",
    icon: "privacy",
    items: [
      { q: "Who can see my page?", a: "Anyone with the link to a Mode that is on and published. A Mode that is off, or a draft account, doesn't open. There is no feed and no public friend list." },
      { q: "Who can see my notes?", a: "Only you. Private notes on Connections are never shown to the other person or on your page." },
      { q: "How do I disconnect Instagram, TikTok, YouTube or Twitch?", a: "In Creator → Settings → Connected accounts. Disconnecting deletes the tokens and everything Setuvara read from that platform straight away. It never deletes your Setuvara account.", links: [{ href: "/data-deletion", label: "Data deletion" }] },
      { q: "How do I delete my account?", a: "Go to Settings → Privacy & data and request account deletion. Cancel a paid plan first. A person checks each request before deleting, because it can't be undone, and we respond within 30 days.", links: [{ href: "/privacy", label: "Privacy policy" }] },
      { q: "How do I change cookie settings?", a: "Use Cookie settings in the footer of any page. Setuvara only uses what it needs to work unless you allow more.", links: [{ href: "/cookies", label: "Cookie policy" }] },
    ],
  },
];

/** The first things most people ask, shown under the search. */
export const POPULAR = ["Is Setuvara free?", "How do I share my page?", "Do my QR codes expire?", "How do I cancel?"];
