/**
 * Blog posts at /blog/<slug>. Plain typed content: paragraphs may carry inline links written as
 * [text](/path), which the renderer turns into Links. Two posts a month; each links to the use-case
 * page it supports.
 */

export type BlogBlock = { type: "p"; text: string } | { type: "h2"; text: string } | { type: "list"; items: string[] } | { type: "tip"; text: string };

export type BlogPost = {
  slug: string;
  title: string;
  /** Shorter title for search results, when the headline runs long. */
  metaTitle?: string;
  description: string;
  published: string;
  updated?: string;
  readingMinutes: number;
  topic: string;
  /** The product visual on the post’s banner (a key of FeatureVisual). */
  visual: "actions" | "builder" | "analytics" | "qr-and-tap";
  blocks: BlogBlock[];
  related: { href: string; label: string; line: string }[];
};

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: "how-to-network-at-a-conference",
    title: "Conference networking, without the business cards",
    visual: "qr-and-tap",
    metaTitle: "How to network at a conference without business cards",
    description: "A practical playbook for meeting the right people at a conference and actually remembering them afterwards: before, during and after the event.",
    published: "2026-10-22",
    readingMinutes: 6,
    topic: "Events",
    blocks: [
      { type: "p", text: "Most people leave a conference with a pocket of cards and a vague memory of who said what. Two weeks later the cards are in a drawer and the follow-ups never happen. Networking well is less about meeting more people and more about meeting the right ones, then remembering them." },
      { type: "h2", text: "Before: decide who you’re there to meet" },
      { type: "p", text: "Write one sentence about who you want to meet and why. “Climate founders raising a seed round” is useful; “interesting people” is not. That sentence goes everywhere: your badge, your intro, and the page people see when they scan your code." },
      { type: "list", items: ["Pick three to five sessions where those people will be.", "Message two or three of them before the event and suggest a time.", "Prepare a page for this event: who you are here, what you’re working on, and the one link you want people to open."] },
      { type: "tip", text: "On Setuvara, that page is your [Event Mode](/event): the event, your role and who you’re here to meet, shared on a private link that doesn’t show your username." },
      { type: "h2", text: "During: make sharing take one second" },
      { type: "p", text: "The moment you meet someone is short. If sharing your details takes typing, spelling your name or finding an app, it doesn’t happen. A QR code on your phone’s lock screen or an NFC card works in a second, and the other person doesn’t need to install anything." },
      { type: "list", items: ["Keep your code one swipe away, not three taps deep.", "Ask for their details the same way: one tap, both saved.", "Right after the conversation, add a note: what you talked about and the next step."] },
      { type: "h2", text: "After: follow up within 48 hours" },
      { type: "p", text: "The follow-up is where the value is. Send a short message within two days that names the conversation, not the event: “Good to talk about grid storage pilots after the energy panel” beats “Great to meet you at Slush”." },
      { type: "p", text: "This is where most tools fail: a card doesn’t remember where you met. Keep the event, the city and the time next to each person, and you can find them again months later by searching for the event." },
      { type: "tip", text: "Every Setuvara Connection keeps where and when you met, with a private note. See how it works for [event networking](/use-cases/event-networking-app)." },
      { type: "h2", text: "A short checklist" },
      { type: "list", items: ["One sentence on who you’re there to meet.", "An event page with your role and that sentence.", "A code you can show in a second.", "A note after every good conversation.", "Follow-ups sent within 48 hours."] },
    ],
    related: [
      { href: "/use-cases/event-networking-app", label: "Event networking app", line: "Meet everyone, remember them after." },
      { href: "/event", label: "Event Mode", line: "Your page for the room." },
      { href: "/tools/qr-code-generator", label: "Free QR code generator", line: "A code for any link, in seconds." },
    ],
  },
  {
    slug: "share-startup-revenue-publicly",
    title: "Share your revenue publicly. Verified.",
    visual: "builder",
    metaTitle: "How to share your startup’s revenue publicly, verified",
    description: "Building in public works when people trust the numbers. How to share revenue safely, what to show, and how to verify it straight from Stripe or another provider.",
    published: "2026-10-22",
    readingMinutes: 5,
    topic: "Founders",
    blocks: [
      { type: "p", text: "Sharing revenue in public has become a growth channel of its own. Founders who post their numbers attract customers, investors and other builders who want to follow the story. It only works if people believe the numbers." },
      { type: "h2", text: "Why screenshots aren’t enough" },
      { type: "p", text: "A dashboard screenshot is easy to crop, edit or pick from the one good day. Readers know that, so the number carries less weight than it should. The fix is to show a figure that comes from the payment provider itself, updated on its own." },
      { type: "h2", text: "What to share" },
      { type: "list", items: ["Revenue over time, not a single peak: a trend tells the real story.", "What you shipped: a changelog makes the revenue make sense.", "What’s next: a roadmap gives people a reason to come back."] },
      { type: "p", text: "What not to share: anything about individual customers. Totals are enough, and they keep customer data where it belongs." },
      { type: "h2", text: "How to share it safely" },
      { type: "p", text: "Never hand out a full API key. Payment providers let you create restricted, read-only keys that can read data but can’t move money or change anything. Use one of those, store it somewhere encrypted, and revoke it if you stop sharing." },
      { type: "tip", text: "Setuvara’s [Builder](/features/builder) reads revenue daily from Stripe, RevenueCat, Dodo or Paddle with a read-only key kept encrypted in a vault, and shows it as verified next to your roadmap." },
      { type: "h2", text: "Put it where people meet you" },
      { type: "p", text: "A revenue page is most useful when people already have it: on the card you hand out at a meetup, in your bio, in your email signature. The same page should show who you are, what you’re building and how to talk to you." },
      { type: "tip", text: "See how founders do this with a [digital business card that shows verified revenue](/use-cases/share-revenue-publicly)." },
      { type: "h2", text: "A short checklist" },
      { type: "list", items: ["Create a restricted, read-only key.", "Show a trend, plus what you shipped and what’s next.", "Keep customer details out of it.", "Put the page where people meet you."] },
    ],
    related: [
      { href: "/use-cases/share-revenue-publicly", label: "Share your revenue publicly", line: "Verified from your provider." },
      { href: "/use-cases/digital-business-card-for-founders", label: "Digital business card for founders", line: "What you’re building, on one card." },
      { href: "/features/builder", label: "Builder", line: "Roadmap, changelog and verified revenue." },
    ],
  },
];

export function findPost(slug: string) {
  return BLOG_POSTS.find((post) => post.slug === slug) ?? null;
}
