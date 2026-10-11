import { redirect } from "next/navigation";

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
      <p className="mt-3 text-[15px] leading-6 text-black/65">Your region is stored separately and does not change Setuvara’s English interface.</p>
      <section className="mt-7 rounded-[22px] bg-white p-5 shadow-[inset_0_0_0_1px_rgba(13,13,13,.1)] sm:p-6">
        <h2 className="font-semibold">Your region</h2>
        <p className="mt-1 text-sm leading-6 text-black/55">Region is kept as account data for regional context.</p>
        <p className="mt-3 text-sm font-medium">{region ?? "—"}</p>
      </section>
    </main>
  );
}