import Link from "next/link";

import { CookieSettingsButton } from "@/components/consent/cookie-consent";
import { LegalPage, type LegalSection } from "@/components/marketing/legal/legal-page";
import { marketingMetadata } from "@/lib/marketing/metadata";

export const metadata = marketingMetadata({
  title: "Cookies | Setuvara",
  description: "The few cookies Setuvara uses, why, and how to choose whether media players load.",
  path: "/cookies",
});

const ESSENTIAL = [
  { name: "sb-…", purpose: "Keeps you signed in to your account.", lasts: "Until you sign out" },
  { name: "sv-guest-session", purpose: "Lets a guest keep a connection they made without an account.", lasts: "30 days" },
  { name: "sv-pass-…", purpose: "A Connection Pass: shows you met someone in person, so you can connect.", lasts: "Up to 24 hours" },
  { name: "sv-own-pass-…", purpose: "Your own current Connection Pass when you share in person.", lasts: "Up to 24 hours" },
  { name: "sv-consent", purpose: "Remembers your choice in this panel.", lasts: "12 months" },
];

const PLAYERS = ["Spotify", "SoundCloud", "Apple Music", "Deezer", "YouTube"];

const button = "inline-flex min-h-12 items-center rounded-full bg-ink px-6 text-[15px] font-semibold text-paper hover:bg-[#262626] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink";

const sections: LegalSection[] = [
  {
    id: "short",
    title: "The short version",
    body: (
      <>
        <p>Setuvara only sets cookies it needs to work. We don’t use advertising cookies, cross-site trackers or third-party analytics. Our own Analytics don’t use cookies at all.</p>
        <p>The one choice you have is about other companies’ media players. When someone adds Spotify, SoundCloud, Apple Music, Deezer or YouTube to their identity, those players can set cookies of their own. They only load when you allow it.</p>
        <p><CookieSettingsButton className={button} /></p>
      </>
    ),
  },
  {
    id: "essential",
    title: "Essential cookies",
    body: (
      <>
        <p>These are always on, because sign-in and connecting don’t work without them. They are set by Setuvara, only on setuvara.com, and are never used to track you.</p>
        <div className="not-prose -mx-1 overflow-x-auto">
          <table className="w-full min-w-[520px] border-separate border-spacing-0 text-left text-[14px]">
            <thead>
              <tr className="font-label text-[10px] uppercase tracking-[0.14em] text-ink/50">
                <th className="border-b border-ink/15 px-1 pb-2 font-medium">Cookie</th>
                <th className="border-b border-ink/15 px-1 pb-2 font-medium">What it does</th>
                <th className="border-b border-ink/15 px-1 pb-2 font-medium">Lasts</th>
              </tr>
            </thead>
            <tbody>
              {ESSENTIAL.map((row) => (
                <tr key={row.name}>
                  <td className="border-b border-ink/10 px-1 py-3 align-top font-label text-[12.5px] text-ink">{row.name}</td>
                  <td className="border-b border-ink/10 px-1 py-3 align-top">{row.purpose}</td>
                  <td className="whitespace-nowrap border-b border-ink/10 px-1 py-3 align-top text-ink/60">{row.lasts}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    ),
  },
  {
    id: "players",
    title: "Media players",
    body: (
      <>
        <p>Profiles can include music and video from {PLAYERS.join(", ")}. Until you allow media players, music shows a <b>Load player</b> button instead, and videos load only when you press play. Turning on a profile’s sound also loads its player.</p>
        <p>Once a player loads, its provider may set cookies under its own policy. YouTube videos use YouTube’s privacy-enhanced mode.</p>
      </>
    ),
  },
  {
    id: "storage",
    title: "Storage on your device",
    body: <p>Your browser also remembers a few small choices in local storage, like whether sound is on or which Mode you last viewed in the app. They stay on your device and are never sent to us.</p>,
  },
  {
    id: "choices",
    title: "Changing your mind",
    body: <p>Use <b>Cookie settings</b> at the bottom of any Setuvara page, or the button above. You can also clear cookies in your browser; you’ll be asked again next time. More about how we handle data is in our <Link href="/privacy">Privacy policy</Link>.</p>,
  },
];

export default function CookiesRoute() {
  return <LegalPage kicker="Cookies" other={{ href: "/privacy", label: "Read the Privacy policy" }} sections={sections} title="Cookies, kept to a minimum." updated="13 October 2026" />;
}
