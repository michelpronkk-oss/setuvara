import type { Metadata } from "next";

export const SETUVARA_ORIGIN = "https://setuvara.com";
const marketingShareImage = `${SETUVARA_ORIGIN}/share/setuvara-marketing.png`;

export function marketingMetadata({ title, description, path }: { title: string; description: string; path: string }): Metadata {
  const url = new URL(path, SETUVARA_ORIGIN).toString();

  return {
    title: { absolute: title },
    description,
    alternates: { canonical: url },
    robots: { index: true, follow: true },
    openGraph: {
      type: "website",
      siteName: "Setuvara",
      title,
      description,
      url,
      images: [{ url: marketingShareImage, width: 1200, height: 630, alt: "Setuvara — One identity. Every version of you." }],
    },
    twitter: { card: "summary_large_image", title, description, images: [marketingShareImage] },
  };
}
