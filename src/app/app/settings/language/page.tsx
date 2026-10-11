import { createClient } from "@/lib/supabase/server";
import { resolveRequestLocale, resolveRequestRegion } from "@/lib/i18n/server";
import { getMessages } from "@/lib/i18n/messages";
import { LocaleToggle } from "@/components/i18n/locale-toggle";

export const metadata = { title: "Language" };

export default async function LanguageSettingsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const [query, supabase] = await Promise.all([searchParams, createClient()]);
  const { data: claims, error } = await supabase.auth.getClaims();
  const userId = !error && typeof claims?.claims?.sub === "string" ? claims.claims.sub : null;
  const [locale, region] = await Promise.all([
    resolveRequestLocale({ supabase, userId }),
    resolveRequestRegion({ supabase, userId }),
  ]);
  const copy = getMessages(locale);

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
      <p className="font-label text-[11px] font-bold uppercase tracking-[0.18em] text-black/50">{copy.common.settings}</p>
      <h1 className="mt-3 font-display text-3xl font-bold tracking-[-0.045em]">{copy.settings.languageTitle}</h1>
      <p className="mt-3 text-[15px] leading-6 text-black/65">{copy.settings.languageDescription}</p>
      {query.status === "error" && <p aria-live="polite" className="mt-5 rounded-xl bg-[#ffe9e6] px-4 py-3 text-sm text-[#8b2f28]">{copy.settings.error}</p>}
      <section className="mt-7 flex flex-wrap items-center justify-between gap-5 rounded-[22px] bg-white p-5 shadow-[inset_0_0_0_1px_rgba(13,13,13,.1)] sm:p-6">
        <div>
          <h2 className="font-semibold">{copy.common.language}</h2>
          <p className="mt-1 text-sm text-black/55">{locale}</p>
        </div>
        <LocaleToggle fullLabels locale={locale} returnTo="/app/settings/language" />
      </section>
      <section className="mt-5 rounded-[22px] bg-white p-5 shadow-[inset_0_0_0_1px_rgba(13,13,13,.1)] sm:p-6">
        <h2 className="font-semibold">{copy.settings.regionTitle}</h2>
        <p className="mt-1 text-sm leading-6 text-black/55">{copy.settings.regionDescription}</p>
        <p className="mt-3 text-sm font-medium">{region ?? "—"}</p>
      </section>
    </main>
  );
}
