import type { Metadata, Viewport } from "next";
import "./globals.css";

const siteUrl = "https://setuvara.com";
const shareImageUrl = `${siteUrl}/share/setuvara-marketing.png`;
const siteTitle = "Setuvara | Your identity for real life";
const siteDescription = "One identity. Every version of you. Share the right context when you meet, and keep the connection after.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: siteTitle, template: "%s | Setuvara" },
  description: siteDescription,
  applicationName: "Setuvara",
  creator: "Setuvara",
  publisher: "Setuvara",
  openGraph: {
    type: "website",
    siteName: "Setuvara",
    title: siteTitle,
    description: siteDescription,
    url: siteUrl,
    images: [{ url: shareImageUrl, width: 1200, height: 630, alt: "Setuvara — One identity. Every version of you." }],
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description: siteDescription,
    images: [shareImageUrl],
  },
  icons: {
    icon: [{ url: "/icons/setuvara-icon.png", type: "image/png", sizes: "512x512" }],
    apple: [{ url: "/apple-touch-icon.png", type: "image/png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = { themeColor: "#F5F4EF", viewportFit: "cover" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body className="bg-[#f5f4ef] text-[#0d0d0d] antialiased">{children}</body>
    </html>
  );
}
