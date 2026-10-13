import Link from "next/link";

import { LegalPage, type LegalSection } from "@/components/marketing/legal/legal-page";
import { marketingMetadata } from "@/lib/marketing/metadata";

export const metadata = marketingMetadata({
  title: "Terms | Setuvara",
  description: "The agreement for using Setuvara: your account, your content, plans and billing, and fair use.",
  path: "/terms",
});

const sections: LegalSection[] = [
  {
    id: "agreement",
    title: "The agreement",
    body: <p>These terms apply when you use setuvara.com or the Setuvara app. By creating an account or using Setuvara, you agree to them. Our <Link href="/privacy">Privacy policy</Link> explains how we handle personal data.</p>,
  },
  {
    id: "account",
    title: "Your account",
    body: (
      <ul>
        <li>You must be at least 16 and able to agree to these terms.</li>
        <li>Give accurate details, keep your password safe, and tell us if you think someone else has access.</li>
        <li>One person per account. Your username must not impersonate someone else or infringe a trademark. We may reclaim usernames that do.</li>
      </ul>
    ),
  },
  {
    id: "content",
    title: "Your content",
    body: (
      <>
        <p>You own what you put on Setuvara: your photos, links, words, music and video. You give us a licence to host, store, resize and show it, only as needed to run Setuvara and show it to the people you share it with.</p>
        <p>Only add content you have the right to use. You’re responsible for what you publish and for the links you share.</p>
      </>
    ),
  },
  {
    id: "fair-use",
    title: "Fair use",
    body: (
      <>
        <p>Setuvara is for real people meeting real people. Don’t use it to:</p>
        <ul>
          <li>harass, threaten or deceive anyone, or impersonate a person or company;</li>
          <li>publish illegal, hateful, sexual or violent content, or content that infringes someone else’s rights;</li>
          <li>send spam, scrape profiles or connections, or collect people’s data without permission;</li>
          <li>link to malware or phishing, or try to break, overload or get around Setuvara’s security.</li>
        </ul>
        <p>We may remove content or suspend accounts that break these rules. Where it’s reasonable, we’ll tell you why and give you a chance to respond.</p>
      </>
    ),
  },
  {
    id: "connections",
    title: "Connections and guests",
    body: <p>A connection is shared between two people. When you connect with someone, they keep the details you showed at that moment, even if you change or delete them later. Respect the people you meet: use what you learn through Setuvara only to stay in touch with them.</p>,
  },
  {
    id: "plans",
    title: "Plans and billing",
    body: (
      <>
        <p>Free stays free. Plus and Pro are paid subscriptions, billed monthly or yearly in USD through Dodo Payments, our payment provider. Prices are shown on the <Link href="/pricing">pricing page</Link> before you pay.</p>
        <ul>
          <li><b>Renewal</b>: subscriptions renew automatically until you cancel.</li>
          <li><b>Upgrades</b> start right away and are charged pro rata. <b>Downgrades</b> and interval changes start at your next billing date.</li>
          <li><b>Cancelling</b>: cancel anytime in Settings → Billing. You keep paid features until the end of the period you paid for.</li>
          <li><b>Downgrading never deletes anything</b>: paid looks fall back to a Free look and come back if you upgrade again.</li>
        </ul>
        <p>If we change prices, we’ll tell you in advance, and the change applies from your next renewal. Nothing here limits rights you have under consumer law.</p>
      </>
    ),
  },
  {
    id: "service",
    title: "The service",
    body: <p>We’re always improving Setuvara, so features may change. Items marked Planned or In development on our site are not yet available and may change before they launch. We work to keep Setuvara available, but can’t promise it will always be uninterrupted or error-free.</p>,
  },
  {
    id: "ending",
    title: "Ending",
    body: <p>You can stop using Setuvara at any time, and ask us to delete your account by emailing <a href="mailto:hello@setuvara.com">hello@setuvara.com</a>. We may suspend or close accounts that seriously or repeatedly break these terms, or where the law requires it.</p>,
  },
  {
    id: "liability",
    title: "Liability",
    body: <p>Setuvara is provided as it is. To the extent the law allows, we are not liable for indirect or consequential losses, or for what other people do with what you share with them. Our total liability for any claim is limited to the amount you paid us in the 12 months before it. Nothing in these terms limits liability that can’t be limited by law.</p>,
  },
  {
    id: "changes",
    title: "Changes",
    body: <p>We may update these terms. If a change matters, we’ll tell members by email or in the app before it takes effect. If you keep using Setuvara after that, the new terms apply.</p>,
  },
];

export default function TermsRoute() {
  return (
    <LegalPage
      kicker="Terms"
      other={{ href: "/privacy", label: "Read the Privacy policy" }}
      sections={sections}
      summary={[
        "You own what you put on Setuvara. We only use it to run the service.",
        "Free stays free. Paid plans renew until you cancel, and you keep access to the end of the period.",
        "Be real and respectful: no impersonation, spam or scraping.",
        "A connection is shared, so the other person keeps what you showed them.",
      ]}
      title="Terms, without the fog."
      updated="13 October 2026"
    />
  );
}
