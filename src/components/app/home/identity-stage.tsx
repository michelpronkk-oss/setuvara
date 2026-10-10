"use client";

import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { recordProfileShare } from "@/lib/analytics/client";
import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore, type MouseEvent, type KeyboardEvent as ReactKeyboardEvent } from "react";

import { StatusBadge } from "@/components/app/status-badge";
import { meetMarkBottom, meetMarkTop } from "@/components/marketing/brand";
import type { ModeSlug } from "@/components/profile/types";
import { FocusedPhoto } from "@/components/profile/focused-photo";
import type { PhotoFocus } from "@/components/profile/photo-focus";
import type { PlanCode } from "@/lib/billing/catalog";
import type { ConnectPolicy } from "@/lib/connections/access";
import { passExpiryLabel, useConnectPass } from "@/lib/connections/use-connect-pass";

export type StageMode = { slug: ModeSlug; enabled: boolean; imageUrl: string | null; imageFocus: PhotoFocus; sub: string; line: string; configured: boolean; connectPolicy: ConnectPolicy };

const NAMES: Record<ModeSlug, string> = { personal: "Personal", event: "Event", business: "Business" };
const DOT: Record<ModeSlug, string> = { personal: "#FF5A4F", event: "#C7FF4A", business: "#AFCBFF" };
const NOTES: Record<ModeSlug, string> = {
  personal: "For friends and new people. Links, music and your note.",
  event: "Built for the room. Event, city and who you want to meet.",
  business: "Role, company and city, without the rest.",
};
// Stage corner is cut at 60°, the same crop as profile photos (see clip-path classes on the section).
const markDataUri = `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="24" fill="#FF5A4F"/><g transform="translate(17 17) scale(.66)" fill="#0D0D0D"><path d="${meetMarkTop}"/><path d="${meetMarkBottom}"/></g></svg>`)}`;
const STORAGE_KEY = "sv-home-mode";
function subscribeMode(listener: () => void) {
  window.addEventListener("storage", listener);
  window.addEventListener(STORAGE_KEY, listener);
  return () => { window.removeEventListener("storage", listener); window.removeEventListener(STORAGE_KEY, listener); };
}
function rememberedMode(): ModeSlug | null {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return saved === "personal" || saved === "event" || saved === "business" ? saved : null;
  } catch { return null; }
}
const noSubscription = () => () => {};

export function IdentityStage({ displayName, username, plan, isPublished, publicOrigin, modes, initialMode, hasRequestedMode }: {
  displayName: string; username: string; plan: PlanCode; isPublished: boolean; publicOrigin: string; modes: StageMode[]; initialMode: ModeSlug; hasRequestedMode: boolean;
}) {
  const saved = useSyncExternalStore(subscribeMode, rememberedMode, () => null);
  const [selected, setSelected] = useState<ModeSlug | null>(null);
  const slug = selected ?? (hasRequestedMode ? initialMode : saved ?? initialMode);
  const [sharing, setSharing] = useState(false);
  const [viewingPhoto, setViewingPhoto] = useState(false);
  const [failedImage, setFailedImage] = useState<string | null>(null);
  const shareButton = useRef<HTMLButtonElement>(null);
  const photoButton = useRef<HTMLButtonElement>(null);
  const mode = modes.find((item) => item.slug === slug) ?? modes[0];
  const live = isPublished && mode.enabled;
  const hasPhoto = Boolean(mode.imageUrl && mode.imageUrl !== failedImage);
  const publicUrl = useCallback((target: ModeSlug, source?: string) => {
    // Same URL format as the Identity editor's publicUrl().
    const query = new URLSearchParams();
    if (target !== "personal") query.set("mode", target);
    if (source) query.set("source", source);
    const suffix = query.toString();
    return `${publicOrigin}/${username}${suffix ? `?${suffix}` : ""}`;
  }, [publicOrigin, username]);

  const pick = useCallback((next: ModeSlug) => {
    setSelected(next);
    try { window.localStorage.setItem(STORAGE_KEY, next); window.dispatchEvent(new Event(STORAGE_KEY)); } catch { /* Selection still works without storage. */ }
  }, []);
  const openShare = (event: MouseEvent<HTMLButtonElement>) => { shareButton.current = event.currentTarget; setSharing(true); };
  const closeShare = useCallback(() => { setSharing(false); shareButton.current?.focus(); }, []);
  const closePhoto = useCallback(() => { setViewingPhoto(false); photoButton.current?.focus(); }, []);

  return (
    <>
      <section aria-label={`${NAMES[slug]} Mode`} className="relative h-[min(62dvh,470px)] overflow-hidden rounded-[28px] bg-[#0d0d0d] text-[#f5f4ef] md:h-[560px] lg:h-full lg:rounded-[30px] [clip-path:polygon(0_0,100%_0,100%_calc(100%-44px),calc(100%-25px)_100%,0_100%)] lg:[clip-path:polygon(0_0,100%_0,100%_calc(100%-64px),calc(100%-37px)_100%,0_100%)]">
        {hasPhoto ? (
          <>
            <FocusedPhoto alt="" className="[animation:fade-in_320ms_ease-out]" fetchPriority="high" focus={mode.imageFocus} key={mode.slug} onError={() => setFailedImage(mode.imageUrl)} sizes="(min-width: 1024px) 60vw, 100vw" src={mode.imageUrl!} />
            <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(to_top,rgba(13,13,13,.96)_0%,rgba(13,13,13,.7)_30%,rgba(13,13,13,0)_62%),linear-gradient(to_bottom,rgba(13,13,13,.5)_0%,rgba(13,13,13,0)_18%)]" />
          </>
        ) : (
          <>
            <span aria-hidden="true" className="pointer-events-none absolute -right-6 -top-16 select-none font-display text-[340px] font-extrabold leading-none tracking-[-0.06em] text-[#1a1a1a] lg:-right-10 lg:-top-24 lg:text-[640px]">{displayName.trim().slice(0, 1).toUpperCase() || "S"}</span>
            <Link className="absolute left-[18px] top-[58px] inline-flex min-h-11 items-center gap-2.5 rounded-full pl-2.5 pr-4 text-[13px] font-semibold shadow-[inset_0_0_0_1.5px_rgba(245,244,239,.35)] focus-visible:outline-2 lg:left-9 lg:top-[88px] lg:text-sm" href={`/app/identity?mode=${slug}&section=profile`}>
              <span aria-hidden="true" className="grid size-[22px] place-items-center rounded-full bg-[#c7ff4a] text-base leading-none text-[#0d0d0d]">+</span>Add a photo to your {NAMES[slug]} Mode
            </Link>
          </>
        )}

        <div className="absolute inset-x-5 top-5 flex items-center justify-between gap-3 lg:inset-x-7 lg:top-6">
          <span className="flex items-center gap-2.5 font-label text-[10px] tracking-[0.14em] lg:text-xs">
            <span aria-hidden="true" className="size-2 rounded-full" style={{ background: live ? "#C7FF4A" : "rgba(245,244,239,.4)" }} />
            <span className="hidden lg:inline">{NAMES[slug].toUpperCase()} MODE · </span>{live ? "LIVE" : isPublished ? "MODE OFF" : "PRIVATE"}
          </span>
          <div className="flex shrink-0 items-center gap-2">
            {hasPhoto && <button aria-label={`View full ${NAMES[slug]} Mode photo`} className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-[#0d0d0d]/70 px-3 text-xs font-semibold focus-visible:outline-2 lg:text-sm" onClick={(event) => { photoButton.current = event.currentTarget; setViewingPhoto(true); }} type="button">View full photo<span aria-hidden="true">↗</span></button>}
            {live && <a className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#0d0d0d]/70 px-3 text-xs font-semibold focus-visible:outline-2 lg:px-4 lg:text-sm" href={publicUrl(slug)} rel="noreferrer" target="_blank">View profile<span aria-hidden="true">↗</span></a>}
          </div>
        </div>

        <div className="absolute inset-x-5 bottom-6 flex flex-col gap-6 lg:inset-x-9 lg:bottom-8 lg:gap-[26px]">
          <div className="flex max-w-[820px] flex-col gap-2 pr-5 lg:gap-3">
            <p className="font-label text-[10px] tracking-[0.14em] text-[#f5f4ef]/80 lg:hidden">{NAMES[slug].toUpperCase()} MODE</p>
            <p className="break-words font-display text-[clamp(36px,11vw,48px)] font-bold leading-[0.92] tracking-[-0.05em] [text-wrap:balance] lg:text-[clamp(64px,5.6vw,112px)] lg:leading-[0.9]">
              {displayName}
              {plan !== "free" && <span className="ml-[0.16em] inline-block align-[0.08em]"><StatusBadge className="lg:hidden" plan={plan} size={20} surface="dark" /><StatusBadge className="hidden lg:inline-block" plan={plan} size={30} surface="dark" /></span>}
            </p>
            <p className="text-sm leading-[1.4] text-[#f5f4ef]/90 [text-wrap:pretty] lg:text-[19px]">{mode.line}</p>
            <p className="hidden truncate font-label text-[13px] text-[#f5f4ef]/70 lg:block">{publicUrl(slug).replace(/^https?:\/\//, "")}</p>
          </div>
          <div className="hidden flex-wrap items-end justify-between gap-5 pr-7 lg:flex">
            <ModePicker modes={modes} onPick={pick} slug={slug} variant="stage" />
            <div className="flex gap-2.5">
              <Link className="inline-flex min-h-[54px] items-center rounded-full px-4 text-[15px] font-semibold text-[#f5f4ef]/85 underline-offset-4 hover:underline focus-visible:outline-2" href="/app/tap">Tap ↗</Link>
              <Link className="inline-flex min-h-[54px] items-center rounded-full px-[22px] text-[15px] font-semibold shadow-[inset_0_0_0_1.5px_rgba(245,244,239,.45)] hover:bg-white/10 focus-visible:outline-2" href={`/app/identity?mode=${slug}&section=profile`}>Edit</Link>
              <button className="inline-flex min-h-[54px] items-center gap-2.5 rounded-full bg-[#ff5a4f] px-[26px] text-base font-semibold text-[#0d0d0d] transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f5f4ef]" onClick={openShare} type="button">
                Share {NAMES[slug]}<ArrowIcon />
              </button>
            </div>
          </div>
        </div>
      </section>

      <div className="mt-3 flex flex-col gap-3 lg:hidden">
        <ModePicker modes={modes} onPick={pick} slug={slug} variant="bar" />
        <div className="flex gap-2">
          <button className="min-h-14 flex-1 rounded-full bg-[#ff5a4f] text-base font-semibold text-[#0d0d0d] focus-visible:outline-2 focus-visible:outline-offset-2" onClick={openShare} type="button">Share {NAMES[slug]} Mode</button>
          <Link aria-label={`Edit ${NAMES[slug]} Mode`} className="grid size-14 place-items-center rounded-full shadow-[inset_0_0_0_1.5px_#0d0d0d] focus-visible:outline-2" href={`/app/identity?mode=${slug}&section=profile`}>
            <svg aria-hidden="true" height="18" viewBox="0 0 20 20" width="18"><path d="M4 16l1-4 8-8 3 3-8 8z" fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.6" /></svg>
          </Link>
        </div>
        <Link className="inline-flex min-h-11 items-center justify-center text-sm font-semibold underline underline-offset-4" href="/app/tap">Quick QR &amp; Tap settings →</Link>
      </div>

      {sharing && <ShareSheet displayName={displayName} isPublished={isPublished} modes={modes} onClose={closeShare} onPick={pick} publicUrl={publicUrl} slug={slug} username={username} />}
      {viewingPhoto && mode.imageUrl && <FullPhotoViewer imageUrl={mode.imageUrl} modeName={NAMES[slug]} onClose={closePhoto} />}
    </>
  );
}

function FullPhotoViewer({ imageUrl, modeName, onClose }: { imageUrl: string; modeName: string; onClose: () => void }) {
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeButton.current?.focus();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); onClose(); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => { document.body.style.overflow = previous; window.removeEventListener("keydown", onKeyDown); };
  }, [onClose]);

  return (
    <div aria-label={`${modeName} Mode full photo`} aria-modal="true" className="fixed inset-0 z-[85] flex flex-col items-center justify-center bg-[#0d0d0d]/95 p-4 pb-[calc(16px+env(safe-area-inset-bottom))] text-[#f5f4ef] sm:p-6" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }} role="dialog">
      <div className="mb-3 flex w-full max-w-6xl shrink-0 items-center justify-between gap-4">
        <p className="font-label text-xs uppercase tracking-[0.14em]">{modeName} Mode · full photo</p>
        <button aria-label="Close full photo" className="grid size-11 shrink-0 place-items-center rounded-full bg-white/10 text-xl focus-visible:outline-2 focus-visible:outline-offset-2" onClick={onClose} ref={closeButton} type="button">×</button>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element -- display the original user-uploaded photo without cropping */}
      <img alt={`${modeName} Mode profile photo`} className="max-h-[calc(100dvh-100px)] max-w-full object-contain" decoding="async" src={imageUrl} />
    </div>
  );
}

function ModePicker({ modes, slug, onPick, variant }: { modes: StageMode[]; slug: ModeSlug; onPick: (slug: ModeSlug) => void; variant: "stage" | "bar" | "sheet" }) {
  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowRight", "ArrowLeft", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const index = modes.findIndex((item) => item.slug === slug);
    const target = event.key === "Home" ? 0 : event.key === "End" ? modes.length - 1 : (index + (["ArrowRight", "ArrowDown"].includes(event.key) ? 1 : modes.length - 1)) % modes.length;
    const next = modes[target].slug;
    onPick(next);
    (event.currentTarget.querySelector(`[data-mode="${next}"]`) as HTMLButtonElement | null)?.focus();
  };
  if (variant === "stage") {
    return (
      <div aria-label="Choose a Mode" className="flex gap-1.5 rounded-[20px] bg-[#0d0d0d]/70 p-[5px] shadow-[inset_0_0_0_1px_rgba(245,244,239,.12)]" onKeyDown={onKeyDown} role="radiogroup">
        {modes.map((item) => {
          const on = item.slug === slug;
          return (
            <button aria-checked={on} className={`flex min-h-[58px] min-w-[132px] flex-col items-start justify-center gap-[3px] rounded-[15px] px-4 text-left focus-visible:outline-2 ${on ? "bg-[#f5f4ef] text-[#0d0d0d]" : "text-[#f5f4ef] hover:bg-white/10"}`} data-mode={item.slug} key={item.slug} onClick={() => onPick(item.slug)} role="radio" tabIndex={on ? 0 : -1} type="button">
              <span className="flex items-center gap-[7px] text-[15px] font-semibold"><span aria-hidden="true" className="size-[7px] rounded-full" style={{ background: DOT[item.slug] }} />{NAMES[item.slug]}</span>
              <span className="max-w-[180px] truncate text-xs opacity-75">{item.enabled ? item.sub : "Off"}</span>
            </button>
          );
        })}
      </div>
    );
  }
  return (
    <div aria-label={variant === "sheet" ? "Mode to share" : "Choose a Mode"} className="grid grid-cols-3 gap-1 rounded-[18px] bg-black/[0.06] p-1" onKeyDown={onKeyDown} role="radiogroup">
      {modes.map((item) => {
        const on = item.slug === slug;
        return (
          <button aria-checked={on} className={`flex min-h-12 items-center justify-center gap-1.5 rounded-[14px] text-sm font-semibold focus-visible:outline-2 ${on ? "bg-[#0d0d0d] text-[#f5f4ef]" : "text-[#0d0d0d]"}`} data-mode={item.slug} key={item.slug} onClick={() => onPick(item.slug)} role="radio" tabIndex={on ? 0 : -1} type="button">
            <span aria-hidden="true" className="size-[7px] rounded-full" style={{ background: DOT[item.slug] }} />{NAMES[item.slug]}
          </button>
        );
      })}
    </div>
  );
}

function ShareSheet({ modes, slug, onPick, onClose, publicUrl, displayName, username, isPublished }: {
  modes: StageMode[]; slug: ModeSlug; onPick: (slug: ModeSlug) => void; onClose: () => void; publicUrl: (slug: ModeSlug, source?: string) => string; displayName: string; username: string; isPublished: boolean;
}) {
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [copyError, setCopyError] = useState(false);
  const [intent, setIntent] = useState<"profile" | "in_person">("profile");
  const canShare = useSyncExternalStore(noSubscription, () => typeof navigator.share === "function", () => false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const panel = useRef<HTMLElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const mode = modes.find((item) => item.slug === slug) ?? modes[0];
  const offline = !isPublished || !mode.enabled;
  // Direct share only Modes have two intents: the view-only profile, or a temporary Connection Pass.
  const inPerson = intent === "in_person" && mode.connectPolicy === "direct_only";
  const { pass, end: resetPass } = useConnectPass(slug, inPerson && !offline);
  const passUrl = pass?.ok ? pass.url : null;
  const linkUrl = inPerson ? passUrl : publicUrl(slug, "link");
  const qrUrl = inPerson ? passUrl : publicUrl(slug, "qr");
  const copied = Boolean(linkUrl) && copiedUrl === linkUrl;

  useEffect(() => {
    close.current?.focus();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); onClose(); }
      if (event.key !== "Tab") return;
      const items = [...(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled):not([tabindex="-1"]), a[href]') ?? [])];
      const first = items[0]; const last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = previous; window.removeEventListener("keydown", onKey); };
  }, [onClose]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  async function copy() {
    const value = linkUrl;
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value); setCopiedUrl(value); setCopyError(false);
      if (!inPerson && !offline) recordProfileShare(slug, "copy");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopiedUrl(null), 2000);
    } catch { setCopiedUrl(null); setCopyError(true); }
  }
  async function share() {
    const url = inPerson ? passUrl : publicUrl(slug, "native_share");
    if (!url) return;
    try {
      await navigator.share({ title: `${displayName} · ${NAMES[slug]} Mode`, url });
      if (!inPerson && !offline) recordProfileShare(slug, "native_share");
    } catch { /* dismissed */ }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center md:items-center md:p-6">
      <div aria-hidden="true" className="absolute inset-0 bg-[#0d0d0d]/55 [animation:fade-in_160ms_ease-out]" onClick={onClose} />
      <section aria-labelledby={titleId} aria-modal="true" className="relative flex max-h-[92dvh] w-full flex-col gap-4 overflow-y-auto rounded-t-[30px] bg-[#f5f4ef] px-5 pb-[calc(24px+env(safe-area-inset-bottom))] pt-2.5 [animation:sheet-up_220ms_cubic-bezier(.2,.8,.2,1)] md:grid md:max-w-[780px] md:grid-cols-[300px_minmax(0,1fr)] md:gap-8 md:rounded-[30px] md:p-8" ref={panel} role="dialog">
        <span aria-hidden="true" className="mx-auto h-[5px] w-10 rounded-full bg-black/20 md:hidden" />
        <div className="order-2 mx-auto w-[228px] rounded-[22px] bg-white p-3.5 md:order-none md:w-full md:p-5">
          {qrUrl
            ? <QRCodeSVG aria-label={`${NAMES[slug]} Mode ${inPerson ? "Connect in person " : ""}QR code`} bgColor="#FFFFFF" className="h-auto w-full" data-share-intent={inPerson ? "in_person" : "profile"} data-qr-value={qrUrl} fgColor="#0D0D0D" imageSettings={{ src: markDataUri, height: 48, width: 48, excavate: true }} level="H" marginSize={4} role="img" size={256} title={`${NAMES[slug]} Mode ${inPerson ? "Connect in person " : ""}QR code`} value={qrUrl} />
            : <div aria-live="polite" className="grid aspect-square w-full place-items-center px-4 text-center text-sm text-black/60">{pass && !pass.ok ? pass.message : offline ? "Turn this Mode on to connect in person." : "Making your pass…"}</div>}
        </div>
        <div className="contents md:flex md:min-w-0 md:flex-col md:gap-5">
          <div className="order-1 flex items-end justify-between gap-4 md:order-none md:items-start">
            <div><p className="font-label text-[10px] tracking-[0.14em] text-black/65 md:text-xs">YOU ARE SHARING</p><h2 className="font-display text-[30px] font-bold leading-none tracking-[-0.04em] md:text-[40px]" id={titleId}>{NAMES[slug]} Mode</h2></div>
            <button aria-label="Close" className="grid size-11 shrink-0 place-items-center rounded-full bg-black/[0.06] text-xl focus-visible:outline-2" onClick={onClose} ref={close} type="button">×</button>
          </div>
          <div className="order-1 md:order-none"><ModePicker modes={modes} onPick={onPick} slug={slug} variant="sheet" /></div>
          {mode.connectPolicy === "direct_only" && <div className="order-1 md:order-none"><IntentPicker intent={inPerson ? "in_person" : "profile"} onPick={setIntent} /></div>}
          {offline
            ? <p className="order-3 rounded-2xl bg-[#ff5a4f]/[0.14] px-4 py-3 text-sm font-semibold md:order-none">{!isPublished ? "Your Setuvara is a draft, so this link won't open yet." : `${NAMES[slug]} Mode is off, so this link won't open.`} <Link className="underline underline-offset-4" href={`/app/identity?mode=${slug}&section=share`}>Fix in Identity</Link></p>
            : inPerson
              ? <p className="order-3 text-sm leading-[1.45] text-black/80 md:order-none md:text-[15px]">Anyone who scans or opens this can connect with your {NAMES[slug]} Mode{pass?.ok ? ` until ${passExpiryLabel(pass.expiresAt)}` : ""}. <button className="py-1 font-semibold underline underline-offset-4" onClick={() => void resetPass()} type="button">Reset pass</button></p>
              : mode.connectPolicy === "anyone"
                ? <p className="order-3 hidden text-[15px] leading-[1.45] text-black/80 md:order-none md:block">{NOTES[slug]}</p>
                : <p className="order-3 text-sm leading-[1.45] text-black/80 md:order-none md:text-[15px]">View only. Your profile opens without Connect.</p>}
          <div className="order-4 flex min-h-[52px] items-center justify-between gap-3 rounded-[14px] bg-white py-1.5 pl-4 pr-1.5 shadow-[inset_0_0_0_1px_rgba(13,13,13,.1)] md:order-none">
            <span className="min-w-0 truncate font-label text-[13px]">{inPerson ? (passUrl ? passUrl.replace(/^https?:\/\//, "").replace(/\/connect\/.+$/, "/connect/…") : "Connection Pass") : publicUrl(slug).replace(/^https?:\/\//, "")}</span>
            <button aria-live="polite" className={`min-h-11 shrink-0 rounded-[10px] px-3.5 text-[13px] font-semibold focus-visible:outline-2 disabled:opacity-50 ${copied ? "bg-[#c7ff4a]" : "bg-black/[0.06]"}`} disabled={!linkUrl} onClick={() => void copy()} type="button">{copied ? "Copied" : "Copy link"}</button>
          </div>
          {copyError && <p className="order-5 text-sm" role="status">Copy is unavailable in this browser. Select the profile URL above to copy it.</p>}
          <div className="order-5 grid grid-cols-1 gap-2.5 min-[400px]:grid-cols-2 md:order-none md:mt-auto">
            {canShare && <button className="min-h-[52px] min-w-0 whitespace-nowrap rounded-full bg-[#ff5a4f] px-3 py-3 text-center text-sm font-semibold leading-5 text-[#0d0d0d] focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50" disabled={!linkUrl} onClick={() => void share()} type="button">Share link</button>}
            <Link aria-label="Open full-screen QR and downloads" className={`flex min-h-[52px] min-w-0 whitespace-nowrap items-center justify-center rounded-full px-3 py-3 text-center text-sm font-semibold leading-5 focus-visible:outline-2 ${canShare ? "shadow-[inset_0_0_0_1.5px_#0d0d0d]" : "col-span-full bg-[#ff5a4f] text-[#0d0d0d]"}`} href={`/app/identity?mode=${slug}&section=share${inPerson ? "&intent=in_person" : ""}`}>Open QR screen</Link>
          </div>
          <Link className="order-5 inline-flex min-h-11 items-center justify-center text-sm font-semibold underline underline-offset-4 md:order-none" href="/app/tap" onClick={onClose}>Open Quick QR &amp; Tap settings →</Link>
          <p className="sr-only">setuvara.com/{username}</p>
        </div>
      </section>
    </div>
  );
}

function IntentPicker({ intent, onPick }: { intent: "profile" | "in_person"; onPick: (intent: "profile" | "in_person") => void }) {
  const options = [{ value: "profile", label: "Share profile" }, { value: "in_person", label: "Connect in person" }] as const;
  return (
    <div aria-label="What you are sharing" className="grid grid-cols-2 gap-1 rounded-[18px] bg-black/[0.06] p-1" role="radiogroup">
      {options.map((option) => {
        const on = option.value === intent;
        return <button aria-checked={on} className={`min-h-12 rounded-[14px] px-2 text-sm font-semibold focus-visible:outline-2 ${on ? "bg-[#0d0d0d] text-[#f5f4ef]" : "text-[#0d0d0d]"}`} key={option.value} onClick={() => onPick(option.value)} role="radio" type="button">{option.label}</button>;
      })}
    </div>
  );
}

function ArrowIcon() {
  return <svg aria-hidden="true" height="16" viewBox="0 0 16 16" width="16"><path d="M4 12L12 4M6 4h6v6" fill="none" stroke="currentColor" strokeWidth="1.8" /></svg>;
}
