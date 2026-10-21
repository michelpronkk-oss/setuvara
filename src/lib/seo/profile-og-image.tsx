import { ImageResponse } from "next/og";

import type { ModeSlug } from "@/components/profile/types";
import { CARD_SIZE, SocialCard, type CardFormat } from "@/lib/seo/social-card/card";
import { loadSocialCard } from "@/lib/seo/social-card/data";
import { socialCardFonts } from "@/lib/seo/social-card/fonts";
import { isAllowedUsername } from "@/lib/usernames";

const MODE_SLUGS = new Set<ModeSlug>(["personal", "event", "business", "creator"]);

export function NotFoundImage() {
  return new Response("Not found", {
    status: 404,
    headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" },
  });
}

/** `?format=feed` asks for the 1080 × 1350 feed post; anything else is the 1200 × 630 link preview. */
export function cardFormat(request: Request): CardFormat {
  return new URL(request.url).searchParams.get("format") === "feed" ? "feed" : "link";
}

/**
 * The social card for one published Mode. `displayUrl` is the address the visitor was given
 * (username, handle or share link), so the card never prints a URL the share didn't reveal.
 */
export async function profileOgImage(
  username: string,
  slug: ModeSlug,
  options: { displayUrl: string; handle?: string; format?: CardFormat },
) {
  if (!isAllowedUsername(username) || !MODE_SLUGS.has(slug)) return NotFoundImage();
  const data = await loadSocialCard(username, slug, options);
  if (!data) return NotFoundImage();
  const format = options.format ?? "link";

  return new ImageResponse(<SocialCard data={data} format={format} />, {
    ...CARD_SIZE[format],
    fonts: await socialCardFonts(),
    headers: {
      // Unpublishing or turning a Mode off must take the card down at once, so nothing is cached.
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
