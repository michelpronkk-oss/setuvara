import { redirect } from "next/navigation";

import { formatCountryName } from "@/lib/i18n/countries";
import { resolveRequestRegion } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Region" };

export default async function RegionSettingsPage() {
  const supabase = await createClient();
  const { data: claims, error } = await supabase.auth.getClaims();
  const userId = !error && typeof claims?.claims?.sub === "string" ? claims.claims.sub : null;
  if (!userId) redirect("/login?next=/app/settings/region");
  const region = await resolveRequestRegion({ supabase, userId });

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
      <p className="font-label text-[11px] font-bold uppercase tracking-[0.18em] text-black/50">Settings</p>
      <h1 className="mt-3 font-display text-3xl font-bold tracking-[-0.045em]">Region</h1>
      <section className="mt-7 flex min-h-[72px] items-center justify-between gap-4 rounded-[22px] bg-white px-5 py-4 shadow-[inset_0_0_0_1px_rgba(13,13,13,.1)] sm:px-6">
        <span className="min-w-0"><span className="block text-[15px] font-semibold">Your region</span><span className="mt-0.5 block text-[13px] leading-5 text-black/50">Setuvara stays in English either way.</span></span>
        <span className="shrink-0 text-sm font-semibold text-black/70">{region ? formatCountryName(region, "en") : "Not set"}</span>
      </section>
    </main>
  );
}