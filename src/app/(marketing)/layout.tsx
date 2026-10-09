import type { ReactNode } from "react";

import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";

import { marketingFontClasses } from "./fonts";
import "./marketing.css";

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className={`marketing-root ${marketingFontClasses} min-h-dvh bg-paper font-brand text-ink`}>
      <a className="sr-only z-[60] rounded-full bg-ink px-5 py-3 text-sm font-semibold text-paper focus:not-sr-only focus:fixed focus:left-4 focus:top-4" href="#main-content">
        Skip to content
      </a>
      <SiteHeader />
      <main id="main-content">{children}</main>
      <SiteFooter />
    </div>
  );
}
