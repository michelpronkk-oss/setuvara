"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

import { previewVisitorAction } from "@/app/app/identity/editor-ui";
import { CreatorSections } from "@/components/creator/creator-sections";
import { inkOnAccent, resolveModeAccent } from "@/components/profile/appearance";
import { ProfileRenderer } from "@/components/profile/profile-renderer";
import type { MemberTier } from "@/lib/billing/member-badge";
import type { ProfileIdentity, ProfileMode } from "@/components/profile/types";
import type { PlanCode } from "@/lib/billing/catalog";
import type { PublicAction } from "@/lib/actions/model";
import { actionTheme, actionThemeVars } from "@/lib/actions/theme";
import type { CreatorSettings, StoreOffer, WorkItem } from "@/lib/creator/studio";
import { ActionCards } from "./action-card";
import { ActionForm } from "./action-form";
import { ActionPageView } from "./action-page-view";

export type PhoneView = "page" | "form" | "done";
export type PreviewSource = {
  profile: ProfileIdentity;
  mode: ProfileMode;
  plan: PlanCode;
  memberTier: MemberTier | null;
  /** The Mode's other live Actions, so the draft shows among them in page order. */
  others: { action: PublicAction; coverUrl: string | null; sort: number }[];
  /** Creator pages place Actions among Featured, Work and Store. */
  creator?: { settings: CreatorSettings; work: WorkItem[]; offers: StoreOffer[] };
};

const WIDTH = 390;

/**
 * A phone, drawn like the real thing: the screen lays out at 390 and is zoomed into the frame, so what
 * scrolls inside is exactly the page visitors get. `screen` is the scrolling element.
 */
export function PhoneFrame({ children, width = 340, dark = true, screenRef, height }: { children: ReactNode; width?: number; dark?: boolean; screenRef?: React.Ref<HTMLDivElement>; height?: string }) {
  const zoom = (width - 22) / WIDTH;
  return (
    <div className="relative shrink-0 rounded-[58px] bg-[#0D0D0D] p-[11px] shadow-[0_0_0_1.5px_#2A2826,0_0_0_3px_#0D0D0D,0_50px_100px_-40px_rgba(13,13,13,.75),0_30px_60px_-30px_rgba(13,13,13,.5)]" data-action-phone style={{ width }}>
      {/* Side buttons. */}
      <span aria-hidden="true" className="absolute -left-[4px] top-[118px] h-[30px] w-[3px] rounded-l bg-[#1E1C1A]" />
      <span aria-hidden="true" className="absolute -left-[4px] top-[166px] h-[54px] w-[3px] rounded-l bg-[#1E1C1A]" />
      <span aria-hidden="true" className="absolute -left-[4px] top-[230px] h-[54px] w-[3px] rounded-l bg-[#1E1C1A]" />
      <span aria-hidden="true" className="absolute -right-[4px] top-[180px] h-[84px] w-[3px] rounded-r bg-[#1E1C1A]" />
      <div className="relative overflow-hidden rounded-[47px] bg-[#F5F4EF]" style={{ height: height ?? "min(730px, calc(100dvh - 210px))", minHeight: 520 }}>
        <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex h-[46px] items-center justify-between px-7 text-[13px] font-semibold" style={{ color: dark ? "#F5F4EF" : "#0D0D0D", textShadow: dark ? "0 1px 6px rgba(0,0,0,.35)" : undefined }}>
          <span>9:41</span>
          <span className="flex items-center gap-1.5" aria-hidden="true">
            <svg className="h-[10px] w-[16px]" fill="currentColor" viewBox="0 0 16 10"><rect height="4" rx="1" width="3" y="6" /><rect height="6" rx="1" width="3" x="4.3" y="4" /><rect height="8" rx="1" width="3" x="8.6" y="2" /><rect height="10" rx="1" width="3" x="12.9" /></svg>
            <svg className="h-[11px] w-[24px]" fill="none" viewBox="0 0 24 11"><rect height="10" rx="3" stroke="currentColor" strokeOpacity=".5" width="21" x=".5" y=".5" /><rect fill="currentColor" height="7" rx="1.6" width="17" x="2" y="2" /><path d="M23 4v3" stroke="currentColor" strokeLinecap="round" strokeOpacity=".5" /></svg>
          </span>
        </div>
        <span aria-hidden="true" className="pointer-events-none absolute left-1/2 top-[11px] z-30 h-[30px] w-[100px] -translate-x-1/2 rounded-full bg-[#0D0D0D]" />
        <div className="relative isolate h-full overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" ref={screenRef}>
          <div className="relative min-h-full" style={{ width: WIDTH, zoom, "--profile-vh": "844px" } as CSSProperties}>{children}</div>
        </div>
        <span aria-hidden="true" className="pointer-events-none absolute bottom-[8px] left-1/2 z-30 h-[5px] w-[124px] -translate-x-1/2 rounded-full" style={{ background: dark ? "#F5F4EFCC" : "#0D0D0DCC" }} />
      </div>
    </div>
  );
}

/** The Action's phone preview: the real page with the draft card in place, its own page, and the moment after sending. */
export function ActionPhone({ source, action, coverUrl, view, replay, firstName, width }: { source: PreviewSource; action: PublicAction; coverUrl: string | null; view: PhoneView; replay: number; firstName: string; width?: number }) {
  const screen = useRef<HTMLDivElement>(null);
  const { mode, profile, plan } = source;
  const theme = actionTheme(mode, plan, Boolean(mode.image_url));
  const accent = resolveModeAccent(mode);
  const [settled, setSettled] = useState(0);

  // The draft takes its own place among the live Actions.
  const list = [...source.others.filter((item) => item.action.id !== action.id), { action, coverUrl, sort: source.others.find((item) => item.action.id === action.id)?.sort ?? Number.MAX_SAFE_INTEGER }]
    .sort((a, b) => a.sort - b.sort)
    .map(({ action: item, coverUrl: cover }) => ({ action: item, coverUrl: cover }));

  // Opening the page view scrolls to the draft card once the profile has laid out.
  useLayoutEffect(() => {
    if (view !== "page") { screen.current?.scrollTo({ top: 0 }); return; }
    const frame = requestAnimationFrame(() => setSettled((value) => value + 1));
    return () => cancelAnimationFrame(frame);
  }, [view, action.id]);
  useEffect(() => {
    if (view !== "page" || !settled) return;
    const box = screen.current;
    const card = box?.querySelector<HTMLElement>(`[data-action-id="${action.id}"]`);
    if (!box || !card) return;
    const top = box.scrollTop + card.getBoundingClientRect().top - box.getBoundingClientRect().top - box.clientHeight / 2 + card.getBoundingClientRect().height / 2;
    box.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  }, [settled, view, action.id]);

  const footer = source.creator
    ? <CreatorSections accent={accent} accentInk={inkOnAccent(accent)} actions={list} offers={source.creator.offers.filter((offer) => offer.status === "active")} settings={source.creator.settings} work={source.creator.work} />
    : <ActionCards accent={accent} accentInk={inkOnAccent(accent)} actions={list} />;

  return (
    <PhoneFrame dark={!theme.light || (view === "page" && Boolean(mode.image_url))} screenRef={screen} width={width}>
      {view === "page" ? (
        <>
          <style>{`[data-action-phone] [data-action-id="${action.id}"]{outline:2px solid ${accent};outline-offset:3px;animation:av-focus 2.4s ease-in-out infinite}@keyframes av-focus{50%{outline-offset:6px;outline-color:color-mix(in srgb,${accent} 40%,transparent)}}`}</style>
          <ProfileRenderer
            attribution
            footer={footer}
            memberTier={source.memberTier}
            mode={mode}
            plan={plan}
            profile={profile}
            sound="preview"
            viewerState="visitor_unconnected"
            visitorAction={previewVisitorAction(mode, "Connect")}
          />
        </>
      ) : (
        <div className="relative min-h-[844px]" style={actionThemeVars(theme)}>
          {view === "form" ? (
            <ActionPageView action={action} contained coverUrl={coverUrl} name={profile.display_name} photoUrl={mode.image_url ?? null} theme={theme}>
              <ActionForm action={action} firstName={firstName} heading={theme.heading} motion={theme.motion} preview />
            </ActionPageView>
          ) : (
            <ActionForm action={action} contained firstName={firstName} heading={theme.heading} key={replay} motion={theme.motion === "off" ? "off" : "full"} preview previewSent />
          )}
        </div>
      )}
    </PhoneFrame>
  );
}
