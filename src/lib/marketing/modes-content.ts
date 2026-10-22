import type { Faq, Feature } from "@/components/marketing/site/kit";

/**
 * The four Mode pages (/personal, /event, /business, /creator). Every tool named here is in the
 * product (the Mode's tools in components/app/side-nav modeTools); nothing is promised ahead.
 */

export type ModeSlugPage = "personal" | "event" | "business" | "creator";

export type ModePageContent = {
  slug: ModeSlugPage;
  name: string;
  path: string;
  /** Search title and description. */
  metaTitle: string;
  metaDescription: string;
  eyebrow: string;
  title: string;
  lede: string;
  /** What a visitor sees on this Mode's page. */
  shows: { title: string; body: string }[];
  /** The Mode's own tools, as named in the app. */
  tools: Feature[];
  /** Who it's for, in one row of short cards. */
  forWho: { title: string; body: string }[];
  share: string;
  faq: Faq[];
};

export const MODE_PAGES: Record<ModeSlugPage, ModePageContent> = {
  personal: {
    slug: "personal",
    name: "Personal",
    path: "/personal",
    metaTitle: "Personal Mode: a link in bio for real life | Setuvara",
    metaDescription: "Your Setuvara for friends and the people you choose: your bio, city, music and links on one page, shared by link, QR or tap. Free to start.",
    eyebrow: "Personal Mode",
    title: "The you your friends know.",
    lede: "Your bio, your city, your music and the links you actually use. One page for the people you choose, shared by link, QR or a tap of your phone.",
    shows: [
      { title: "Your page, your look", body: "Ten Looks to choose from, your photo, your name in the type you pick, and a soundtrack that plays when they open it." },
      { title: "Links and content", body: "Instagram, Spotify, WhatsApp and any link you add, plus pictures, videos and music, in the order you set." },
      { title: "Connect", body: "One tap to save each other. They don't need an account, and both of you remember where you met." },
    ],
    tools: [
      { title: "Actions", tag: "In Personal", body: "A newsletter, a form or questions as a card on your page, each with its own responses. Giveaways come with Plus.", href: "/features/actions" },
      { title: "Audience", tag: "In Personal", body: "Everyone who joined through your Actions, in one list. Send them emails on Plus and Pro." },
      { title: "QR and Tap", tag: "Sharing", body: "Your own QR in the style you choose, Quick QR from your lock screen and Setuvara Tap.", href: "/features/qr-and-tap" },
      { title: "Analytics", tag: "Every plan", body: "Views, scans and connections, with seven days free and longer history on Plus and Pro.", href: "/features/analytics" },
    ],
    forWho: [
      { title: "New in town", body: "Share one page instead of five handles at the bar." },
      { title: "Run clubs and communities", body: "Everyone saves each other in one tap after the run." },
      { title: "Anyone who meets people", body: "Your links, your music and where you met, kept together." },
    ],
    share: "setuvara.com/aanya",
    faq: [
      { q: "What is Personal Mode?", a: "Personal Mode is the Setuvara page for friends and communities: your bio, city, music and links on one page that you share by link, QR code or Setuvara Tap." },
      { q: "Is Personal Mode free?", a: "Yes. Personal Mode, your public page, links, content, QR codes and Connections are free. Plus adds eight more Looks, premium QR styles and longer analytics." },
      { q: "Do people need an account to connect with me?", a: "No. Anyone can open your page and connect without an account. They can claim a Setuvara later and the connection comes with them." },
      { q: "Can I have a separate page for work?", a: "Yes. The same account has Event, Business and Creator Modes, each with its own links, look, link and QR. Visitors only see the Mode you share." },
    ],
  },
  event: {
    slug: "event",
    name: "Event",
    path: "/event",
    metaTitle: "Event Mode: event networking that remembers who you met | Setuvara",
    metaDescription: "Go Live at a conference or meetup: the event, your role and who you're here to meet on one page. People connect in one scan; the event is saved with each connection.",
    eyebrow: "Event Mode",
    title: "The you that belongs in this room.",
    lede: "The event, the city, your role and who you're here to meet. Go Live while you're there, let people connect in one scan, and every connection keeps where it happened.",
    shows: [
      { title: "Where you are, right now", body: "A Live pill with the event and city while you're there. It ends on its own, so your page never shows last month's conference." },
      { title: "Who you're here to meet", body: "Your role and the people you're looking for, right under your name, so the right ones walk up." },
      { title: "Connect at the event", body: "One scan and they're saved, with the event and the date attached for both of you." },
    ],
    tools: [
      { title: "Events", tag: "In Event", body: "Create your own event with a page, a guest list, RSVPs and a door scanner that checks people in." },
      { title: "Actions", tag: "In Event", body: "A sign-up form, a newsletter or a giveaway for the people you meet, as cards on your page.", href: "/features/actions" },
      { title: "Audience", tag: "In Event", body: "Everyone who signed up through your Actions, ready for a follow-up email on Plus and Pro." },
      { title: "Recaps", tag: "Every plan", body: "After a busy day, one email with everyone you met at the event, saved with where and when." },
    ],
    forWho: [
      { title: "Conference regulars", body: "Founders, sales and partnerships people who meet fifty people in two days." },
      { title: "Meetup and dinner hosts", body: "A guest list, a check-in scanner and everyone's page in one place." },
      { title: "Speakers", body: "Put your page on the last slide and keep everyone who scans it." },
    ],
    share: "setuvara.com/s/k7Qx2mPa",
    faq: [
      { q: "What is Event Mode?", a: "Event Mode is a Setuvara page for conferences, meetups and dinners. It shows the event, your role and who you want to meet, and every connection made there is saved with the event and date." },
      { q: "How does going Live work?", a: "You set where you are and Setuvara shows it on your page while it's true. It ends by itself after the event, so your page never shows an old event." },
      { q: "Can I run my own event on Setuvara?", a: "Yes. Event Mode includes Events: an event page, RSVPs, a guest list and a scanner for the door, with check-in opening shortly before the event starts." },
      { q: "Do guests need the app?", a: "No. Guests open your page in the browser and connect without an account." },
    ],
  },
  business: {
    slug: "business",
    name: "Business",
    path: "/business",
    metaTitle: "Business Mode: a digital business card with leads | Setuvara",
    metaDescription: "A digital business card that does the next step: bookings, lead capture, testimonials, a team, and Builder to show what you're building with verified revenue.",
    eyebrow: "Business Mode",
    title: "The you that closes the meeting.",
    lede: "Role, company and what you do, with the next step one tap away. Every inquiry becomes a lead, every project can show verified revenue, and your team shares the same front door.",
    shows: [
      { title: "A business card that books", body: "Add a booking link and it gets its own button, so the next step happens while you're still talking." },
      { title: "Proof, not claims", body: "Testimonials you choose to show, and Builder projects with a public roadmap and revenue verified from your payment provider." },
      { title: "One front door", body: "Your page is the card, the QR on the stand and the link in your email signature." },
    ],
    tools: [
      { title: "Leads", tag: "In Business", body: "Every inquiry from your page lands as a lead with stages and a conversion funnel. Notes and CSV export on Plus and Pro." },
      { title: "Builder", tag: "In Business", body: "Show what you're building: projects, a public roadmap with voting, updates and verified revenue.", href: "/features/builder" },
      { title: "Testimonials", tag: "In Business", body: "Collect quotes from clients and choose which ones your page shows." },
      { title: "Team", tag: "Pro", body: "Up to five teammates work your leads with you, as managers or members." },
      { title: "Actions", tag: "In Business", body: "Forms, booking requests and a newsletter as cards on your page, each with its own inbox.", href: "/features/actions" },
      { title: "Audience", tag: "In Business", body: "Everyone who signed up through your Actions, in one list." },
    ],
    forWho: [
      { title: "Founders", body: "Your company, your roadmap and your revenue on the page people scan." },
      { title: "Sales and partnerships", body: "Book the next call on the spot and see which events bring leads." },
      { title: "Consultants and studios", body: "Inquiries, bookings and client quotes in one place." },
    ],
    share: "setuvara.com/s/R3vT9wLe",
    faq: [
      { q: "Is Setuvara a digital business card?", a: "Yes. Business Mode is a digital business card you share by link, QR code or Setuvara Tap, with booking, lead capture, testimonials and Builder built in." },
      { q: "What happens when someone sends an inquiry?", a: "It becomes a lead in Leads with its stage and history. You move it from new to contacted, qualified, won or lost. Notes and CSV export are on Plus and Pro." },
      { q: "What is verified revenue?", a: "On Plus and Pro, Builder connects to Stripe, RevenueCat, Dodo Payments or Paddle with a read-only key and shows your revenue on your page, checked automatically, instead of a number you typed." },
      { q: "Can my business page have its own address?", a: "Yes. Business Mode can have its own handle, a shareable link that opens your business page directly, and you choose whether search engines may list it." },
    ],
  },
  creator: {
    slug: "creator",
    name: "Creator",
    path: "/creator",
    metaTitle: "Creator Mode: link in bio with a store and media kit | Setuvara",
    metaDescription: "A link in bio built for creators: featured work, a store for digital products and services, a live media kit, brand deal requests and an audience you own.",
    eyebrow: "Creator Mode",
    title: "The you they came to see.",
    lede: "Your work first, then the ways to support it: a store, a media kit that stays current, brand deals in one inbox and an audience you can write to.",
    shows: [
      { title: "Work first", body: "Featured videos and pictures lead the page, in the order you set." },
      { title: "A store on your page", body: "Sell digital downloads and services, or give them away free. Payments go to your own Stripe account, with no Setuvara fee on Plus and Pro." },
      { title: "Brands know how to reach you", body: "A media kit and a collaboration request form that sends brands' proposals to one place." },
    ],
    tools: [
      { title: "Work", tag: "In Creator", body: "Your featured pieces and selected work, front and centre." },
      { title: "Commerce", tag: "In Creator", body: "Products, orders, customers and payouts. Free downloads work without payments set up. Setuvara takes 5% on Free and nothing on Plus or Pro." },
      { title: "Deals", tag: "In Creator", body: "Collaboration requests from brands, tracked from first message to done." },
      { title: "Media kit", tag: "In Creator", body: "Your platforms, audience and rates as a live page you can send to any brand." },
      { title: "Builder", tag: "In Creator", body: "Projects with a roadmap, updates and verified revenue.", href: "/features/builder" },
      { title: "Insights", tag: "In Creator", body: "What your page, store and Actions bring in.", href: "/features/analytics" },
    ],
    forWho: [
      { title: "Musicians and DJs", body: "Sets, releases and bookings on one page." },
      { title: "Writers and educators", body: "Sell a guide, grow a newsletter, take questions." },
      { title: "Video creators", body: "Featured work, brand deals and a media kit that's never out of date." },
    ],
    share: "setuvara.com/s/Fm8cN2qZ",
    faq: [
      { q: "What is Creator Mode?", a: "Creator Mode is a Setuvara page for creators: featured work, a store, a live media kit, brand deal requests, Actions and an audience, alongside your links." },
      { q: "How do I get Creator Mode?", a: "Every Setuvara account has it. Switch Creator Mode on and fill it in; it's on every plan, including Free." },
      { q: "Can I sell on Setuvara?", a: "Yes. Creator Mode includes a store for digital products and services. Paid products use your own Stripe account. Setuvara's fee is 5% on Free and 0% on Plus and Pro, plus Stripe's own processing fee. Free downloads and shop links work without Stripe." },
      { q: "Is it a Linktree alternative?", a: "It covers what a link in bio does, then adds a store, a media kit, brand deals and an audience list, with a page designed around your work rather than a list of buttons." },
    ],
  },
};

export const MODE_ORDER: ModeSlugPage[] = ["personal", "event", "business", "creator"];
