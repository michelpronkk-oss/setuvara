"use client";

import { confirmDialog } from "@/components/app/confirm-dialog";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Toggle } from "@/app/app/identity/editor-ui";
import type { ProfileLink } from "@/components/profile/types";
import { platformAccounts, relativeTime } from "@/lib/creator/studio";
import { accountState, ACCOUNT_STATE_LABEL, AUDIENCE_NOUN, combinedAudience, COMBINED_LABEL, COMBINED_NOTE, COUNT_NOTE, formatAudience, SOCIAL_NAME, SOCIAL_PROVIDERS, type SocialAccount, type SocialProvider } from "@/lib/social/model";
import { createClient } from "@/lib/supabase/client";
import { Mono, PlatformTile } from "./studio-ui";

const NOTICES: Record<string, string> = {
  unavailable: "That platform's sign-in isn't switched on yet.",
  expired: "The sign-in took too long or came from another browser. Try again.",
  cancelled: "Sign-in was cancelled. Nothing changed.",
  failed: "The platform didn't confirm the sign-in. Try again.",
  taken: "That account is already connected to another Setuvara member.",
  "not-professional": "Instagram only shares numbers for professional accounts. Switch to a creator or business account in Instagram, then connect again.",
  "no-account": "That sign-in has no channel or profile to connect.",
};
const STATE_TONE = { synced: "bg-[#0D0D0D] text-[#F5F4EF]", outdated: "bg-[#FFE7B8]", needs_reauth: "bg-[#FF5A4F]", error: "bg-[#E6E4DC]" } as const;

/**
 * Platforms connected through their own sign-in, with counts read from the platform. Links typed
 * into the page stay links: they show a handle and never a number.
 */
export function ConnectedAccounts({ accounts, ready, links, profileId, notice }: { accounts: SocialAccount[]; ready: Record<SocialProvider, boolean>; links: ProfileLink[]; profileId: string; notice: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const combined = combinedAudience(accounts);
  const manual = platformAccounts(links).filter((item) => item.link);
  const connectedNotice = notice?.startsWith("connected-") ? notice.slice(10) : null;
  const anyReady = SOCIAL_PROVIDERS.some((provider) => ready[provider]);

  async function post(provider: SocialProvider, what: "refresh" | "disconnect") {
    setBusy(`${provider}:${what}`);
    setMessage(null);
    const response = await fetch(`/api/social/${provider}/${what}`, { method: "POST", headers: { "x-setuvara-request": "same-origin" } }).catch(() => null);
    const result = await response?.json().catch(() => null) as { error?: string; status?: string } | null;
    setBusy(null);
    if (!response?.ok) setMessage(result?.error ?? (result?.status === "needs_reauth" ? `${SOCIAL_NAME[provider]} asked you to sign in again.` : "That didn't work. Try again."));
    router.refresh();
  }
  async function setShown(account: SocialAccount, show: boolean) {
    setBusy(`${account.provider}:show`);
    await createClient().from("social_accounts").update({ show_on_page: show }).eq("id", account.id).eq("profile_id", profileId);
    setBusy(null);
    router.refresh();
  }

  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_340px] xl:gap-10">
      <div className="min-w-0">
        <h1 className="border-b-[1.5px] border-[#0D0D0D] pb-4 font-display text-[38px] font-bold leading-none tracking-[-0.05em] md:text-[44px]">Connected accounts</h1>
        <div className="flex items-center justify-between gap-3 pt-3">
          <p className="text-[15px] text-black/65">Sign in with a platform to show its verified count.</p>
          {combined && <Mono className="shrink-0 text-black/55" style={{ letterSpacing: "0.12em" }}>{formatAudience(combined.total)} · SUM OF {combined.platforms}</Mono>}
        </div>
        {(notice || message) && (
          <p className={`mt-3 rounded-2xl px-4 py-3 text-[15px] ${connectedNotice ? "bg-[#C7FF4A]" : "bg-[#FFE7B8]"}`} role="status">
            {message ?? (connectedNotice ? `${SOCIAL_NAME[connectedNotice as SocialProvider] ?? "Account"} is connected.` : NOTICES[notice ?? ""] ?? "Something went wrong. Try again.")}
          </p>
        )}

        <ul className="mt-3 divide-y divide-black/10 border-y border-black/10">
          {SOCIAL_PROVIDERS.map((provider) => {
            const account = accounts.find((item) => item.provider === provider);
            const state = account ? accountState(account) : null;
            return (
              <li className="flex flex-wrap items-center gap-x-4 gap-y-3 py-4" data-provider={provider} key={provider}>
                {account?.avatar_url
                  ? <span className="relative shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element -- avatar from the platform's own CDN */}
                      <img alt="" className="size-12 rounded-[14px] object-cover" referrerPolicy="no-referrer" src={account.avatar_url} />
                      <span className="absolute -bottom-1 -right-1"><PlatformTile size={22} type={provider} /></span>
                    </span>
                  : <PlatformTile className={account ? "" : "opacity-45"} size={48} type={provider} />}
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-[17px] font-semibold">{account ? (account.username ? (provider === "youtube" || account.username.startsWith("@") ? account.username : `@${account.username}`) : account.display_name || SOCIAL_NAME[provider]) : SOCIAL_NAME[provider]}</span>
                    {state && <span className={`shrink-0 rounded-[5px] px-1.5 py-[3px] font-label text-[10px] tracking-[0.12em] ${STATE_TONE[state]}`}>{ACCOUNT_STATE_LABEL[state].toUpperCase()}</span>}
                  </span>
                  <span className="block truncate text-[14px] text-black/60">
                    {account
                      ? [
                          account.audience_hidden ? `${SOCIAL_NAME[provider]} hides this count` : account.audience_count === null ? "Count unavailable" : `${account.audience_count.toLocaleString("en")} ${AUDIENCE_NOUN[provider]}`,
                          account.last_synced_at ? `checked ${relativeTime(account.last_synced_at)}` : null,
                          COUNT_NOTE[provider] || null,
                        ].filter(Boolean).join(" · ")
                      : ready[provider] ? `Shows your ${AUDIENCE_NOUN[provider]} from ${SOCIAL_NAME[provider]}` : "Sign-in not available yet"}
                  </span>
                </span>
                <span className="flex shrink-0 flex-wrap items-center gap-2">
                  {account ? (
                    <>
                      <label className="flex items-center gap-2 rounded-full bg-white py-0.5 pl-3.5 pr-0.5 text-sm font-semibold"><span>On page</span><Toggle disabled={busy !== null} label={`Show ${SOCIAL_NAME[provider]} on page`} on={account.show_on_page} onChange={(next) => void setShown(account, next)} /></label>
                      {state === "needs_reauth" && ready[provider]
                        ? <a className="inline-flex min-h-11 items-center rounded-full bg-[#0D0D0D] px-4 text-sm font-semibold text-[#F5F4EF]" href={`/api/social/${provider}/start`}>Sign in again</a>
                        : ready[provider] && <button className="inline-flex min-h-11 items-center rounded-full px-3 text-sm font-semibold text-black/70 hover:bg-black/[0.04] disabled:opacity-50" disabled={busy !== null} onClick={() => void post(provider, "refresh")} type="button">{busy === `${provider}:refresh` ? "Checking…" : "Refresh"}</button>}
                      <button className="inline-flex min-h-11 items-center rounded-full px-3 text-sm font-semibold text-black/70 hover:bg-black/[0.04] disabled:opacity-50" disabled={busy !== null} onClick={async () => { if (await confirmDialog({ title: `Disconnect ${SOCIAL_NAME[provider]}?`, body: "Setuvara deletes its numbers and sign-in.", action: "Disconnect", tone: "danger" })) void post(provider, "disconnect"); }} type="button">Disconnect</button>
                    </>
                  ) : ready[provider]
                    ? <a className="inline-flex min-h-11 items-center rounded-full bg-[#0D0D0D] px-4 text-sm font-semibold text-[#F5F4EF] focus-visible:outline-2 focus-visible:outline-offset-2" href={`/api/social/${provider}/start`}>Connect {SOCIAL_NAME[provider]}</a>
                    : <span className="font-label text-[11px] tracking-[0.12em] text-black/45">SOON</span>}
                </span>
              </li>
            );
          })}
          <li className="flex items-center gap-4 py-4" data-provider="x">
            <PlatformTile className="opacity-45" size={48} type="x" />
            <span className="min-w-0 flex-1"><span className="block text-[17px] font-semibold">X</span><span className="block truncate text-[14px] text-black/60">Link only · X doesn&apos;t share follower counts with apps like Setuvara</span></span>
          </li>
        </ul>

        {manual.length > 0 && (
          <section className="pt-7">
            <h2 className="text-[17px] font-semibold">Links on your page</h2>
            <p className="text-[14px] text-black/60">These show a handle. They never show a number.</p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {manual.map((item) => <li className="flex items-center gap-2 rounded-full bg-white py-1 pl-1 pr-3 text-[14px] font-semibold shadow-[inset_0_0_0_1px_rgba(13,13,13,.08)]" key={item.platform}><PlatformTile size={26} type={item.platform} />{item.handle || item.link?.title}<span className="font-label text-[10px] tracking-[0.12em] text-black/45">LINK</span></li>)}
            </ul>
            <Link className="mt-3 inline-block text-[14px] font-semibold underline underline-offset-4" href="/app/identity?mode=creator&section=links">Edit links</Link>
          </section>
        )}
      </div>

      <aside className="flex h-fit flex-col gap-4 rounded-[26px] bg-[#E8E2D4] p-6" style={{ clipPath: "polygon(0 0,100% 0,100% calc(100% - 44px),calc(100% - 25px) 100%,0 100%)" }}>
        <Mono className="text-black/70">How counts work</Mono>
        <p className="font-display text-[26px] font-bold leading-[1.05] tracking-[-0.04em]">Numbers come from each platform, never from you.</p>
        <p className="text-[15px] leading-[1.5] text-black/75">You sign in with the platform once. Setuvara reads your handle, picture and audience count and checks again every few hours. It can&apos;t post, read messages or see anything private.</p>
        <p className="text-[14px] leading-[1.5] text-black/65"><span className="font-semibold text-black">{COMBINED_LABEL}.</span> {COMBINED_NOTE}</p>
        {!anyReady && <p className="border-t border-black/15 pt-4 text-[13px] leading-[1.45] text-black/65">Platform sign-in is being set up. Until then your page shows handles from your links, never typed-in numbers.</p>}
      </aside>
    </div>
  );
}
