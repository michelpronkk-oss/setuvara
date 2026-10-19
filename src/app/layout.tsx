import type { Metadata, Viewport } from "next";

import { SitePageView } from "@/components/analytics/site-page-view";
import { CookieConsent } from "@/components/consent/cookie-consent";
import { I18nProvider } from "@/lib/i18n/provider";

import { marketingFontClasses } from "./(marketing)/fonts";
import "./globals.css";

const siteUrl = "https://setuvara.com";
const shareImageUrl = `${siteUrl}/share/setuvara-marketing.png`;
const siteTitle = "Setuvara | Your identity for real life";
const siteDescription = "One identity. Every version of you. Share the right you by link, QR or Setuvara Tap, and remember everyone you meet.";

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
  // Added to the Home Screen, Setuvara opens full screen like an app (manifest.ts covers Android).
  appleWebApp: { capable: true, title: "Setuvara", statusBarStyle: "default" },
  other: { "apple-mobile-web-app-capable": "yes" },
};

export const viewport: Viewport = { themeColor: "#F5F4EF", viewportFit: "cover" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body className="bg-[#f5f4ef] text-[#0d0d0d] antialiased">
        <I18nProvider>{children}</I18nProvider>
        <div className={`${marketingFontClasses} font-brand`}><CookieConsent /></div>
        <SitePageView />
      </body>
    </html>
  );
}
