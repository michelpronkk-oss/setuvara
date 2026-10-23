import Link from "next/link";
import { redirect } from "next/navigation";

import { formatChangeDate, HANDLE_CHANGE_RULE, parseChangeState } from "@/lib/handles/change-window";
import { createClient } from "@/lib/supabase/server";
import { EmailForm, PasswordForm } from "./account-forms";

export const metadata = { title: "Email & password | Setuvara", robots: { index: false } };

const NOTICES: Record<string, { text: string; tone: "ok" | "bad" }> = {
  changed: { text: "Your email is changed. Use it next time you sign in.", tone: "ok" },
  "confirm-other": { text: "One link confirmed. Open the link we sent to your other address to finish.", tone: "ok" },
  failed: { text: "That link has expired or was already used. Ask for a new one below.", tone: "bad" },
};

export default async function AccountSettingsPage({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  const supabase = await createClient();
  const [{ data: auth, error }, query] = await Promise.all([supabase.auth.getUser(), searchParams]);
  const user = auth?.user;
  if (error || !user) redirect("/login?next=/app/settings/account");

  const [{ data: profile }, { data: nextChange }] = await Promise.all([
    supabase.from("profiles").select("username").eq("id", user.id).maybeSingle(),
    supabase.rpc("handle_change_state", { p_mode: "personal" }),
  ]);
  const username = (profile?.username as string | undefined) ?? "";
  const lockedUntil = parseChangeState(nextChange).nextChangeAt;
  const notice = query.email ? NOTICES[query.email] : undefined;
  const card = "rounded-[22px] bg-white px-5 py-5 shadow-[inset_0_0_0_1px_rgba(13,13,13,.1)] sm:px-6";

  return <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
    <Link className="font-label text-[11px] font-bold uppercase tracking-[0.18em] text-black/50 hover:text-black" href="/app/settings">Settings</Link>
    <h1 className="mt-3 font-display text-3xl font-bold tracking-[-0.045em]">Email &amp; password</h1>
    <p className="mt-3 text-[15px] leading-6 text-black/60">How you sign in to Setuvara. Changes ask for your current password first.</p>

    {notice && <p className={`mt-6 rounded-2xl px-4 py-3 text-[14px] font-medium ${notice.tone === "ok" ? "bg-[#2BB673]/[0.12] text-[#17713f]" : "bg-[#FF5A4F]/[0.12] text-[#b3261e]"}`} data-account-notice={query.email} role="status">{notice.text}</p>}

    <EmailForm current={user.email ?? ""} pending={user.new_email ?? null} />
    <PasswordForm email={user.email ?? ""} />

    {username && <section aria-labelledby="username-title" className={`mt-5 ${card}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[17px] font-semibold tracking-[-0.01em]" id="username-title">Username</h2>
          <p className="mt-1 truncate text-[15px] text-black/70">@{username}</p>
        </div>
        <Link className="inline-flex min-h-11 items-center rounded-full bg-[#f5f4ef] px-4 text-sm font-semibold hover:bg-[#ecebe4] focus-visible:outline-2 focus-visible:outline-offset-2" href="/app/identity?mode=personal&section=settings">Change username</Link>
      </div>
      <p className="mt-2 text-[13.5px] leading-5 text-black/55" data-username-lock={lockedUntil ?? ""}>{lockedUntil ? `You changed it recently. You can change it again on ${formatChangeDate(lockedUntil, "en")}.` : `${HANDLE_CHANGE_RULE} Your old link stays yours for 30 days and redirects to the new one.`}</p>
    </section>}
  </main>;
}
