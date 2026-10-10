"use client";

import { useEffect, useMemo, useRef } from "react";

import { ProfileRenderer } from "@/components/profile/profile-renderer";
import { inkOnAccent, resolveModeAccent } from "@/components/profile/appearance";
import type { ConnectionContext, ProfileMode } from "@/components/profile/types";
import type { EditorApi, PreviewState } from "./editor-types";
import { MODE_SLUGS } from "./editor-types";
import { MonoLabel, Segmented, modeMeta } from "./editor-ui";

const stateOptions: { value: PreviewState; label: string }[] = [
  { value: "owner", label: "Owner" },
  { value: "visitor", label: "Visitor" },
  { value: "connected", label: "Connected" },
];

const notes: Record<PreviewState, string> = {
  owner: "What you see when you open your own Setuvara.",
  visitor: "Seen by someone you haven’t connected with yet. Tap Connect to preview the next step.",
  connected: "Sample connection shown. Your real data is not changed.",
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

function PreviewProfile({ api, state, setState }: { api: EditorApi; state: PreviewState; setState: (state: PreviewState) => void }) {
  const { mode, profile } = api;
  const context = useSampleContext(mode);
  const eventName = typeof mode.settings.eventName === "string" ? mode.settings.eventName.trim() : "";
  const label = mode.slug === "event" && eventName ? `Connect at ${eventName}` : "Connect";
  const accent = resolveModeAccent(mode);
  const visitorAction = (
    <button className="inline-flex min-h-12 w-full items-center justify-center rounded-full px-6 text-sm font-semibold" onClick={() => setState("connected")} style={{ background: accent, color: inkOnAccent(accent) }} type="button">{label}</button>
  );
  return (
    <ProfileRenderer
      connectionContext={state === "connected" ? context : null}
      connectionHref={state === "connected" ? "/app/connections" : undefined}
      memberTier={api.memberTier}
      mode={mode}
      onEditMode={() => api.go("profile")}
      onShare={() => api.go("share")}
      profile={profile}
      selectedRewards={api.selectedRewards}
      sound="preview"
      viewerState={state === "owner" ? "owner" : state === "connected" ? "visitor_connected" : "visitor_unconnected"}
      visitorAction={state === "visitor" && (mode.connect_policy ?? "anyone") === "anyone" ? visitorAction : undefined}
    />
  );
}

export function PreviewPane({ api, previewState, setPreviewState }: { api: EditorApi; previewState: PreviewState; setPreviewState: (state: PreviewState) => void }) {
  const offline = !api.profile.is_published || !api.mode.is_enabled;
  return (
    <div className="flex min-h-full flex-col items-center px-6 pb-8 pt-7">
      <div className="flex w-full max-w-[392px] items-center justify-between gap-3">
        <MonoLabel className="text-black/55">Live preview</MonoLabel>
        <Segmented label="Preview as" onChange={setPreviewState} options={stateOptions} size="sm" value={previewState} />
      </div>
      <div className="mt-6 w-full max-w-[372px] rounded-[48px] bg-[#0D0D0D] p-[10px] shadow-[0_50px_100px_-40px_rgba(13,13,13,.55)]">
        <div className="relative h-[min(760px,calc(100dvh-230px))] min-h-[520px] overflow-hidden rounded-[39px] bg-[#F5F4EF]">
          <div className="h-full overflow-y-auto overscroll-contain [scrollbar-width:none] [&>article]:min-h-full [&>article]:rounded-none [&::-webkit-scrollbar]:hidden">
            <PreviewProfile api={api} setState={setPreviewState} state={previewState} />
          </div>
        </div>
      </div>
      <p className="mt-4 max-w-[340px] text-center text-[13px] leading-5 text-black/55">{previewNote(api, previewState)}</p>
      {offline && <p className="mt-2 max-w-[340px] text-center text-[12px] font-medium text-[#B42318]">{!api.profile.is_published ? "Draft: visitors can’t open your Setuvara until you publish." : `${modeMeta[api.slug].name} Mode is off, so its link doesn’t open.`}</p>}
    </div>
  );
}

export function FullPreview({ api, previewState, setPreviewState, onClose }: { api: EditorApi; previewState: PreviewState; setPreviewState: (state: PreviewState) => void; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => { document.body.style.overflow = previous; };
  }, []);

  return (
    <div aria-label="Full-screen preview" aria-modal="true" className="fixed inset-0 z-[80] overflow-y-auto overscroll-contain bg-[#E9E7E0]" role="dialog">
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 bg-[#E9E7E0]/90 px-4 py-3 backdrop-blur-md sm:px-8">
        <div className="flex gap-1 rounded-full bg-white p-1 shadow-[inset_0_0_0_1px_rgba(13,13,13,.12)]">
          {MODE_SLUGS.map((slug) => {
            const on = slug === api.slug;
            const meta = modeMeta[slug];
            return <button aria-pressed={on} className="min-h-9 rounded-full px-3.5 text-[13px] font-semibold" key={slug} onClick={() => api.go(api.section, slug)} style={{ background: on ? meta.bg : "transparent", color: on ? meta.fg : "rgba(13,13,13,.6)", boxShadow: on ? meta.ring : undefined }} type="button">{meta.name}</button>;
          })}
        </div>
        <button className="hidden min-h-10 items-center rounded-full px-4 text-sm font-semibold shadow-[inset_0_0_0_1.5px_#0D0D0D] sm:inline-flex" onClick={onClose} type="button">Exit preview</button>
      </div>
      <div className="mx-auto w-full max-w-[440px] px-2 pb-36 pt-2 sm:px-0 sm:pt-6">
        <PreviewProfile api={api} setState={setPreviewState} state={previewState} />
        <p className="mt-4 text-center text-[13px] text-black/55">{previewNote(api, previewState)}</p>
      </div>
      <div className="fixed inset-x-0 bottom-0 z-10 flex justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="flex items-center gap-1.5 rounded-full bg-white p-1.5 shadow-[0_20px_50px_-20px_rgba(13,13,13,.6),inset_0_0_0_1px_rgba(13,13,13,.08)]">
          <Segmented label="Preview as" onChange={setPreviewState} options={stateOptions} size="sm" value={previewState} />
          <button aria-label="Close preview" className="grid size-10 place-items-center rounded-full bg-[#0D0D0D] text-lg leading-none text-[#F5F4EF]" onClick={onClose} ref={closeRef} type="button">×</button>
        </div>
      </div>
    </div>
  );
}

