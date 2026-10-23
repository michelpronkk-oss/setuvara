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
  /** The intro on phones: one short line. */
  ledeShort?: string;
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
    metaTitle: "Digital business card for founders | Setuvara",
    metaDescription: "A digital business card for founders: what you’re building, a booking link, leads and a roadmap with revenue verified from Stripe. Share it by QR or tap. Free to start.",
    eyebrow: "For founders",
    title: "The business card that shows what you’re building.",
    lede: "Business Mode puts your company, your role and your next step on one page, with your product’s roadmap and revenue verified from your payment provider. Share it by QR or a tap of your phone.",
    ledeShort: "Your company, your role and a booking, on one page.",
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
      { href: "/use-cases/share-revenue-publicly", label: "Share your revenue publicly", line: "Build in public with numbers people can trust." },
      { href: "/business", label: "Business Mode", line: "Everything on the card." },
      { href: "/compare/popl", label: "Setuvara vs Popl", line: "Digital business cards, compared." },
    ],
  },
  "link-in-bio-for-creators": {
    slug: "link-in-bio-for-creators",
    mode: "creator",
    name: "Link in bio for creators",
    metaTitle: "Link in bio for creators: store, media kit, deals | Setuvara",
    metaDescription: "A link in bio for creators that leads with your work: a store with 0% fees on Plus, a media kit, brand deals and an audience you can email. Free to start.",
    eyebrow: "For creators",
    title: "A link in bio that leads with your work.",
    lede: "Creator Mode opens on what you make, not on a list of buttons. Sell from a store, send brands your media kit, take collaborations as Deals and keep your Audience. On every plan, with no application.",
    ledeShort: "Your work first, with a store and a media kit.",
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
    ledeShort: "Share in the room. Every connection keeps the event.",
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
      { href: "/event", label: "Event Mode", line: "For organisers and attendees." },
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
    ledeShort: "A QR that opens your page. Change it any time.",
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
  "share-revenue-publicly": {
    slug: "share-revenue-publicly",
    mode: "business",
    name: "Share your revenue publicly",
    metaTitle: "Share your MRR publicly, verified from Stripe | Setuvara",
    metaDescription: "Build in public with revenue people can trust: connect a read-only Stripe, RevenueCat, Dodo or Paddle key and show verified revenue on your page, next to your roadmap.",
    eyebrow: "Build in public",
    title: "Revenue people can trust.",
    lede: "Builder shows your project’s verified revenue, read daily from your payment provider with a read-only key, next to a roadmap people can vote on and a changelog of what you shipped.",
    ledeShort: "Revenue read from your provider, not a screenshot.",
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
      { q: "How do I share my revenue or MRR publicly?", a: "Add your project to Builder on Setuvara, connect a read-only key from Stripe, RevenueCat, Dodo or Paddle, and turn on verified revenue. The figure on your page is read from the provider daily." },
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
  "nfc-business-card": {
    slug: "nfc-business-card",
    mode: "business",
    name: "NFC business card",
    metaTitle: "NFC business card: tap to share your page | Setuvara",
    metaDescription: "Turn any NFC card, ring or sticker into a business card: one tap opens your page, no app needed. Switch which Mode it opens without reprinting. Free on every plan.",
    eyebrow: "NFC business card",
    title: "One tap. Your whole page.",
    lede: "Setuvara Tap turns any NFC card, ring or sticker you own into a business card. A tap on a phone opens your page, with no app to install, and you choose which Mode it opens.",
    ledeShort: "Any NFC card, one tap, your page.",
    problem: { title: "Most NFC cards lock you in.", body: "Many NFC business cards only work with one company’s app or subscription, and the card is useless if you leave. Your card should open your page, wherever you keep it." },
    steps: [
      { title: "Set up Business Mode", body: "Role, company, what you do, and a booking link if you take calls." },
      { title: "Write your Tap link", body: "Setuvara gives you a Tap link. Write it once to any NFC card, ring, sticker or badge with any NFC writer app." },
      { title: "Tap to share", body: "Hold the card to someone’s phone. Your page opens in the browser; they can save your contact or connect." },
      { title: "Switch, don’t rewrite", body: "Change which Mode the card opens from the app: Business at work, Event at a conference." },
    ],
    features: [
      { title: "Any NFC device", body: "Cards, rings, stickers and badges you already own. Manage and switch off each one.", href: "/features/qr-and-tap" },
      { title: "QR as a backup", body: "Older phones without NFC can scan your QR code, or Quick QR from your lock screen.", href: "/features/qr-and-tap" },
      { title: "Save contact", body: "Visitors save your details to their phone in one tap.", href: "/business" },
      { title: "Connect without an app", body: "The other person connects in one tap, no account needed, and you keep where you met.", href: "/event" },
      { title: "Tap insights", body: "Taps and scans in Analytics on every plan; device and Tap insights on Pro.", href: "/features/analytics" },
      { title: "Free", body: "Setuvara Tap works on every plan, with no per-card fee.", href: "/pricing" },
    ],
    faq: [
      { q: "What is an NFC business card?", a: "A card with a small NFC chip that opens a link when someone holds it to their phone. With Setuvara, the link opens your page, so the card always shows your current details." },
      { q: "Do I need to buy a card from Setuvara?", a: "No. Setuvara Tap works with any NFC card, ring, sticker or badge you can write a link to. Write your Tap link once with any NFC writer app." },
      { q: "Does the other person need an app?", a: "No. Modern iPhones and Android phones read NFC and open the page in the browser. Phones without NFC can scan your QR code instead." },
      { q: "Can I change what the card opens?", a: "Yes. The card opens whichever Mode you’ve equipped, so you can switch between Business and Event without rewriting it." },
    ],
    related: [
      { href: "/use-cases/qr-business-card", label: "QR business card", line: "The same idea, printed." },
      { href: "/features/qr-and-tap", label: "QR and Tap", line: "Every way to share in person." },
      { href: "/blog/digital-business-card-vs-paper", label: "Digital vs paper cards", line: "What actually works." },
    ],
  },
  "digital-business-card-for-real-estate-agents": {
    slug: "digital-business-card-for-real-estate-agents",
    mode: "business",
    name: "Digital business card for real estate agents",
    metaTitle: "Digital business card for real estate agents | Setuvara",
    metaDescription: "A digital business card for real estate agents: viewing requests by booking, every inquiry in Leads, client testimonials and save-contact. Share by QR at open houses.",
    eyebrow: "For real estate agents",
    title: "The card that books the viewing.",
    lede: "Business Mode gives agents one page for every open house and listing sign: your photo, your agency, client testimonials and a booking for viewings, with every inquiry saved in Leads.",
    ledeShort: "Viewings, leads and testimonials on one card.",
    problem: { title: "Open house visitors leave with a flyer.", body: "Most never call. The ones who do have lost your number or can’t remember which agent you were. You need a way to turn a visit into a booked viewing on the spot." },
    steps: [
      { title: "Fill in Business Mode", body: "Your photo, agency, areas you cover and how to reach you." },
      { title: "Add a booking Action", body: "Set the hours you take viewings and calls, the slot length and buffers between them." },
      { title: "Put your code everywhere", body: "On your card, the open-house sign-in table and window displays. NFC cards and stickers work too." },
      { title: "Follow up from Leads", body: "Every inquiry and booking lands in Leads with its history, so you know who visited and what they asked." },
    ],
    features: [
      { title: "Booking", body: "Weekly hours, slot length and buffers, with overlaps prevented. Up to 14 days ahead on Free, 60 on Plus.", href: "/features/actions" },
      { title: "Leads", body: "Every inquiry with stages from new to won; notes and CSV export on Plus and Pro.", href: "/business" },
      { title: "Testimonials", body: "Invite past clients with a single-use link and choose which reviews show.", href: "/business" },
      { title: "Save contact", body: "Buyers save your details to their phone in one tap.", href: "/business" },
      { title: "Team", body: "Five seats on Pro, so your agency shares the same Leads.", href: "/pricing" },
      { title: "Separate from personal", body: "Your Personal Mode stays for friends and family.", href: "/modes" },
    ],
    faq: [
      { q: "What should a real estate agent’s digital business card include?", a: "Your photo, agency and areas, a way to book a viewing or call, reviews from past clients and one tap to save your contact. Business Mode covers all of it." },
      { q: "Can buyers book a viewing from my card?", a: "Yes. Add a booking Action with the hours you’re available. Requests land in Leads and overlaps are prevented." },
      { q: "Does it work at open houses?", a: "Yes. Put your QR code on the sign-in table or your card. Visitors scan, see your page and can book or send an inquiry right away." },
      { q: "Is it free?", a: `Business Mode, booking and Leads are free. Plus (${PRICES.plus.monthly} a month) adds lead notes, CSV export and bookings up to 60 days ahead; Pro adds a five-person team.` },
    ],
    related: [
      { href: "/use-cases/qr-business-card", label: "QR business card", line: "A code that opens a page you keep editing." },
      { href: "/use-cases/booking-page-for-coaches", label: "Booking page for coaches", line: "Bookings and testimonials." },
      { href: "/business", label: "Business Mode", line: "A business card that books." },
    ],
  },
  "booking-page-for-coaches": {
    slug: "booking-page-for-coaches",
    mode: "business",
    name: "Booking page for coaches and consultants",
    metaTitle: "Booking page for coaches and consultants | Setuvara",
    metaDescription: "A booking page for coaches and consultants: who you help, testimonials from clients and a booking with your hours, slot length and buffers. Inquiries land in Leads. Free.",
    eyebrow: "For coaches and consultants",
    title: "From first look to booked session.",
    lede: "Business Mode puts who you help, proof from past clients and your calendar on one page. Prospects book an intro in a few taps, and every request lands in Leads.",
    ledeShort: "Who you help, client proof and your calendar.",
    problem: { title: "A booking link alone doesn’t convince.", body: "Prospects want to know who you work with and whether it works before they give up an hour. A bare calendar link skips that step, and a full website is more than you need." },
    steps: [
      { title: "Say who you help", body: "One line on who you work with and the result, in Business Mode." },
      { title: "Add a booking Action", body: "Your weekly hours, session length and buffers. Overlaps are prevented." },
      { title: "Collect testimonials", body: "Send past clients a single-use link and approve what shows on your page." },
      { title: "Share it everywhere", body: "In your bio, your email signature, after talks by QR and on calls." },
    ],
    features: [
      { title: "Booking", body: "Weekly hours, slot length and buffers. Bookings up to 14 days ahead on Free, 60 on Plus, 120 on Pro.", href: "/features/actions" },
      { title: "Testimonials", body: "3 shown on Free, 24 on Plus, 60 on Pro, each one approved by you.", href: "/business" },
      { title: "Leads", body: "Every booking and inquiry with its history, from new to won.", href: "/business" },
      { title: "Forms and newsletter", body: "Intake questions as a form Action, and a newsletter to keep in touch.", href: "/features/actions" },
      { title: "Analytics and funnel", body: "Analytics shows which shares bring people in; the Leads funnel shows how many become clients.", href: "/features/analytics" },
      { title: "One account", body: "A Creator Mode for your content and a Personal Mode for friends, kept separate.", href: "/modes" },
    ],
    faq: [
      { q: "What is the best booking page for a coach?", a: "One that shows proof before the calendar: who you help, testimonials and then a booking. Setuvara’s Business Mode puts all three on one page you share by link or QR." },
      { q: "Can clients pick a time themselves?", a: "Yes. Set your weekly hours, session length and buffers; clients pick an open slot and the booking lands in Leads." },
      { q: "Can I ask questions before the session?", a: "Yes. Add a form Action with your intake questions: 3 questions per Action on Free, 6 on Plus, 12 on Pro." },
      { q: "Is it free?", a: `Business Mode, booking, Leads and three testimonials are free. Plus is ${PRICES.plus.monthly} a month for more testimonials, lead notes and longer booking windows.` },
    ],
    related: [
      { href: "/features/actions", label: "Actions", line: "Bookings, forms and sign-ups." },
      { href: "/use-cases/digital-business-card-for-real-estate-agents", label: "Real estate agents", line: "The card that books the viewing." },
      { href: "/business", label: "Business Mode", line: "A business card that books." },
    ],
  },
  "link-in-bio-for-musicians": {
    slug: "link-in-bio-for-musicians",
    mode: "creator",
    name: "Link in bio for musicians and DJs",
    metaTitle: "Link in bio for musicians and DJs | Setuvara",
    metaDescription: "A link in bio for musicians and DJs: your track plays when the page opens, your latest work first, a store with 0% fees on Plus, brand deals and a list of fans you can email.",
    eyebrow: "For musicians and DJs",
    title: "A bio link that sounds like you.",
    lede: "Creator Mode opens on your music: a soundtrack that plays from Spotify, SoundCloud, YouTube or Apple Music, your newest release first, then a store, your media kit and a way for fans to stay on your list.",
    ledeShort: "Your track plays the moment it opens.",
    problem: { title: "A list of streaming links is silent.", body: "Fans tap your bio and see buttons. Bookers want numbers and a way to reach you. And the moment you change platforms, every old link breaks." },
    steps: [
      { title: "Pick your soundtrack", body: "Paste a Spotify, SoundCloud, YouTube or Apple Music link; it plays when your page opens." },
      { title: "Put the latest release first", body: "Videos, sets and tracks sit at the top; links follow." },
      { title: "Sell and collect", body: "Sell downloads, sample packs or lessons through your own Stripe, and collect fans’ emails." },
      { title: "Take bookings as Deals", body: "A Collab Action turns venue and brand inquiries into Deals you track from new to paid." },
    ],
    features: [
      { title: "Profile soundtrack", body: "Your song plays when your page opens, on every plan.", href: "/creator" },
      { title: "Store", body: "5% Setuvara fee on Free, 0% on Plus and Pro, plus Stripe’s processing.", href: "/creator" },
      { title: "Media kit", body: "Your platforms and audience on one live page bookers can read in seconds.", href: "/tools/media-kit-template" },
      { title: "Audience", body: "Collect fans’ emails on every plan; send 2,500 emails a month on Plus, 20,000 on Pro.", href: "/creator" },
      { title: "Events", body: "Running your own night? Give it a page with RSVPs, a guest list and a door scanner.", href: "/event" },
      { title: "Every Look", body: "Film, Social and Stack among ten Looks. Two are free; all ten on Plus.", href: "/templates" },
    ],
    faq: [
      { q: "What is the best link in bio for musicians?", a: "One that plays your music, not just lists it. Setuvara’s Creator Mode plays your soundtrack when the page opens and puts your latest release first, with a store and a fan list built in." },
      { q: "Which platforms does the soundtrack support?", a: "Spotify, SoundCloud, YouTube and Apple Music. Paste a link and it plays on your page." },
      { q: "Can I sell music or merch?", a: "Digital products and services, yes: downloads, sample packs, lessons, through your own Stripe account. Setuvara takes 5% on Free and 0% on Plus and Pro. For physical merch, link to your shop." },
      { q: "Can venues and brands contact me?", a: "Yes. A Collab Action collects inquiries with the details you ask for, and each becomes a Deal you can track." },
    ],
    related: [
      { href: "/use-cases/link-in-bio-for-creators", label: "Link in bio for creators", line: "Store, media kit and deals." },
      { href: "/blog/media-kit-what-brands-look-for", label: "What brands look for", line: "A media kit in ten seconds." },
      { href: "/creator", label: "Creator Mode", line: "Your work first." },
    ],
  },
};

export const USE_CASE_ORDER = ["digital-business-card-for-founders", "link-in-bio-for-creators", "event-networking-app", "qr-business-card", "nfc-business-card", "digital-business-card-for-real-estate-agents", "booking-page-for-coaches", "link-in-bio-for-musicians", "share-revenue-publicly"] as const;
