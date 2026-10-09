import type { Metadata } from "next";

const siteOrigin = "https://setuvara.com";

export function marketingMetadata({ title, description, path }: { title: string; description: string; path: string }): Metadata {
  const url = new URL(path, siteOrigin).toString();
  const image = new URL("/opengraph-image", siteOrigin).toString();

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      siteName: "Setuvara",
      title,
      description,
      url,
      images: [{ url: image, width: 1200, height: 630, alt: "Setuvara | One identity. Every version of you." }],
    },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}
