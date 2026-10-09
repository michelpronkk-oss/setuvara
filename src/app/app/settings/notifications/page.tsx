import Link from "next/link";
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
  { key: "connection_emails", label: "Connection emails", description: "A person you met joins your Setuvara network." },
  { key: "connection_recaps", label: "Connection recaps", description: "A grouped note about several recent connections." },
  { key: "passport_milestones", label: "Passport milestones", description: "A real connection unlocks a Passport milestone." },
  { key: "passport_stamps", label: "Passport stamps", description: "A real meeting adds a place or event stamp." },
  { key: "lifecycle_emails", label: "Getting started", description: "Welcome guidance after your email is confirmed." },
  { key: "product_updates", label: "Product updates", description: "Occasional updates about Setuvara. Off until you opt in." },
];

export default async function NotificationSettingsPage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  const supabase = await createClient();
  const [{ data: claims, error: authError }, query] = await Promise.all([supabase.auth.getClaims(), searchParams]);
  const userId = typeof claims?.claims?.sub === "string" ? claims.claims.sub : null;
  if (authError || !userId) redirect("/login?next=/app/settings/notifications");

  const { data } = await supabase.from("notification_preferences").select("connection_emails,connection_recaps,passport_milestones,passport_stamps,lifecycle_emails,product_updates").eq("user_id", userId).maybeSingle();
  const preferences = { ...defaults, ...(data ?? {}) };

  return <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-7 sm:py-12">
    <Link className="text-sm font-semibold text-black/55 underline underline-offset-4" href="/app">← Back to Setuvara</Link>
    <p className="mt-10 text-[10px] font-bold tracking-[0.2em] text-[#ff5a4f]">YOUR ACCOUNT</p>
    <h1 className="mt-3 text-4xl font-semibold tracking-[-0.06em] sm:text-5xl">Email preferences</h1>
    <p className="mt-3 max-w-xl text-sm leading-6 text-black/55">Choose the Setuvara updates that reach your inbox. Your connections and Passport stay yours either way.</p>

    {query.saved === "1" ? <p role="status" className="mt-6 rounded-2xl bg-white px-4 py-3 text-sm font-medium">Preferences saved.</p> : null}
    {query.error === "save" ? <p role="alert" className="mt-6 rounded-2xl bg-white px-4 py-3 text-sm font-medium text-red-700">We could not save those preferences. Please try again.</p> : null}

    <form action={saveNotificationPreferences} className="mt-8">
      <fieldset className="rounded-[1.75rem] bg-white px-5 sm:px-7">
        <legend className="sr-only">Optional Setuvara email categories</legend>
        {controls.map((control, index) => <label className={`flex min-h-[76px] cursor-pointer items-center justify-between gap-5 py-4 ${index ? "border-t border-black/10" : ""}`} key={control.key}>
          <span><span className="block text-sm font-semibold">{control.label}</span><span className="mt-1 block text-xs leading-5 text-black/50">{control.description}</span></span>
          <input aria-label={control.label} className="size-5 shrink-0 accent-[#0d0d0d] focus-visible:outline-2 focus-visible:outline-offset-4" defaultChecked={preferences[control.key]} name={control.key} type="checkbox" />
        </label>)}
      </fieldset>

      <section aria-label="Account security emails" className="mt-5 rounded-[1.75rem] border border-black/10 px-5 py-5 sm:px-7">
        <div className="flex items-start justify-between gap-4"><div><p className="text-sm font-semibold">Account security</p><p className="mt-1 text-xs leading-5 text-black/50">Sign-in, password, and address security notices.</p></div><span className="rounded-full bg-[#f5f4ef] px-3 py-1 text-[10px] font-bold tracking-wide">ALWAYS ON</span></div>
      </section>
      <button className="mt-6 inline-flex min-h-12 items-center justify-center rounded-full bg-[#0d0d0d] px-6 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-4" type="submit">Save preferences</button>
    </form>
  </main>;
}
