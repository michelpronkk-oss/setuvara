"use client";

import Link from "next/link";
import { useEffect, useId, useState, useSyncExternalStore } from "react";

import { onOpenConsentPreferences, openConsentPreferences, setConsent, useConsent } from "@/lib/consent";

const noop = () => () => {};

function Mark({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} fill="currentColor" viewBox="0 0 100 100">
      <path d="M66.62 10.38A26 26 0 1 0 37 52.89L43.25 56.49L52.25 40.91L46 37.3A8 8 0 1 1 57.15 26.78Z" />
      <path d="M33.38 89.62A26 26 0 1 0 63 47.11L56.75 43.51L47.75 59.09L54 62.7A8 8 0 1 1 42.85 73.22Z" />
    </svg>
  );
}

/**
 * The cookie panel: shown once until the visitor chooses, and again from "Cookie settings".
 * Essentials are always on; the only choice is whether third-party media players load.
 */
export function CookieConsent() {
  const hydrated = useSyncExternalStore(noop, () => true, () => false);
  // The admin console (admin.setuvara.com) sets only essential sign-in cookies, so it never asks.
  const adminSurface = useSyncExternalStore(noop, () => document.querySelector("[data-setuvara-admin]") !== null, () => false);
  const { choice } = useConsent();
  const [open, setOpen] = useState(false);
  const [details, setDetails] = useState(false);
  const [media, setMedia] = useState(true);
  const id = useId();

  useEffect(() => onOpenConsentPreferences(() => { setMedia(choice !== "essential"); setDetails(true); setOpen(true); }), [choice]);

  const visible = hydrated && !adminSurface && (open || choice === "unset");
  if (!visible) return null;

  const save = (value: "essential" | "media") => { setConsent(value); setOpen(false); setDetails(false); };

  return (
    <section
      aria-labelledby={`${id}-title`}
      className="fixed inset-x-3 bottom-3 z-[90] mx-auto max-w-[440px] rounded-[1.75rem] bg-[#0d0d0d] p-5 text-[#f5f4ef] shadow-[0_40px_80px_-30px_rgba(0,0,0,.7),inset_0_0_0_1px_rgba(245,244,239,.08)] [animation:sv-modal-in_.45s_cubic-bezier(.2,.8,.2,1)] sm:inset-x-auto sm:bottom-5 sm:left-5 sm:p-6"
      role="dialog"
    >
      <div className="flex items-start gap-3.5">
        <span className="grid size-10 shrink-0 place-items-center rounded-[12px] bg-[#ff5a4f] text-[#0d0d0d]"><Mark className="size-6" /></span>
        <div className="min-w-0">
          <h2 className="font-display text-[19px] font-bold leading-tight tracking-[-0.03em]" id={`${id}-title`}>Cookies, kept to a minimum.</h2>
          <p className="mt-1.5 text-[13.5px] leading-[1.5] text-[#f5f4ef]/70">Setuvara only uses what it needs to work. Music and video players from Spotify, YouTube and others can set their own. <Link className="font-semibold text-[#f5f4ef] underline underline-offset-4 hover:text-[#ff5a4f]" href="/cookies">Cookie policy</Link></p>
        </div>
      </div>

      {details ? (
        <ul className="mt-5 divide-y divide-[#f5f4ef]/10 rounded-2xl bg-[#f5f4ef]/[0.05] px-4 shadow-[inset_0_0_0_1px_rgba(245,244,239,.08)]">
          <li className="flex items-center justify-between gap-4 py-3.5">
            <span><span className="block text-[14px] font-semibold">Essential</span><span className="block text-[12px] text-[#f5f4ef]/55">Sign-in, guest connections and Connection Passes.</span></span>
            <span className="shrink-0 font-label text-[10px] uppercase tracking-[0.14em] text-[#f5f4ef]/50">Always on</span>
          </li>
          <li className="flex items-center justify-between gap-4 py-3.5">
            <label className="min-w-0 cursor-pointer" htmlFor={`${id}-media`}><span className="block text-[14px] font-semibold">Media players</span><span className="block text-[12px] text-[#f5f4ef]/55">Spotify, SoundCloud, Apple Music, Deezer and YouTube on profiles.</span></label>
            <button aria-checked={media} className={`relative h-7 w-12 shrink-0 rounded-full transition-colors duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff5a4f] ${media ? "bg-[#ff5a4f]" : "bg-[#f5f4ef]/20"}`} id={`${id}-media`} onClick={() => setMedia((value) => !value)} role="switch" type="button">
              <span className={`absolute top-1 size-5 rounded-full bg-[#f5f4ef] shadow transition-[left] duration-300 ${media ? "left-6" : "left-1"}`} />
            </button>
          </li>
        </ul>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center gap-2">
        {details ? (
          <button className="inline-flex min-h-11 flex-1 items-center justify-center rounded-full bg-[#ff5a4f] px-5 text-[14px] font-semibold text-[#0d0d0d] transition hover:brightness-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f5f4ef]" onClick={() => save(media ? "media" : "essential")} type="button">Save choice</button>
        ) : (
          <>
            <button className="inline-flex min-h-11 flex-1 items-center justify-center rounded-full bg-[#ff5a4f] px-5 text-[14px] font-semibold text-[#0d0d0d] transition hover:brightness-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f5f4ef]" onClick={() => save("media")} type="button">Allow all</button>
            <button className="inline-flex min-h-11 flex-1 items-center justify-center rounded-full bg-[#f5f4ef]/10 px-5 text-[14px] font-semibold transition hover:bg-[#f5f4ef]/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f5f4ef]" onClick={() => save("essential")} type="button">Essentials only</button>
            <button className="inline-flex min-h-11 items-center px-2 text-[13px] font-semibold text-[#f5f4ef]/70 underline underline-offset-4 hover:text-[#f5f4ef] focus-visible:outline-2 focus-visible:outline-[#f5f4ef]" onClick={() => { setMedia(true); setDetails(true); }} type="button">Choose</button>
          </>
        )}
      </div>
    </section>
  );
}

/** A plain text button that reopens the cookie panel. */
export function CookieSettingsButton({ className = "" }: { className?: string }) {
  return <button className={className} onClick={openConsentPreferences} type="button">Cookie settings</button>;
}
