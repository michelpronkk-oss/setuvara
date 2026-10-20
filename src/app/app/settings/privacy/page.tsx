import Link from "next/link";
import { redirect } from "next/navigation";

import { formatConfirmationCode, KIND_LABEL, STATUS_LABEL, type PrivacyKind, type PrivacyStatus } from "@/lib/privacy/model";
import { SOCIAL_NAME, type SocialProvider } from "@/lib/social/model";
import { SETTINGS_PATH } from "@/lib/social/routes";
import { createClient } from "@/lib/supabase/server";
import { AccountDeletion } from "./account-deletion";

export const metadata = { title: "Privacy & data | Setuvara", robots: { index: false } };

type Request = { kind: PrivacyKind; status: PrivacyStatus; confirmation_code: string; created_at: string };

const date = (value: string) => new Date(value).toLocaleDateString("en", { day: "numeric", month: "short", year: "numeric" });

export default async function PrivacySettingsPage() {
  const supabase = await createClient();
  const { data: claims, error } = await supabase.auth.getClaims();
  const userId = typeof claims?.claims?.sub === "string" ? claims.claims.sub : null;
  if (error || !userId) redirect("/login?next=/app/settings/privacy");

  const [{ data: profile }, { data: accounts }, { data: requests }] = await Promise.all([
    supabase.from("profiles").select("username").eq("id", userId).maybeSingle(),
    supabase.from("social_accounts").select("provider, username").eq("profile_id", userId),
    supabase.from("privacy_requests").select("kind, status, confirmation_code, created_at").order("created_at", { ascending: false }).limit(10),
  ]);
  const history = (requests ?? []) as Request[];
  const open = history.find((item) => item.kind === "account_deletion" && (item.status === "received" || item.status === "processing")) ?? null;
  const connected = (accounts ?? []) as { provider: SocialProvider; username: string }[];
  const card = "rounded-[22px] bg-white px-5 py-5 shadow-[inset_0_0_0_1px_rgba(13,13,13,.1)] sm:px-6";

  return <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
    <p className="font-label text-[11px] font-bold uppercase tracking-[0.18em] text-black/50">Settings</p>
    <h1 className="mt-3 font-display text-3xl font-bold tracking-[-0.045em]">Privacy &amp; data</h1>
    <p className="mt-3 text-[15px] leading-6 text-black/60">Disconnect platforms, delete what Setuvara read from them, or ask us to delete your account. <Link className="font-semibold text-black underline underline-offset-4" href="/data-deletion">How deletion works</Link></p>

    <section aria-labelledby="platforms-title" className={`mt-7 ${card}`}>
      <h2 className="text-[17px] font-semibold tracking-[-0.01em]" id="platforms-title">Connected platforms</h2>
      <p className="mt-1 text-[14px] leading-5 text-black/55">Disconnecting deletes the sign-in, its tokens and the details and counts we read. Your Setuvara account stays.</p>
      {connected.length
        ? <ul className="mt-3 divide-y divide-black/[0.08]">{connected.map((item) => <li className="flex min-h-12 items-center justify-between gap-3 py-2 text-[15px]" key={item.provider}><span className="font-semibold">{SOCIAL_NAME[item.provider]}</span><span className="truncate text-black/55">{item.username ? `@${item.username.replace(/^@/, "")}` : "Connected"}</span></li>)}</ul>
        : <p className="mt-3 text-[15px] text-black/60">No platforms connected.</p>}
      <Link className="mt-3 inline-flex min-h-11 items-center rounded-full bg-[#f5f4ef] px-4 text-sm font-semibold hover:bg-[#ecebe4] focus-visible:outline-2 focus-visible:outline-offset-2" href={SETTINGS_PATH}>Manage connected accounts</Link>
    </section>

    <AccountDeletion open={open ? { code: formatConfirmationCode(open.confirmation_code), status: open.status } : null} username={(profile?.username as string | undefined) ?? ""} />

    {history.length > 0 && <section aria-labelledby="requests-title" className={`mt-5 ${card}`}>
      <h2 className="text-[17px] font-semibold tracking-[-0.01em]" id="requests-title">Your requests</h2>
      <ul className="mt-2 divide-y divide-black/[0.08]">
        {history.map((item) => <li className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3" key={item.confirmation_code}>
          <span className="min-w-0"><span className="block text-[15px] font-semibold">{KIND_LABEL[item.kind]}</span><span className="block font-label text-[11px] tracking-[0.08em] text-black/50">{formatConfirmationCode(item.confirmation_code)} · {date(item.created_at)}</span></span>
          <Link className="text-[14px] font-semibold underline underline-offset-4" href={`/data-deletion/status?code=${item.confirmation_code}`}>{STATUS_LABEL[item.status]}</Link>
        </li>)}
      </ul>
    </section>}
  </main>;
}
