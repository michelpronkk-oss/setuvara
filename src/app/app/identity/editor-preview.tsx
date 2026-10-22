"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import type { CSSProperties } from "react";

import { ProfileRenderer } from "@/components/profile/profile-renderer";
import { resolveAppearance, resolveModeAccent } from "@/components/profile/appearance";
import { profileTone } from "@/components/profile/appearance-theme";
import { ProfileStage } from "@/components/profile/profile-stage";
import { SpeakerIcon } from "@/components/profile/soundtrack";
import { soundtrackBlock } from "@/lib/blocks/registry";
import type { ConnectionContext, ProfileMode } from "@/components/profile/types";
import type { EditorApi, PreviewState } from "./editor-types";
import { PreviewingBar, useAppearance } from "./editor-appearance";
import { useI18n } from "@/lib/i18n/provider";
import { MODE_SLUGS } from "./editor-types";
import { MonoLabel, Segmented, modeMeta, previewVisitorAction } from "./editor-ui";

const stateOptions: { value: PreviewState; label: string }[] = [
  { value: "visitor", label: "Visitor" },
  { value: "connected", label: "Connected" },
];

// Previews only ever show what other people see: never the owner's own buttons.
const notes: Record<PreviewState, string> = {
  visitor: "Exactly what people see when they open your link.",
  connected: "What people see after you connect. Sample connection, nothing is changed.",
};

// Visitor preview shows the public link. A Connection Pass is never faked here.
function previewNote(api: EditorApi, state: PreviewState) {
  const policy = api.mode.connect_policy ?? "anyone";
  if (state !== "visitor" || policy === "anyone") return notes[state];
  return policy === "direct_only"
    ? "Seen from your public link: view-only. Connect appears for people you share with directly."
    : "Seen by any visitor. This Mode is view-only.";
}

function useSampleContext(mode: ProfileMode): ConnectionContext {
  return useMemo(() => {
    const when = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date()).replace(",", " ·");
    const text = (key: string) => (typeof mode.settings[key] === "string" ? String(mode.settings[key]).trim() : "");
    if (mode.slug === "event") return { mode: "event", event: text("eventName") || "Slush", city: text("city") || "Helsinki", dateLabel: when };
    if (mode.slug === "business") return { mode: "business", event: "SaaStock", city: text("city") || "Amsterdam", dateLabel: when };
    return { mode: "personal", event: "Rooftop", city: text("location") || "Lisboa", dateLabel: when };
  }, [mode.settings, mode.slug]);
}

/** Whether the editor previews show the first-visit sound gate ("Enter with sound"). */
export type SoundIntro = { on: boolean; set: (on: boolean) => void };

function PreviewProfile({ api, state, setState, soundGate = false }: { api: EditorApi; state: PreviewState; setState: (state: PreviewState) => void; soundGate?: boolean }) {
  const { mode, profile } = api;
  const { messages } = useI18n();
  const context = useSampleContext(mode);
  return (
    <ProfileRenderer
      attribution
      previewLook={api.appearancePreview ? resolveAppearance({ slug: mode.slug, appearance: api.appearancePreview }, "pro") : undefined}
      connectionContext={state === "connected" ? context : null}
      connectionHref={state === "connected" ? "/app/connections" : undefined}
      memberTier={api.memberTier}
      mode={mode}
      profile={profile}
      plan={api.plan}
      selectedRewards={api.selectedRewards}
      sound="preview"
      soundGate={soundGate}
      viewerState={state === "connected" ? "visitor_connected" : "visitor_unconnected"}
      visitorAction={state === "visitor" ? previewVisitorAction(mode, messages.profile.connect, () => setState("connected")) : undefined}
    />
  );
}

function PaneBar({ api }: { api: EditorApi }) {
  const state = useAppearance(api);
  return <div className="sticky bottom-5 z-10 mt-auto w-full max-w-[460px]"><PreviewingBar api={api} state={state} /></div>;
}

/**
 * The sound gate is part of the visitor's first visit, not of the profile, so editor previews
 * skip it and keep the small sound control. This switch shows it on demand, only when the
 * Mode has a soundtrack.
 */
function SoundIntroToggle({ api, intro, compact = false }: { api: EditorApi; intro: SoundIntro; compact?: boolean }) {
  if (!soundtrackBlock(api.mode)) return null;
  return (
    <button
      aria-pressed={intro.on}
      aria-label={compact ? "Sound intro" : undefined}
      className={`inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 ${compact ? "min-h-10 min-w-10 px-2.5 text-[13px] sm:px-3" : "min-h-9 px-3 text-[12.5px]"} ${intro.on ? "bg-[#0D0D0D] text-[#F5F4EF]" : "bg-white text-black/70 shadow-[inset_0_0_0_1px_rgba(13,13,13,.12)] hover:text-black"}`}
      data-sound-intro-toggle
      onClick={() => intro.set(!intro.on)}
      title={intro.on ? "Hide the sound intro visitors see first" : "Show the sound intro visitors see first"}
      type="button"
    >
      <SpeakerIcon className={compact ? "size-4" : "size-3.5"} on={intro.on} /><span className={compact ? "max-sm:hidden" : undefined}>Sound intro</span>
    </button>
  );
}

export function PreviewPane({ api, previewState, setPreviewState, soundIntro }: { api: EditorApi; previewState: PreviewState; setPreviewState: (state: PreviewState) => void; soundIntro: SoundIntro }) {
  const offline = !api.profile.is_published || !api.mode.is_enabled;
  return (
    <div className="relative flex min-h-full flex-col items-center gap-3.5 px-6 pb-8 pt-[22px]">
      <MonoLabel className="sr-only">Live preview</MonoLabel>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Segmented label="Preview as" onChange={setPreviewState} options={stateOptions} size="sm" value={previewState} />
        <SoundIntroToggle api={api} intro={soundIntro} />
      </div>
      {/* The phone at the design's .86 scale: the renderer lays out at 390 and is zoomed, so it is
          exactly the public phone composition. */}
      <div className="relative w-[336px] shrink-0 overflow-hidden rounded-[36px] bg-[#F5F4EF] shadow-[0_30px_60px_-30px_#0D0D0D80]" data-preview-phone style={{ height: "max(480px, min(726px, calc(100dvh - 220px)))" }}>
        <div className="h-full overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div style={{ width: 390, zoom: 0.86, "--profile-vh": "844px" } as CSSProperties}>
            <PreviewProfile api={api} setState={setPreviewState} soundGate={soundIntro.on} state={previewState} />
          </div>
        </div>
      </div>
      <p className="mt-4 max-w-[340px] text-center text-[13px] leading-5 text-black/55">{previewNote(api, previewState)}</p>
      {offline && <p className="mt-2 max-w-[340px] text-center text-[12px] font-medium text-[#B42318]">{!api.profile.is_published ? "Draft: visitors can’t open your Setuvara until you publish." : `${modeMeta[api.slug].name} Mode is off, so its link doesn’t open.`}</p>}
      {api.appearancePreview && <PaneBar api={api} />}
    </div>
  );
}

export function FullPreview({ api, previewState, setPreviewState, onClose, soundIntro }: { api: EditorApi; previewState: PreviewState; setPreviewState: (state: PreviewState) => void; onClose: () => void; soundIntro: SoundIntro }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const tone = profileTone(api.mode, api.plan);
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => { document.body.style.overflow = previous; };
  }, []);

  return (
    <div aria-label="Full-screen preview" aria-modal="true" className="fixed inset-0 z-[80] overflow-y-auto overscroll-contain bg-[#E9E7E0]" role="dialog">
      {/* All controls sit on top, so nothing covers the profile's own Connect at the bottom. */}
      <div className="sticky top-0 z-[70] flex flex-wrap items-center justify-between gap-x-3 gap-y-2 bg-[#E9E7E0]/90 px-3 py-2.5 backdrop-blur-md sm:px-8 sm:py-3">
        <div className="flex gap-1 rounded-full bg-white p-1 shadow-[inset_0_0_0_1px_rgba(13,13,13,.12)]">
          {MODE_SLUGS.map((slug) => {
            const on = slug === api.slug;
            const meta = modeMeta[slug];
            return <button aria-pressed={on} className="min-h-9 rounded-full px-3.5 text-[13px] font-semibold" key={slug} onClick={() => api.go(api.section, slug)} style={{ background: on ? meta.bg : "transparent", color: on ? meta.fg : "rgba(13,13,13,.6)", boxShadow: on ? meta.ring : undefined }} type="button">{meta.name}</button>;
          })}
        </div>
        <button aria-label="Close preview" className="order-2 grid size-10 place-items-center rounded-full bg-[#0D0D0D] text-lg leading-none text-[#F5F4EF] sm:order-3" onClick={onClose} ref={closeRef} type="button">×</button>
        <div className="order-3 flex w-full items-center justify-between gap-2 sm:order-2 sm:w-auto">
          <Segmented label="Preview as" onChange={setPreviewState} options={stateOptions} size="sm" value={previewState} />
          <SoundIntroToggle api={api} compact intro={soundIntro} />
        </div>
      </div>
      {/* Full width: the same responsive composition visitors get on this screen. */}
      <div className="w-full pb-16" style={{ "--profile-vh": "100dvh" } as CSSProperties}>
        <ProfileStage accent={resolveModeAccent(api.mode)} base={tone.bg} dark={tone.dark} photo={api.mode.image_url ?? null}>
          <PreviewProfile api={api} setState={setPreviewState} soundGate={soundIntro.on} state={previewState} />
        </ProfileStage>
        <p className="relative mt-4 text-center text-[13px] text-black/55">{previewNote(api, previewState)}</p>
      </div>
    </div>
  );
}


/**
 * Phones: the live preview docked above the tab bar. Folded, it is one slim bar so the editor
 * keeps the screen; open, every change shows while you make it. The phone composition is drawn
 * at 390 and zoomed to the dock's width, exactly like the pane.
 */
export function PeekPreview({ api, open, previewState, setPreviewState, onExpand, onToggle }: { api: EditorApi; open: boolean; previewState: PreviewState; setPreviewState: (state: PreviewState) => void; onExpand: () => void; onToggle: () => void }) {
  const frame = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState({ scale: 0.68, height: 844 });
  useEffect(() => {
    const node = frame.current;
    if (!node) return;
    // The frame is a short phone: the hero fills what is visible, so name and Connect show too.
    const observer = new ResizeObserver(([entry]) => {
      const scale = Math.max(0.5, entry.contentRect.width / 390);
      setFit({ scale, height: Math.round(Math.max(560, entry.contentRect.height / scale)) });
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [open]);
  const icon = "grid size-10 place-items-center rounded-full text-black/70 transition hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2";
  return (
    <section aria-label="Live preview" className="fixed inset-x-3 bottom-[calc(80px+env(safe-area-inset-bottom))] z-30 mx-auto flex max-w-[440px] flex-col overflow-hidden rounded-[22px] shadow-[inset_0_0_0_1px_rgba(13,13,13,.08)] bg-[#E9E7E0] shadow-[0_-18px_40px_-26px_rgba(13,13,13,.45)] transition-[height] duration-300 ease-out lg:hidden" data-preview-peek={open ? "open" : "folded"} style={{ height: "var(--editor-dock)" }}>
      <div className="flex h-[52px] shrink-0 items-center justify-between gap-2 pl-2 pr-1.5">
        <button aria-expanded={open} className="flex min-h-11 min-w-0 flex-1 items-center gap-2.5 rounded-full pl-2 text-left text-[13.5px] font-semibold" onClick={onToggle} type="button">
          <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-[#2BB673] [animation:sound-breathe_2.4s_ease-in-out_infinite]" />
          <span className="truncate">Live preview</span>
          <span className="truncate font-normal text-black/50">{previewState === "connected" ? "· after connecting" : "· as visitors see it"}</span>
          <svg aria-hidden="true" className={`ml-auto size-[18px] shrink-0 text-black/60 transition-transform ${open ? "" : "rotate-180"}`} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6" /></svg>
          <span className="sr-only">{open ? "Fold the live preview" : "Show the live preview"}</span>
        </button>
        <div className="flex shrink-0 items-center gap-0.5">
          {open && previewState !== "visitor" && <button className="min-h-9 rounded-full bg-white px-3 text-[12px] font-semibold text-black/70 shadow-[inset_0_0_0_1px_rgba(13,13,13,.12)]" onClick={() => setPreviewState("visitor")} title="Back to the visitor view" type="button">Reset</button>}
          <button aria-label="Full-screen preview" className={icon} onClick={onExpand} type="button"><svg aria-hidden="true" className="size-[18px]" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24"><path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7" /></svg></button>
        </div>
      </div>
      {open && (
        <div className="min-h-0 flex-1 px-4 [animation:sheet-up_.24s_ease-out]">
          <div className="mx-auto h-full w-full max-w-[272px] overflow-hidden rounded-t-[24px] bg-[#F5F4EF] shadow-[0_0_0_4px_#0D0D0D]" ref={frame}>
            <div className="h-full overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div style={{ width: 390, zoom: fit.scale, "--profile-vh": `${fit.height}px` } as CSSProperties}>
                <PreviewProfile api={api} setState={setPreviewState} state={previewState} />
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
