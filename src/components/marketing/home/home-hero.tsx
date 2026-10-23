import { ModeScreens } from "../site/mode-landing";
import { ModeSwitch, PageHero } from "../site/kit";

/**
 * The homepage opening, in the Design v2 split: the promise and the claim field on the left, a Mode
 * stage on the right (an Event page on a desktop and a phone, and the connection it just made), and
 * the four Modes underneath, each leading to its own page.
 */
export function HomeHero() {
  return (
    <PageHero
      below={<ModeSwitch />}
      claimId="hero-claim"
      crumbs={[]}
      eyebrow="Personal · Event · Business · Creator"
      lede={<>One account with a page for each part of your life. Share the right one by link, QR or tap, and remember everyone you meet.</>}
      note="Free · All four Modes · No card"
      title={<>One identity. Every version of&nbsp;you.</>}
      visual={<ModeScreens slug="event" />}
    />
  );
}
