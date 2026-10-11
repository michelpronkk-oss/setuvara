import type { ReactNode } from "react";
import { headers } from "next/headers";

import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { normalizeLocale } from "@/lib/i18n/locale";

import { marketingFontClasses } from "./fonts";
import "./marketing.css";

export default async function MarketingLayout({ children }: { children: ReactNode }) {
  const locale = normalizeLocale((await headers()).get("x-setuvara-locale")) ?? "en";
  return (
    <div className={`marketing-root ${marketingFontClasses} min-h-dvh bg-paper font-brand text-ink`} lang={locale}>
      <a className="sr-only z-[60] rounded-full bg-ink px-5 py-3 text-sm font-semibold text-paper focus:not-sr-only focus:fixed focus:left-4 focus:top-4" href="#main-content">
        {locale === "nl" ? "Ga naar de inhoud" : "Skip to content"}
      </a>
      <SiteHeader locale={locale} />
      <main id="main-content">{children}</main>
      <SiteFooter locale={locale} />
    </div>
  );
}
