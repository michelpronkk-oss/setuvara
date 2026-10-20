import Link from "next/link";

import { LegalPage, type LegalSection } from "@/components/marketing/legal/legal-page";
import { connectChatEnabled } from "@/lib/chat/launch";
import { marketingMetadata } from "@/lib/marketing/metadata";

export const metadata = marketingMetadata({
  title: "Data deletion | Setuvara",
  description: "How to disconnect Instagram, TikTok, YouTube or Twitch, delete the data Setuvara read from them, or delete your Setuvara account.",
  path: "/data-deletion",
});

/*
 * Legal review: the wording here follows what the app stores and does (social_accounts,
 * social_account_secrets, privacy_requests). Retention of backups is deliberately not described
 * until confirmed with the database provider's plan.
 */
const sections: LegalSection[] = [
  {
    id: "what",
    title: "What Setuvara holds",
    body: (
      <>
        <p>Your account (email, username, display name, preferences), what you put on your identity, your Connections and notes, and billing status. The <Link href="/privacy">Privacy policy</Link> lists it in full.</p>
        <p>If you connect <b>Instagram, TikTok, YouTube or Twitch</b> through the platform’s own sign-in, Setuvara also stores that account’s id, handle, display name, profile and picture links, its audience count as the platform reports it, and the sign-in tokens. Tokens are encrypted before they reach our database and are never shown to anyone. We don’t store your platform password, posts, messages or private data.</p>
      </>
    ),
  },
  {
    id: "disconnect",
    title: "Disconnect a platform",
    body: (
      <>
        <p>In the Setuvara app, open <b>Creator → Settings → Connected accounts</b> (also linked from <b>Settings → Privacy &amp; data</b>) and choose <b>Disconnect</b>.</p>
        <p>Disconnecting deletes, straight away, the sign-in tokens and everything Setuvara read from that platform: the id, handle, name, links and count. The platform disappears from your page. Your Setuvara account, identity and other platforms are not affected.</p>
      </>
    ),
  },
  {
    id: "tokens",
    title: "What happens to sign-in tokens",
    body: (
      <>
        <p>When you disconnect, we first ask the platform to revoke Setuvara’s access where it offers a way to do that (YouTube, TikTok and Twitch), then delete our copy. If the platform is unreachable, we still delete our copy.</p>
        <p><b>Instagram</b> does not offer apps a way to revoke access. Disconnecting deletes our copy of the token, so Setuvara can no longer use it. To remove Setuvara from Instagram as well, open Instagram’s settings, find the apps and websites you’ve allowed, and remove Setuvara.</p>
      </>
    ),
  },
  {
    id: "platform-data",
    title: "Ask a platform to have its data deleted",
    body: (
      <>
        <p>When you remove Setuvara in Instagram’s settings, Meta tells us, and we delete that Instagram connection, its tokens and its details. You can also send a data deletion request through Meta; we delete the same data and give you a confirmation code and a link to check its status.</p>
        <p>This deletes platform data only. It never deletes your Setuvara account.</p>
      </>
    ),
  },
  {
    id: "account",
    title: "Delete your Setuvara account",
    body: (
      <>
        <p>Signed in, go to <b>Settings → Privacy &amp; data</b>, type your username and choose <b>Request account deletion</b>. You can also email <a href="mailto:hello@setuvara.com">hello@setuvara.com</a> from your account’s address.</p>
        <p>A person checks each request before deleting, because it can’t be undone and can affect a paid plan. Cancel a paid plan in <b>Settings → Billing</b> first. We respond within 30 days, as our Privacy policy says.</p>
        <p>Deleting your account deletes your identity, Modes, media, links, notes, preferences and connected platforms with their tokens. It also removes the shared Connection and encounter history from the other person’s account.{connectChatEnabled() ? " It also removes your Connect Chat conversations." : ""}</p>
      </>
    ),
  },
  {
    id: "keep",
    title: "What we may keep",
    body: (
      <>
        <p>Some records stay after a deletion where the law or safety requires it:</p>
        <ul>
          <li><b>Billing records</b>, as long as tax law requires. Card details are held by our payment provider, not by us.</li>
          <li><b>A record of the deletion request</b>: its code, type, status and dates, so the status link keeps working. It never contains your platform account id or tokens.</li>
          {connectChatEnabled() && <li><b>A reported message</b> and limited context while a safety case is open, as the Privacy policy describes.</li>}
        </ul>
      </>
    ),
  },
  {
    id: "confirmation",
    title: "How you get confirmation",
    body: (
      <>
        <p>Every deletion request has a confirmation code. Platform requests show the code and a status link to the platform; account requests show it in <b>Settings → Privacy &amp; data</b>, and we confirm by email once the account is deleted.</p>
        <form action="/data-deletion/status" className="mt-2 flex flex-col gap-3 sm:flex-row" method="get">
          <label className="sr-only" htmlFor="deletion-code">Confirmation code</label>
          <input autoCapitalize="characters" autoComplete="off" className="min-h-12 flex-1 rounded-full bg-paper px-5 font-label text-[14px] tracking-[0.08em] text-ink outline-none placeholder:text-ink/40 focus-visible:ring-2 focus-visible:ring-ink" id="deletion-code" maxLength={40} name="code" placeholder="XXXX-XXXX-XXXX-XXXX-XXXX" required spellCheck={false} />
          <button className="inline-flex min-h-12 items-center justify-center rounded-full bg-ink px-6 text-[15px] font-semibold text-paper hover:bg-[#262626] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink" type="submit">Check status</button>
        </form>
      </>
    ),
  },
  {
    id: "contact",
    title: "Questions",
    body: <p>Write to <a href="mailto:hello@setuvara.com">hello@setuvara.com</a>, ideally from your account’s address and with your confirmation code. A person reads every message.</p>,
  },
];

export default function DataDeletionRoute() {
  return (
    <LegalPage
      kicker="Data deletion"
      other={{ href: "/privacy", label: "Read the Privacy policy" }}
      sections={sections}
      title="Your data, removed on request."
      updated="20 October 2026"
    />
  );
}
