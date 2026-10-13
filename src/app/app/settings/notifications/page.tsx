import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { saveNotificationPreferences } from "./actions";

type Preferences = {
  connection_emails: boolean;
  connection_recaps: boolean;
  passport_milestones: boolean;
  passport_stamps: boolean;
  lifecycle_emails: boolean;
  product_updates: boolean;
};

const defaults: Preferences = {
  connection_emails: true,
  connection_recaps: true,
  passport_milestones: true,
  passport_stamps: true,
  lifecycle_emails: true,
  product_updates: false,
};

const controls: { key: keyof Preferences; label: string; description: string }[] = [
  { key: "connection_emails", label: "New connections", description: "Someone you met joins your network." },
  { key: "connection_recaps", label: "Connection recaps", description: "One note for several new people." },
  { key: "passport_milestones", label: "Passport milestones", description: "You reach a new Passport milestone." },
  { key: "passport_stamps", label: "Passport stamps", description: "A meeting adds a place or event stamp." },
  { key: "lifecycle_emails", label: "Getting started", description: "A few tips after you join." },
  { key: "product_updates", label: "Product updates", description: "Occasional news. Off until you opt in." },
];

export default async function NotificationSettingsPage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  const supabase = await createClient();
  const [{ data: claims, error: authError }, query] = await Promise.all([supabase.auth.getClaims(), searchParams]);
  const userId = typeof claims?.claims?.sub === "string" ? claims.claims.sub : null;
  if (authError || !userId) redirect("/login?next=/app/settings/notifications");

  const { data } = await supabase.from("notification_preferences").select("connection_emails,connection_recaps,passport_milestones,passport_stamps,lifecycle_emails,product_updates").eq("user_id", userId).maybeSingle();
  const preferences = { ...defaults, ...(data ?? {}) };

  return <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
    <p className="font-label text-[11px] font-bold uppercase tracking-[0.18em] text-black/50">Settings</p>
    <h1 className="mt-3 font-display text-3xl font-bold tracking-[-0.045em]">Email preferences</h1>
    <p className="mt-3 text-[15px] leading-6 text-black/60">What reaches your inbox. Your people and Passport stay either way.</p>

    {query.saved === "1" ? <p role="status" className="mt-6 flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-medium"><span aria-hidden="true" className="size-1.5 rounded-full bg-[#2fa66a]" />Preferences saved.</p> : null}
    {query.error === "save" ? <p role="alert" className="mt-6 rounded-2xl bg-white px-4 py-3 text-sm font-medium text-red-700">We could not save those preferences. Please try again.</p> : null}

    <form action={saveNotificationPreferences} className="mt-7">
      <fieldset className="rounded-[22px] bg-white px-5 shadow-[inset_0_0_0_1px_rgba(13,13,13,.1)] sm:px-6">
        <legend className="sr-only">Optional Setuvara email categories</legend>
        {controls.map((control, index) => <label className={`flex min-h-[72px] cursor-pointer items-center justify-between gap-4 py-4 ${index ? "border-t border-black/[0.08]" : ""}`} key={control.key}>
          <span className="min-w-0"><span className="block text-[15px] font-semibold tracking-[-0.01em]">{control.label}</span><span className="mt-0.5 block text-[13px] leading-5 text-black/50">{control.description}</span></span>
          <span className="relative inline-flex h-11 w-[52px] shrink-0 items-center justify-center">
            <input aria-label={control.label} className="peer absolute inset-0 size-full cursor-pointer appearance-none rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0d0d0d]" defaultChecked={preferences[control.key]} name={control.key} role="switch" type="checkbox" />
            <span aria-hidden="true" className="pointer-events-none absolute h-[26px] w-[46px] rounded-full bg-black/20 transition-colors peer-checked:bg-[#0d0d0d]" />
            <span aria-hidden="true" className="pointer-events-none absolute size-5 -translate-x-[10px] rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-[10px]" />
          </span>
        </label>)}
        <div className="flex min-h-[72px] items-center justify-between gap-4 border-t border-black/[0.08] py-4">
          <span className="min-w-0"><span className="block text-[15px] font-semibold tracking-[-0.01em]">Account security</span><span className="mt-0.5 block text-[13px] leading-5 text-black/50">Sign-in, password and address notices.</span></span>
          <span className="shrink-0 whitespace-nowrap rounded-full bg-[#f5f4ef] px-3 py-1.5 font-label text-[10px] font-bold uppercase tracking-[0.12em] text-black/60">Always on</span>
        </div>
      </fieldset>
      <button className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-[#0d0d0d] px-6 text-[15px] font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-4 sm:w-auto" type="submit">Save preferences</button>
    </form>
  </main>;
}
