import type { Metadata } from "next";

export const SETUVARA_ORIGIN = "https://setuvara.com";
/** Stable JSON-LD ids, so every page's structured data points at the same Setuvara. */
export const SETUVARA_ORGANIZATION_ID = `${SETUVARA_ORIGIN}/#organization`;
export const SETUVARA_WEBSITE_ID = `${SETUVARA_ORIGIN}/#website`;
export const marketingShareImage = `${SETUVARA_ORIGIN}/share/setuvara-marketing.png`;

export function marketingMetadata({ title, description, path }: { title: string; description: string; path: string }): Metadata {
  const url = new URL(path, SETUVARA_ORIGIN).toString();

  return {
    title: { absolute: title },
    description,
    alternates: { canonical: url },
    robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 } },
    openGraph: {
      type: "website",
      siteName: "Setuvara",
      locale: "en_US",
      title,
      description,
      url,
      images: [{ url: marketingShareImage, width: 1200, height: 630, alt: "Setuvara — One identity. Every version of you." }],
    },
    twitter: { card: "summary_large_image", title, description, images: [marketingShareImage] },
  };
}
