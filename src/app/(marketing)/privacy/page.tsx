import Link from "next/link";

import { LegalPage, type LegalSection } from "@/components/marketing/legal/legal-page";
import { marketingMetadata } from "@/lib/marketing/metadata";

export const metadata = marketingMetadata({
  title: "Privacy | Setuvara",
  description: "What Setuvara collects, why, who helps us run it, and the choices you have.",
  path: "/privacy",
});

const sections: LegalSection[] = [
  {
    id: "who",
    title: "Who we are",
    body: <p>Setuvara runs setuvara.com and the Setuvara app: one identity with Personal, Event and Business Modes, and the connections you make with them. This policy explains what personal data we handle and why. Questions go to <a href="mailto:hello@setuvara.com">hello@setuvara.com</a>.</p>,
  },
  {
    id: "collect",
    title: "What we collect",
    body: (
      <>
        <p><b>Your account.</b> Email address, password (stored by our authentication provider, never in plain text), username and display name. Your language and region preferences.</p>
        <p><b>What you put on your identity.</b> Your Modes and their settings (for example role, company, event, city), photos, links, content blocks, music and video you add, and your Appearance choices.</p>
        <p><b>Connections.</b> Who you connected with, the context of the encounter (event, city, venue, date and time, and which Mode was shared), and private notes you write. Notes are visible only to you.</p>
        <p><b>Guests.</b> When someone without an account connects with you, we store the name and email they give us so they can keep the connection and claim it later. Once claimed, we remove that email from the guest record. We never send notification emails to guests.</p>
        <p><b>Live Context, Passport and Wallet.</b> Live Context you set (type, label, venue, city, start and end time), your Passport milestones and stamps, and, if you add a pass to Apple or Google Wallet, the identifiers needed to update it.</p>
        <p><b>Billing.</b> Your plan, billing interval and subscription status. Card details are handled by our payment provider; we never see your full card number.</p>
        <p><b>Feedback.</b> If you send in-app feedback: your message, an optional screenshot, the page and Mode you were on, your plan, screen size, language and browser user agent.</p>
      </>
    ),
  },
  {
    id: "analytics",
    title: "Analytics, without tracking visitors",
    body: (
      <>
        <p>When someone views your identity, opens a link or connects, we record the event, the time, the source (for example QR or link), the Mode, and a device class (mobile, tablet or desktop). That is how your Analytics work.</p>
        <p>To understand how the site is used, we also count page views of setuvara.com: the page, the country the visit came from (as reported by our hosting provider), and the device class. These counts are not linked to you, your identity or any visitor, and use no cookies.</p>
        <p>We do not store who viewed you, their IP address, their email, their exact browser or their precise location, and visitor countries are never shown against a person's identity. We use no third-party analytics, advertising pixels or cross-site trackers.</p>
      </>
    ),
  },
  {
    id: "public",
    title: "What is public",
    body: (
      <>
        <p>When your identity is published, anyone with the link can see your Personal Mode at setuvara.com/your-username, including the links, blocks and media you choose to show. Published identities may be listed in our sitemap so search engines can find them.</p>
        <p>Event and Business Modes open only through their own private short links (setuvara.com/s/…). You can make a new link at any time, which retires the old one.</p>
        <p>While Live Context is on, its label and end time are shown on your page; venue and history stay private. Connections, encounter context and notes are only visible to the people in that connection. You decide per Mode who can connect: anyone, only people you meet in person, or nobody.</p>
      </>
    ),
  },
  {
    id: "why",
    title: "Why we use it",
    body: (
      <ul>
        <li><b>To run Setuvara for you</b>: your account, your identity, sharing, connecting and remembering. This is necessary to provide the service you signed up for.</li>
        <li><b>To bill paid plans</b> through our payment provider, as part of that contract.</li>
        <li><b>To keep Setuvara safe</b>: preventing abuse, spam and fraud, and keeping the service secure. This is our legitimate interest.</li>
        <li><b>To send email you can control</b>: account emails (like confirming your address) and notifications you can switch off in Settings or with the unsubscribe link. Product updates are off unless you turn them on.</li>
        <li><b>To improve the product</b> from feedback you choose to send.</li>
      </ul>
    ),
  },
  {
    id: "processors",
    title: "Who helps us run it",
    body: (
      <>
        <p>We use a small set of providers that process data on our behalf. We don’t sell your personal data.</p>
        <ul>
          <li><b>Supabase</b>: database, sign-in and file storage (hosted in the EU, Ireland).</li>
          <li><b>Vercel</b>: hosting of setuvara.com (EU, Ireland region).</li>
          <li><b>Resend</b>: sending email. Open and click tracking are off.</li>
          <li><b>Dodo Payments</b>: checkout, subscriptions, invoices and the billing portal. They receive your email, name and plan.</li>
          <li><b>Apple and Google</b>: only if you add a Wallet pass, to deliver and update it.</li>
        </ul>
        <p>Some providers may process data outside the EU. Where they do, we rely on their standard safeguards for international transfers.</p>
      </>
    ),
  },
  {
    id: "embeds",
    title: "Music, video and links",
    body: (
      <>
        <p>To show previews and icons for links, our servers fetch the linked page and its icon, so visitors’ browsers don’t contact those sites just to draw your page. Soundtrack previews are looked up on Apple iTunes and Deezer.</p>
        <p>Video blocks (YouTube, Vimeo, Loom, TikTok, Instagram) load only after a visitor presses play; YouTube uses its privacy-enhanced domain. Music players from Spotify, SoundCloud, Apple Music and Deezer load only once you allow media players or press Load player. Once loaded, those providers may set their own cookies under their own policies.</p>
      </>
    ),
  },
  {
    id: "cookies",
    title: "Cookies and storage",
    body: (
      <>
        <p>Setuvara only sets cookies needed for the service to work. We don’t use advertising or tracking cookies, so there is nothing to opt into.</p>
        <ul>
          <li><b>Sign-in (sb-…)</b>: keeps you signed in.</li>
          <li><b>sv-guest-session</b>: lets a guest keep a connection they made, for up to 30 days.</li>
          <li><b>sv-pass-… and sv-own-pass-…</b>: short-lived Connection Passes (up to 24 hours) that prove you met in person.</li>
          <li><b>sv-consent</b>: remembers your cookie choice for 12 months.</li>
        </ul>
        <p>Your browser’s local storage also remembers small choices on your device, like whether sound is on or which Mode you last viewed. It never leaves your device.</p>
        <p>Media players from Spotify, SoundCloud, Apple Music, Deezer and YouTube only load when you allow them. Details and your settings are on the <Link href="/cookies">Cookie policy</Link>.</p>
      </>
    ),
  },
  {
    id: "keep",
    title: "How long we keep it",
    body: (
      <>
        <p>We keep your account data for as long as you have an account. Guest sessions expire after 30 days; unsubscribe links after one year; Connection Passes within 24 hours.</p>
        <p>If you delete your account, we delete your identity, Modes, media, links, notes and preferences. A connection is shared by two people, so the other person keeps their own record of meeting you (the name and details you showed at the time). We keep billing records as long as tax law requires.</p>
      </>
    ),
  },
  {
    id: "rights",
    title: "Your choices and rights",
    body: (
      <>
        <p>You can edit or remove anything on your identity at any time, unpublish it, turn off connecting per Mode, and manage email in Settings.</p>
        <p>You can also ask us for a copy of your data, to correct it, to delete your account, or to object to or restrict how we use it. Email <a href="mailto:hello@setuvara.com">hello@setuvara.com</a> from your account’s address and we’ll respond within 30 days. If you’re in the EU or UK, you can also complain to your data protection authority.</p>
      </>
    ),
  },
  {
    id: "age",
    title: "Age",
    body: <p>Setuvara is not meant for children. You must be at least 16 to create an account.</p>,
  },
  {
    id: "changes",
    title: "Changes",
    body: <p>If we change this policy in a way that matters, we’ll update the date above and tell members by email or in the app before it takes effect. The <Link href="/terms">Terms</Link> cover how Setuvara may be used.</p>,
  },
];

export default function PrivacyRoute() {
  return (
    <LegalPage
      kicker="Privacy"
      other={{ href: "/terms", label: "Read the Terms" }}
      sections={sections}
      title="Privacy, in plain words."
      updated="19 October 2026"
    />
  );
}
