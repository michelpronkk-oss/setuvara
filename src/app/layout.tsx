import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Setuvara",
  description: "A wallet-first digital identity and real-world connection network.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
