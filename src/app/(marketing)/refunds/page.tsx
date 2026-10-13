import Link from "next/link";

import { LegalPage, type LegalSection } from "@/components/marketing/legal/legal-page";
import { marketingMetadata } from "@/lib/marketing/metadata";

export const metadata = marketingMetadata({
  title: "Refunds | Setuvara",
  description: "Cancelling, refunds and the 14-day right to withdraw for Setuvara Plus and Pro.",
  path: "/refunds",
});

const sections: LegalSection[] = [
  {
    id: "free",
    title: "Free stays free",
    body: <p>Setuvara Free costs nothing and never expires, so there is nothing to refund. Plus and Pro are optional subscriptions, billed monthly or yearly in USD through Dodo Payments, our payment provider.</p>,
  },
  {
    id: "cancel",
    title: "Cancel anytime",
    body: (
      <>
        <p>You can cancel whenever you like in <b>Settings → Billing</b>. Your plan stays active until the end of the period you’ve paid for, then moves to Free. You won’t be charged again.</p>
        <p>Nothing is deleted when a plan ends. Paid looks fall back to a Free look and come back if you upgrade again.</p>
      </>
    ),
  },
  {
    id: "withdraw",
    title: "14 days to change your mind",
    body: (
      <>
        <p>If you’re a consumer in the EU or UK, you can withdraw from a new subscription within 14 days of your first payment and get a full refund. Email <a href="mailto:hello@setuvara.com?subject=Refund%20request">hello@setuvara.com</a> from your account’s address within those 14 days.</p>
        <p>This applies to your first payment for a plan, not to renewals.</p>
      </>
    ),
  },
  {
    id: "renewals",
    title: "Renewals",
    body: <p>Monthly and yearly plans renew automatically. We don’t refund a renewal that has already started, but you keep everything you paid for until the period ends. Forgot to cancel a yearly plan? Write to us within 14 days of the renewal and we’ll look at it with you.</p>,
  },
  {
    id: "changes",
    title: "Upgrades and downgrades",
    body: <p>Upgrading starts right away, and you only pay the difference for the rest of your current period. Downgrading or switching between monthly and yearly starts at your next billing date, so you’re never charged twice for the same time.</p>,
  },
  {
    id: "mistakes",
    title: "If something went wrong",
    body: <p>Charged twice, charged after cancelling, or a plan that didn’t work as described? Tell us and we’ll put it right, including a refund where it’s due. Approved refunds go back to your original payment method; how long that takes depends on your bank.</p>,
  },
  {
    id: "how",
    title: "How to ask",
    body: <p>Email <a href="mailto:hello@setuvara.com?subject=Refund%20request">hello@setuvara.com</a> with the email on your account and what happened. A person reads every message. Nothing here limits rights you have under consumer law. The <Link href="/terms">Terms</Link> cover billing in full.</p>,
  },
];

export default function RefundsRoute() {
  return <LegalPage kicker="Refunds" other={{ href: "/terms", label: "Read the Terms" }} sections={sections} title="Refunds, kept fair." updated="13 October 2026" />;
}
