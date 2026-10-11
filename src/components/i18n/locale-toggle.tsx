"use client";

import { setLocaleAction } from "@/app/actions/locale";
import { languageFor, type Locale } from "@/lib/i18n/locale";

export function LocaleToggle({ locale, returnTo, fullLabels = false, menuItems = false }: { locale: Locale; returnTo: string; fullLabels?: boolean; menuItems?: boolean }) {
  const active = languageFor(locale);
  const buttonClass = "inline-flex min-h-9 min-w-10 items-center justify-center rounded-full px-2.5 text-xs font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff5a4f]";

  return (
    <div aria-label="Language" className="inline-flex items-center gap-1 rounded-full bg-black/[0.05] p-1">
      <form action={setLocaleAction}>
        <input name="locale" type="hidden" value="en" />
        <input name="returnTo" type="hidden" value={returnTo} />
        <button aria-pressed={active === "en"} className={`${buttonClass} ${active === "en" ? "bg-white text-[#0d0d0d] shadow-sm" : "text-black/55 hover:text-black"}`} role={menuItems ? "menuitem" : undefined} type="submit">
          {fullLabels ? "English" : "EN"}
        </button>
      </form>
      <form action={setLocaleAction}>
        <input name="locale" type="hidden" value="nl" />
        <input name="returnTo" type="hidden" value={returnTo} />
        <button aria-pressed={active === "nl"} className={`${buttonClass} ${active === "nl" ? "bg-white text-[#0d0d0d] shadow-sm" : "text-black/55 hover:text-black"}`} role={menuItems ? "menuitem" : undefined} type="submit">
          {fullLabels ? "Nederlands" : "NL"}
        </button>
      </form>
    </div>
  );
}
