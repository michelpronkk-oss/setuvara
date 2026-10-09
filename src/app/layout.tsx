import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://setuvara.com"),
  title: "Setuvara",
  description: "A wallet-first digital identity and real-world connection network.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body className="bg-[#f5f4ef] text-[#0d0d0d] antialiased">{children}</body>
    </html>
  );
}
