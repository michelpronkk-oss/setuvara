"use client";

import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useId, useRef, useState, type CSSProperties } from "react";

import { MemberBadge } from "@/components/app/status-badge";
import { ProfileRenderer } from "@/components/profile/profile-renderer";
import { QrFrame } from "@/components/profile/qr-frame";
import {
  ACCENT_PRESETS, APPEARANCE_LINES, APPEARANCE_NAMES, APPEARANCES, EDITOR_ZOOMS, MOTION_LEVELS, NAME_POSITIONS, NAME_SIZES, QR_STYLES, READABILITY, SOCIAL_STYLES, SOUND_PRESENTATIONS,
  capabilityForField, introducedLockedFields, isFreeAppearance, lockedFields, previewAppearance, resolveAppearance,
  type AppearanceId, type ResolvedAppearance, defaultSocialStyle, socialPlacement } from "@/components/profile/appearance";
import { appearanceTheme } from "@/components/profile/appearance-theme";
import type { ModeAppearance } from "@/components/profile/types";
import { soundtrackBlock } from "@/lib/blocks/registry";
import { getPublicPlan, type BillingInterval, type PlanCode } from "@/lib/billing/catalog";
import { hasCapability } from "@/lib/billing/capabilities";
import { useI18n } from "@/lib/i18n/provider";
import type { MessageDictionary } from "@/lib/i18n/messages";
import { PASSPORT_REWARDS } from "@/lib/passport/rewards";
import { MODE_SLUGS, type EditorApi, type PlusTrigger } from "./editor-types";
import { Pill, Sheet, modeMeta } from "./editor-ui";

/**
 * Appearance editor from the approved Equip design. One identity, ten Appearances, equipped per
 * Mode: pick a direction (previews use the member's own photo, name, Mode and accent), then
 * personalize it. Free members preview and personalize any Plus Appearance; only Apply opens the
 * canonical Plus sheet, and nothing unpaid is ever saved (the database trigger refuses it too).
 */

type Copy = MessageDictionary["appearance"];
type ControlKey = "namePosition" | "nameSize" | "readability" | "socials" | "accent" | "sound" | "zoom" | "motion" | "username" | "focus";
type MoreKey = "qr" | "earned";

export const pendingAppearanceKey = (modeId: string) => `setuvara:appearance-pending:${modeId}`;

/** Each Appearance's own controls, in the design's order. Username and photo focus apply to every one. */
const CONTROLS: Record<AppearanceId, ControlKey[]> = {
  immersive: ["namePosition", "nameSize", "readability", "socials", "accent", "sound", "zoom"],
  motion: ["nameSize", "motion", "socials", "accent", "sound"],
  aura: ["nameSize", "socials", "accent", "sound", "zoom"],
  clean: ["nameSize", "socials", "accent", "sound", "zoom"],
  glow: ["nameSize", "socials", "accent", "sound", "motion"],
  scene: ["nameSize", "socials", "accent", "sound", "motion"],
  frame: ["nameSize", "socials", "accent", "sound"],
  stack: ["nameSize", "socials", "accent", "sound"],
  social: ["nameSize", "accent", "sound"],
  film: ["nameSize", "socials", "accent", "sound", "motion"],
};
const ALWAYS: ControlKey[] = ["username", "focus"];

const PLUS_TAG = "#A43D36";
const focusRing = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0D0D0D]";
/** Extends a compact control's hit area to 44px tall without changing how it looks. */
const hitArea = "relative after:absolute after:inset-x-0 after:-inset-y-[5px] after:content-['']";

function useAppearance(api: EditorApi) {
  const { messages } = useI18n();
  const copy = messages.appearance;
  const saved = api.mode.appearance;
  const previewing = Boolean(api.appearancePreview);
  const working = api.appearancePreview ?? saved;
  const effective = resolveAppearance(api.mode, api.plan);
  // What the controls and the preview show: the preview (as Plus would draw it) or the live look.
  const look = previewing ? previewAppearance({ slug: api.slug, appearance: working }) : effective;
  const locked = lockedFields(saved, api.plan);
  const savedLook = previewAppearance(api.mode);
  return { copy, saved, working, previewing, effective, look, locked, savedLook };
}
type State = ReturnType<typeof useAppearance>;

const allowed = (plan: PlanCode, field: keyof ModeAppearance, value: unknown) => {
  const capability = capabilityForField(field, value);
  return capability === null || hasCapability(plan, capability);
};

/** A real ProfileRenderer at thumbnail scale. Never interactive, never plays sound. */
export function LookThumb({ api, appearance, look, width, height, zoom, radius = 14, style }: { api: EditorApi; appearance?: ModeAppearance; look?: ResolvedAppearance; width: number | string; height: number; zoom: number; radius?: number; style?: CSSProperties }) {
  const resolved = look ?? previewAppearance({ slug: api.slug, appearance: appearance ?? api.mode.appearance });
  return (
    <div aria-hidden="true" className="pointer-events-none relative shrink-0 overflow-hidden" data-look-thumb={resolved.id} inert style={{ width, height, borderRadius: radius, background: appearanceTheme(resolved.id, resolved.accent).base, ...style }}>
      <div className="mx-auto" style={{ width: 390, zoom, "--profile-vh": "844px" } as CSSProperties}>
        <ProfileRenderer memberTier={api.memberTier} mode={api.mode} plan="pro" previewLook={resolved} profile={api.profile} selectedRewards={api.selectedRewards} sound="off" viewerState="visitor_unconnected" />
      </div>
    </div>
  );
}

/** Equip an Appearance: write its id and drop the retired composition keys that would contradict it. */
function pick(api: EditorApi, state: State, id: AppearanceId) {
  const patch: Partial<ModeAppearance> = { theme: id, layout: undefined, imageTreatment: undefined };
  const next = { ...state.working, ...patch } as ModeAppearance;
  api.chooseAppearance(patch);
  if (!introducedLockedFields(state.saved, next, api.plan).length) {
    api.toast(state.copy.equippedToast.replace("{name}", APPEARANCE_NAMES[id]).replace("{mode}", api.mode.label));
  }
}

// ---------------------------------------------------------------- Section

export function AppearanceSection({ api }: { api: EditorApi }) {
  const state = useAppearance(api);
  const [more, setMore] = useState<MoreKey | null>(null);
  return (
    <>
      <div className="hidden lg:block" data-appearance-editor="desktop">
        <DesktopControls api={api} onMore={setMore} state={state} />
      </div>
      <MobileAppearance api={api} onMore={setMore} state={state} />
      {more && <MoreSheet api={api} onClose={() => setMore(null)} section={more} state={state} />}
    </>
  );
}

function firstName(api: EditorApi) {
  return api.profile.display_name.trim().split(/\s+/)[0] || api.profile.username;
}

function DesktopControls({ api, state, onMore }: { api: EditorApi; state: State; onMore: (key: MoreKey) => void }) {
  const { copy, previewing, locked, look } = state;
  return (
    <div className="flex flex-col gap-7 pb-24">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-2">
            <h1 className="font-display text-[36px] font-extrabold leading-none tracking-[-0.045em] [text-wrap:balance]">{copy.pickYourLook.replace("{name}", firstName(api))}</h1>
            <p className="max-w-[520px] text-[14px] leading-[1.5] text-black/65">{copy.pickIntro}</p>
          </div>
          <ModeSwitch api={api} />
        </div>
        <EquippedChips api={api} />
      </div>
      {locked.length > 0 && !previewing && <DowngradeCard api={api} state={state} />}

      {/* Below xl there is no preview column: the preview comes first here. */}
      <div className="flex justify-center rounded-[28px] bg-[#0D0D0D]/[0.04] py-5 xl:hidden">
        <LookThumb api={api} height={520} look={look} radius={28} width={300} zoom={300 / 390} />
      </div>

      <section className="flex flex-col gap-3" aria-labelledby="equip-heading">
        <h2 className="font-label text-[11px] font-normal uppercase tracking-[0.14em]" id="equip-heading">1 · {copy.equipDirection}</h2>
        <ul className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(118px,1fr))]" data-appearance-picker>
          {APPEARANCES.map((id) => <li key={id}><DirectionTile api={api} id={id} state={state} /></li>)}
        </ul>
      </section>

      <section className="flex flex-col gap-4" aria-labelledby="personalize-heading">
        <h2 className="font-label text-[11px] font-normal uppercase tracking-[0.14em]" id="personalize-heading">2 · {copy.personalize.replace("{name}", APPEARANCE_NAMES[look.id].toUpperCase())}</h2>
        <div className="flex flex-col gap-5 rounded-[22px] bg-white p-5 shadow-[inset_0_0_0_1px_#0D0D0D14]">
          {[...CONTROLS[look.id], ...ALWAYS].map((key) => <Control api={api} control={key} key={key} state={state} />)}
        </div>
      </section>

      <MoreRows api={api} onMore={onMore} state={state} />
      <ResetAppearance api={api} state={state} />
      <p aria-live="polite" className="sr-only">{previewing ? copy.previewing.replace("{name}", APPEARANCE_NAMES[look.id]) : ""}</p>
      {previewing && <div className="sticky bottom-4 z-10 xl:hidden"><PreviewingBar api={api} state={state} /></div>}
    </div>
  );
}

function ModeSwitch({ api, dark = false }: { api: EditorApi; dark?: boolean }) {
  return (
    <div aria-label="Mode" className={`flex gap-1 rounded-full p-1 ${dark ? "bg-[#F5F4EF]/10" : "bg-[#0D0D0D]/[0.06]"}`} role="tablist">
      {MODE_SLUGS.map((slug) => {
        const on = slug === api.slug;
        return (
          <button aria-selected={on} className={`${hitArea} flex min-h-[34px] items-center rounded-full px-2.5 text-[12.5px] font-semibold min-[375px]:px-3.5 min-[375px]:text-[13px] ${focusRing}`} key={slug} onClick={() => api.go("appearance", slug)} role="tab" style={{ background: on ? (dark ? "#F5F4EF" : "#0D0D0D") : "transparent", color: on ? (dark ? "#0D0D0D" : "#F5F4EF") : dark ? "#F5F4EF" : "#0D0D0D" }} type="button">{modeMeta[slug].name}</button>
        );
      })}
    </div>
  );
}

/** "Personal · Immersive": what each Mode wears right now. */
function EquippedChips({ api }: { api: EditorApi }) {
  const { messages } = useI18n();
  return (
    <ul className="flex flex-wrap gap-2" data-equipped-chips>
      {api.modes.map((item) => {
        const look = resolveAppearance(item, api.plan);
        return (
          <li className="flex h-8 items-center gap-2 rounded-full px-3 text-[12.5px] font-semibold shadow-[inset_0_0_0_1px_#0D0D0D1F]" key={item.id} style={{ background: item.slug === api.slug ? "#FFFFFF" : "transparent" }}>
            <span aria-hidden="true" className="size-2 rounded-full" style={{ background: look.accent }} />
            {messages.appearance.modeEquipped.replace("{mode}", modeMeta[item.slug].name).replace("{name}", APPEARANCE_NAMES[look.id])}
          </li>
        );
      })}
    </ul>
  );
}

function DirectionTile({ api, state, id, width, height = 196, zoom }: { api: EditorApi; state: State; id: AppearanceId; width?: number; height?: number; zoom?: number }) {
  const { copy, look, locked, effective } = state;
  const on = look.id === id;
  const equipped = effective.id === id && !state.previewing;
  const savedInactive = locked.includes("theme") && state.savedLook.id === id;
  const isFree = isFreeAppearance(id);
  const thumb = previewAppearance({ slug: api.slug, appearance: { ...state.working, theme: id, layout: undefined, imageTreatment: undefined } as ModeAppearance });
  const tileZoom = zoom ?? 0.3;
  return (
    <div className="relative flex min-w-0 flex-col gap-1.5" data-direction={id} style={width ? { width, flex: "none" } : undefined}>
      <LookThumb api={api} height={height} look={thumb} style={{ boxShadow: on ? "0 0 0 2px #F5F4EF, 0 0 0 4px #FF5A4F" : savedInactive ? "inset 0 0 0 1.5px #0D0D0D, inset 0 0 0 3px #F5F4EF" : "inset 0 0 0 1px #0D0D0D1F" }} width="100%" zoom={tileZoom} />
      <span className="flex items-baseline justify-between gap-1.5">
        <span className="text-[13px] font-bold leading-[1.1]">{APPEARANCE_NAMES[id]}</span>
        <span className="font-label text-[9px] uppercase tracking-[0.1em]" style={{ color: isFree ? "#0D0D0DB3" : PLUS_TAG }}>{isFree ? copy.free : copy.plus}</span>
      </span>
      <span className="line-clamp-2 text-[11.5px] leading-[1.3] text-black/60">{equipped ? copy.equippedOn.replace("{name}", api.mode.label) : savedInactive ? copy.inactive : APPEARANCE_LINES[id]}</span>
      <button aria-label={`${APPEARANCE_NAMES[id]}${isFree ? "" : ` · ${copy.plus}`}`} aria-pressed={on} className={`absolute inset-0 rounded-[14px] ${focusRing}`} onClick={() => pick(api, state, id)} type="button" />
    </div>
  );
}

// ---------------------------------------------------------------- Controls

type Option<T extends string | number> = { value: T; label: string; plus: boolean };

function Segment<T extends string | number>({ label, options, value, onPick, locked, copy }: { label: string; options: Option<T>[]; value: T; onPick: (value: T) => void; locked: boolean; copy: Copy }) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 flex w-full items-baseline justify-between gap-3 text-[13px] font-semibold">
        <span>{label}</span>
        {locked && <span className="font-label text-[9.5px] uppercase tracking-[0.1em]" style={{ color: PLUS_TAG }}>{copy.plusPreviewing}</span>}
      </legend>
      <div className="flex flex-wrap gap-1 rounded-[18px] bg-[#0D0D0D]/[0.06] p-1" role="radiogroup" aria-label={label}>
        {options.map((option) => {
          const on = option.value === value;
          return (
            <button aria-checked={on} className={`${hitArea} flex min-h-9 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-3 text-[12.5px] font-semibold ${focusRing}`} key={String(option.value)} onClick={() => onPick(option.value)} role="radio" style={{ background: on ? "#0D0D0D" : "transparent", color: on ? "#F5F4EF" : "#0D0D0D" }} type="button">
              {option.label}
              {option.plus && <span aria-label={copy.plus} className="size-1.5 rounded-full bg-[#FF5A4F]" />}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function Control({ api, state, control }: { api: EditorApi; state: State; control: ControlKey }) {
  const { copy, look, working } = state;
  const plan = api.plan;
  const choose = (patch: Partial<ModeAppearance>) => api.chooseAppearance(patch);
  const premium = (field: keyof ModeAppearance, value: unknown) => !allowed(plan, field, value);
  const previewLocked = (field: keyof ModeAppearance) => state.previewing && premium(field, working[field]);
  switch (control) {
    case "nameSize":
      return <Segment copy={copy} label={copy.nameSize} locked={previewLocked("portraitNameSize")} onPick={(value) => choose({ portraitNameSize: value === "standard" ? undefined : value })} options={NAME_SIZES.map((value) => ({ value, label: copy.sizes[value], plus: premium("portraitNameSize", value) }))} value={look.nameSize} />;
    case "namePosition":
      return <Segment copy={copy} label={copy.namePosition} locked={previewLocked("namePosition")} onPick={(value) => choose({ namePosition: value === "auto" ? undefined : value })} options={NAME_POSITIONS.map((value) => ({ value, label: copy.positions[value], plus: premium("namePosition", value) }))} value={look.namePosition} />;
    case "readability":
      return <Segment copy={copy} label={copy.readability} locked={previewLocked("readability")} onPick={(value) => choose({ readability: value === "auto" ? undefined : value })} options={READABILITY.map((value) => ({ value, label: copy.readabilities[value], plus: premium("readability", value) }))} value={look.readability} />;
    case "socials":
      return (
        <div className="flex flex-col gap-3" data-social-control>
          <Segment copy={copy} label={copy.socials} locked={false} onPick={(value) => choose({ socialStyle: value === "links" ? "hidden" : defaultSocialStyle(look.id) })} options={(["name", "links"] as const).map((value) => ({ value, label: copy.socialPlacements[value], plus: false }))} value={socialPlacement(look.socialStyle)} />
          {look.socialStyle !== "hidden" && <Segment copy={copy} label={copy.socialStyle} locked={false} onPick={(value) => choose({ socialStyle: value })} options={SOCIAL_STYLES.filter((value) => value !== "hidden").map((value) => ({ value, label: copy.socialStyles[value], plus: false }))} value={look.socialStyle} />}
        </div>
      );
    case "motion":
      return <Segment copy={copy} label={copy.motion} locked={previewLocked("motion")} onPick={(value) => choose({ motion: value })} options={MOTION_LEVELS.map((value) => ({ value, label: copy.motions[value], plus: premium("motion", value) }))} value={look.motion} />;
    case "zoom":
      return <Segment copy={copy} label={copy.zoom} locked={false} onPick={(value) => choose({ portraitZoom: value === 100 ? undefined : value })} options={EDITOR_ZOOMS.map((value) => ({ value, label: `${value}%`, plus: false }))} value={look.zoom} />;
    case "sound":
      return (
        <div className="flex flex-col gap-1.5">
          <Segment copy={copy} label={copy.soundtrack} locked={previewLocked("soundtrackPresentation")} onPick={(value) => choose({ soundtrackPresentation: value, soundStyle: undefined })} options={SOUND_PRESENTATIONS.map((value) => ({ value, label: copy.soundPresentations[value], plus: premium("soundtrackPresentation", value) }))} value={look.soundPresentation} />
          {!soundtrackBlock(api.mode) && <p className="text-[12.5px] text-black/60">{copy.noSoundtrack}</p>}
        </div>
      );
    case "accent":
      return <AccentControl api={api} state={state} />;
    case "username":
      return (
        <button aria-checked={look.showUsername} className={`flex min-h-11 items-center justify-between gap-3 text-left text-[13px] font-semibold ${focusRing}`} onClick={() => choose({ portraitShowUsername: !look.showUsername })} role="switch" type="button">
          <span>{copy.showUsername}</span>
          <span aria-hidden="true" className={`relative h-7 w-12 rounded-full ${look.showUsername ? "bg-[#0D0D0D]" : "bg-black/20"}`}><span className={`absolute top-1 size-5 rounded-full bg-white transition-transform ${look.showUsername ? "left-6" : "left-1"}`} /></span>
        </button>
      );
    case "focus":
      return api.mode.image_url ? <Pill className="self-start" onClick={api.recropPhoto}>{copy.adjustFocus}</Pill> : <p className="text-[12.5px] text-black/60">{copy.noPhoto}</p>;
  }
}

function AccentControl({ api, state }: { api: EditorApi; state: State }) {
  const { copy, look } = state;
  const custom = !ACCENT_PRESETS.some((preset) => preset.hex === look.accent);
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-[13px] font-semibold">{copy.colour}</legend>
      <div className="flex flex-wrap items-center gap-2.5">
        {ACCENT_PRESETS.map((preset) => {
          const on = look.accent === preset.hex;
          return <button aria-label={copy.accentLabel.replace("{name}", copy.accents[preset.id])} aria-pressed={on} className={`size-11 rounded-full ${focusRing}`} key={preset.id} onClick={() => api.chooseAppearance({ accent: preset.hex })} style={{ background: preset.hex, boxShadow: on ? "0 0 0 3px #F5F4EF, 0 0 0 5px #0D0D0D" : "none" }} title={copy.accents[preset.id]} type="button" />;
        })}
        <label className="relative grid size-11 cursor-pointer place-items-center rounded-full text-lg focus-within:outline focus-within:outline-2 focus-within:outline-offset-2" style={custom ? { background: look.accent, boxShadow: "0 0 0 3px #F5F4EF, 0 0 0 5px #0D0D0D" } : { boxShadow: "inset 0 0 0 1.5px #0D0D0D59" }} title={copy.custom}>
          {!custom && <span aria-hidden="true">+</span>}
          <input aria-label={copy.customAccent} className="absolute inset-0 size-full cursor-pointer opacity-0" onChange={(event) => { if (/^#[\da-f]{6}$/i.test(event.target.value)) api.chooseAppearance({ accent: event.target.value.toUpperCase() }); }} type="color" value={look.accent.toLowerCase()} />
        </label>
      </div>
    </fieldset>
  );
}

function MoreRows({ api, state, onMore }: { api: EditorApi; state: State; onMore: (key: MoreKey) => void }) {
  const { copy, look } = state;
  const rows: { key: MoreKey; title: string; value: string }[] = [
    { key: "qr", title: copy.qr, value: copy.qrStyles[look.qrStyle] },
    { key: "earned", title: copy.rowEarned, value: earnedSummary(api) ?? copy.none },
  ];
  return (
    <ul className="flex flex-col border-t border-black/10">
      {rows.map((row) => (
        <li className="border-b border-black/10" key={row.key}>
          <button className={`flex min-h-[50px] w-full items-center justify-between gap-3 text-left ${focusRing}`} onClick={() => onMore(row.key)} type="button">
            <span className="text-[14.5px] font-semibold">{row.title}</span>
            <span className="flex min-w-0 items-center gap-2 text-[13px] text-black/70"><span className="truncate">{row.value}</span><span aria-hidden="true">›</span></span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function ResetAppearance({ api, state }: { api: EditorApi; state: State }) {
  const { copy } = state;
  return (
    <div className="flex flex-col gap-2">
      <button className={`min-h-11 self-start rounded-full px-4 text-[13px] font-semibold shadow-[inset_0_0_0_1.5px_#0D0D0D33] ${focusRing}`} data-reset-appearance onClick={() => { api.resetAppearance(); api.toast(copy.resetToast); }} type="button">{copy.reset}</button>
      <p className="max-w-[520px] text-[12px] leading-5 text-black/55">{copy.resetNote}</p>
    </div>
  );
}

function earnedSummary(api: EditorApi) {
  const names = (["profile_mark", "profile_treatment", "accent"] as const)
    .map((category) => PASSPORT_REWARDS.find((reward) => reward.id === api.selectedRewards[category])?.name)
    .filter(Boolean);
  return names.length ? names.join(" · ") : null;
}

export function PreviewingBar({ api, state }: { api: EditorApi; state: State }) {
  const { copy, look } = state;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-[18px] bg-[#0D0D0D] py-3 pl-4 pr-3 text-[#F5F4EF]" data-previewing-bar>
      <span className="flex min-w-0 items-center gap-2 text-[14px] font-semibold"><MemberBadge decorative size={18} tier="plus" /><span className="truncate">{copy.previewing.replace("{name}", APPEARANCE_NAMES[look.id])}</span></span>
      <div className="flex gap-1.5">
        <button className="flex min-h-10 items-center rounded-full px-3.5 text-[13px] font-semibold shadow-[inset_0_0_0_1px_#F5F4EF55] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F5F4EF]" onClick={api.clearAppearancePreview} type="button">{copy.backToCurrent}</button>
        <button className="flex min-h-10 items-center rounded-full bg-[#FF5A4F] px-3.5 text-[13px] font-semibold text-[#0D0D0D] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F5F4EF]" data-apply-appearance onClick={api.applyAppearancePreview} type="button">{copy.apply}</button>
      </div>
    </div>
  );
}

/** Downgrade: the saved Plus look is kept and shown as inactive, with restore. */
function DowngradeCard({ api, state }: { api: EditorApi; state: State }) {
  const { copy, effective, savedLook } = state;
  return (
    <section aria-label={copy.inactive} className="flex flex-col gap-4 rounded-[28px] bg-[#F5F4EF] p-6 shadow-[0_30px_70px_-40px_#0D0D0D80,inset_0_0_0_1px_#0D0D0D14]" data-downgrade-card>
      <div className="flex items-center gap-3.5 rounded-[20px] border-[1.5px] border-dashed border-black/25 p-4">
        <LookThumb api={api} height={108} look={savedLook} style={{ opacity: 0.9 }} width={78} zoom={0.2} />
        <div className="flex min-w-0 flex-col gap-1.5">
          <p className="flex items-center gap-1.5 text-[16px] font-bold"><MemberBadge decorative size={16} tier="plus" /><span className="truncate">{APPEARANCE_NAMES[savedLook.id]}</span><span aria-hidden="true" className="size-2.5 shrink-0 rounded-full" style={{ background: savedLook.accent }} /></p>
          <p className="text-[13.5px] leading-[1.45] text-black/70">{copy.savedBody.replace("{name}", APPEARANCE_NAMES[savedLook.id]).replace("{current}", APPEARANCE_NAMES[effective.id])}</p>
        </div>
      </div>
      <button className={`min-h-[52px] rounded-full bg-[#FF5A4F] text-[15px] font-semibold text-[#0D0D0D] ${focusRing}`} onClick={() => api.openPlusSheet({ kind: "restore", appearance: savedLook.id })} type="button">{copy.restore}</button>
    </section>
  );
}

// ---------------------------------------------------------------- More sheets

function MoreSheet({ api, state, section, onClose }: { api: EditorApi; state: State; section: MoreKey; onClose: () => void }) {
  const { copy } = state;
  return (
    <Sheet footer={<Pill className="w-full" onClick={onClose} variant="ink">{copy.done}</Pill>} onClose={onClose} title={section === "qr" ? copy.qr : copy.earnedTitle} wide>
      <div className="flex flex-col gap-6">
        {section === "qr" && <QrOptions api={api} state={state} />}
        {section === "earned" && <EarnedTreatments api={api} />}
      </div>
    </Sheet>
  );
}

function QrOptions({ api, state }: { api: EditorApi; state: State }) {
  const { copy, look } = state;
  const value = api.publicUrl(api.slug, "qr");
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {QR_STYLES.map((style) => {
          const on = look.qrStyle === style;
          return (
            <button aria-pressed={on} className={`flex flex-col gap-2 rounded-[16px] p-2.5 text-left ${focusRing}`} key={style} onClick={() => api.chooseAppearance({ qrStyle: style === "standard" ? undefined : style })} style={{ boxShadow: on ? "inset 0 0 0 2px #0D0D0D" : "inset 0 0 0 1px #0D0D0D1F" }} type="button">
              <span aria-hidden="true" className="block p-2"><QrFrame accent={look.accent} modeLabel={modeMeta[api.slug].name} name={api.profile.display_name} style={style}><QRCodeSVG bgColor="#FFFFFF" className="h-auto w-full" fgColor="#0D0D0D" level="M" marginSize={4} size={96} value={value} /></QrFrame></span>
              <span className="flex items-baseline justify-between gap-2"><span className="text-[13.5px] font-bold">{copy.qrStyles[style]}</span><span className="font-label text-[9px] uppercase tracking-[0.1em]" style={{ color: style === "standard" ? "#0D0D0DB3" : PLUS_TAG }}>{style === "standard" ? copy.free : copy.plus}</span></span>
            </button>
          );
        })}
      </div>
      <p className="text-[12.5px] leading-5 text-black/70">{copy.qrNote}</p>
    </div>
  );
}

function EarnedTreatments({ api }: { api: EditorApi }) {
  const { messages } = useI18n();
  const copy = messages.appearance;
  const rewards = PASSPORT_REWARDS.filter((reward) => ["profile_treatment", "accent", "profile_mark"].includes(reward.category));
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3"><p className="text-[13px] text-black/70">{copy.earnedBody}</p><Link className="text-[13px] font-semibold underline underline-offset-4" href="/app/passport">Passport</Link></div>
      <ul className="mt-4 divide-y divide-black/[0.07]">
        {rewards.map((reward) => {
          const unlocked = api.unlockedRewards.includes(reward.id);
          const equipped = api.selectedRewards[reward.category] === reward.id;
          return (
            <li className="flex items-center justify-between gap-3 py-3" key={reward.id}>
              <div className="min-w-0"><p className="truncate text-sm font-semibold">{reward.name}</p><p className="text-[12px] text-black/60">{unlocked ? reward.description : copy.unlocksAt.replace("{count}", String(reward.milestone))}</p></div>
              {equipped ? <span className="inline-flex min-h-9 items-center rounded-full bg-[#C7FF4A] px-3 text-[13px] font-semibold">{copy.equipped}</span>
                : unlocked ? <Pill className="min-h-9 text-[13px]" onClick={() => void api.equipReward(reward.category, reward.id)}>{copy.equip}</Pill>
                  : <span className="inline-flex min-h-9 items-center gap-1.5 px-2 text-[13px] text-black/50"><svg aria-hidden="true" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 16 16"><rect height="7" rx="1.5" width="10" x="3" y="7" /><path d="M5 7V5a3 3 0 0 1 6 0v2" /></svg>{copy.locked}</span>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------- Mobile

type MobileTab = "choose" | "personalize";

function usePreviewZoom() {
  const [zoom, setZoom] = useState(0.86);
  useEffect(() => {
    const update = () => setZoom(Math.min(1, Math.max(0.6, (window.innerWidth - 32) / 390)));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return zoom;
}

/** Full-screen preview with a bottom sheet: Choose → Preview → Personalize → Apply. */
function MobileAppearance({ api, state, onMore }: { api: EditorApi; state: State; onMore: (key: MoreKey) => void }) {
  const { copy, look, previewing } = state;
  const [tab, setTab] = useState<MobileTab>("choose");
  const [expanded, setExpanded] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const zoom = usePreviewZoom();
  const controls = [...CONTROLS[look.id], ...ALWAYS];
  const visible = expanded ? controls : controls.slice(0, 3);
  const sheetHeight = collapsed ? "148px" : "min(400px, calc(100dvh - 200px))";

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-[#0D0D0D] text-[#0D0D0D] lg:hidden" data-appearance-editor="mobile">
      <div className="flex h-[52px] shrink-0 items-center justify-between gap-2 px-3 pt-[env(safe-area-inset-top)] text-[#F5F4EF]">
        <button className="flex min-h-11 min-w-11 shrink-0 items-center gap-1 rounded-full px-2 text-[15px] font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#F5F4EF]" onClick={() => api.go("home")} type="button"><span aria-hidden="true">‹</span><span className="max-[359px]:sr-only">{copy.title}</span></button>
        <ModeSwitch api={api} dark />
      </div>
      <div aria-label={copy.previewLabel} className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-width:none]" role="region" tabIndex={0}>
        <div className="mx-auto overflow-hidden rounded-t-[22px]" inert style={{ width: 390 * zoom }}>
          <div style={{ width: 390, zoom, "--profile-vh": "844px" } as CSSProperties}>
            <ProfileRenderer attribution memberTier={api.memberTier} mode={api.mode} onShare={() => api.go("share")} plan={api.plan} previewLook={previewing ? look : undefined} profile={api.profile} selectedRewards={api.selectedRewards} sound="preview" viewerState="owner" />
          </div>
        </div>
        <div style={{ height: sheetHeight }} />
      </div>
      {previewing && (
        <div className="absolute inset-x-3 top-[60px] z-10 flex items-center justify-between gap-2 rounded-full bg-[#F5F4EF] py-1.5 pl-3 pr-1.5 shadow-[0_10px_30px_-12px_#000]" data-previewing-banner>
          <span className="flex min-w-0 items-center gap-1.5 font-label text-[10.5px] uppercase tracking-[0.12em]"><MemberBadge decorative size={16} tier="plus" /><span className="truncate">{copy.previewing.replace("{name}", APPEARANCE_NAMES[look.id])}</span></span>
          <button className={`h-9 shrink-0 rounded-full bg-[#FF5A4F] px-4 text-[13px] font-semibold ${focusRing}`} data-apply-appearance onClick={api.applyAppearancePreview} type="button">{copy.apply}</button>
        </div>
      )}

      <section aria-label={copy.controls} className="absolute inset-x-0 bottom-0 flex flex-col gap-3 rounded-t-[28px] bg-[#F5F4EF] pb-[max(18px,env(safe-area-inset-bottom))] pt-2.5 shadow-[0_-20px_50px_-30px_#000] transition-[height] duration-300 motion-reduce:transition-none" style={{ height: sheetHeight }}>
        <button aria-expanded={!collapsed} aria-label={copy.controls} className="mx-auto -my-2.5 flex h-11 w-16 shrink-0 items-start justify-center focus-visible:outline focus-visible:outline-2" onClick={() => setCollapsed((value) => !value)} type="button"><span className="mt-3.5 h-[5px] w-10 rounded-full bg-black/20" /></button>
        <div className="flex shrink-0 items-center justify-between gap-2 px-4">
          <div aria-label={copy.controls} className="flex gap-1.5" role="tablist">
            {(["choose", "personalize"] as const).map((item) => <button aria-selected={tab === item} className={`${hitArea} flex h-9 items-center rounded-full px-[13px] text-[13px] font-semibold ${focusRing}`} key={item} onClick={() => { setTab(item); setCollapsed(false); }} role="tab" style={{ background: tab === item ? "#0D0D0D" : "transparent", color: tab === item ? "#F5F4EF" : "#0D0D0D" }} type="button">{item === "choose" ? copy.choose : copy.personalizeTab}</button>)}
          </div>
          <span className="truncate text-[12.5px] font-semibold text-black/60">{APPEARANCE_NAMES[look.id]}</span>
        </div>
        {!collapsed && (
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4" role="tabpanel">
            {tab === "choose" && (
              <>
                {state.locked.length > 0 && !previewing && <p className="mb-2.5 flex items-start gap-1.5 text-[12.5px] leading-[1.4] text-black/70"><MemberBadge decorative size={14} tier="plus" /><span>{copy.savedBody.replace("{name}", APPEARANCE_NAMES[state.savedLook.id]).replace("{current}", APPEARANCE_NAMES[state.effective.id])}</span></p>}
                <ul className="-mx-4 flex gap-2.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none]" data-appearance-picker>
                  {APPEARANCES.map((id) => <li key={id}><DirectionTile api={api} height={150} id={id} state={state} width={96} zoom={96 / 390} /></li>)}
                </ul>
              </>
            )}
            {tab === "personalize" && (
              <div className="flex flex-col gap-4 pb-2">
                {visible.map((key) => <Control api={api} control={key} key={key} state={state} />)}
                <button className={`min-h-11 self-start rounded-full px-4 text-[13px] font-semibold shadow-[inset_0_0_0_1px_#0D0D0D33] ${focusRing}`} onClick={() => setExpanded((value) => !value)} type="button">{expanded ? copy.less : copy.more}</button>
                {expanded && <><MoreRows api={api} onMore={onMore} state={state} /><ResetAppearance api={api} state={state} /></>}
              </div>
            )}
          </div>
        )}
        <div className="mt-auto flex shrink-0 flex-col gap-1 px-4">
          {previewing
            ? <div className="grid grid-cols-[auto_1fr] gap-2">
              <button className={`h-[52px] rounded-full px-4 text-[14px] font-semibold shadow-[inset_0_0_0_1.5px_#0D0D0D33] ${focusRing}`} onClick={api.clearAppearancePreview} type="button">{copy.backToCurrent}</button>
              <button className={`h-[52px] rounded-full bg-[#FF5A4F] text-[15px] font-semibold text-[#0D0D0D] ${focusRing}`} data-apply-appearance onClick={api.applyAppearancePreview} type="button">{copy.apply}</button>
            </div>
            : <>
              {state.locked.length > 0 && <button className={`h-[52px] rounded-full bg-[#FF5A4F] text-[15px] font-semibold text-[#0D0D0D] ${focusRing}`} data-downgrade-card onClick={() => api.openPlusSheet({ kind: "restore", appearance: state.savedLook.id })} type="button">{copy.restore}</button>}
              <button className={`h-[52px] rounded-full bg-[#0D0D0D] text-[15px] font-semibold text-[#F5F4EF] ${focusRing}`} onClick={() => api.go("home")} type="button">{copy.done}</button>
            </>}
        </div>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------- Plus sheet

function safeCheckoutUrl(value: unknown) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && ["checkout.dodopayments.com", "test.checkout.dodopayments.com"].includes(url.hostname) ? url.toString() : null;
  } catch {
    return null;
  }
}

const price = (minor: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: minor % 100 === 0 ? 0 : 2 }).format(minor / 100);

/**
 * The canonical Plus sheet for every Appearance trigger ("Wear Glow on Personal."). It never
 * unlocks anything itself: it starts the canonical checkout; the plan is re-read from the server
 * when billing returns. Closing it keeps the preview.
 */
export function AppearancePlusSheet({ trigger, plan, modeLabel, currentName, onClose }: { trigger: PlusTrigger; plan: PlanCode; modeLabel: string; currentName: string; onClose: () => void }) {
  const { messages } = useI18n();
  const copy = messages.appearance;
  const offer = getPublicPlan("plus");
  const [interval, setBillingInterval] = useState<BillingInterval>("monthly");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const panel = useRef<HTMLElement>(null);
  const busyRef = useRef(false);
  const titleId = useId();
  const bodyId = useId();

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busyRef.current) { event.preventDefault(); onClose(); return; }
      if (event.key !== "Tab" || !panel.current) return;
      const items = [...panel.current.querySelectorAll<HTMLElement>("button:not(:disabled)")];
      const first = items[0];
      const last = items.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener("keydown", onKey); opener?.focus(); };
  }, [onClose]);

  const name = trigger.appearance ? APPEARANCE_NAMES[trigger.appearance] : "";
  const title = name && trigger.kind !== "qr" ? copy.sheetTitle.replace("{name}", name).replace("{mode}", modeLabel) : copy.sheetTitleGeneric;
  const body = trigger.kind === "restore" ? copy.sheetRestore : copy.sheetBody;
  const monthly = price(offer.monthlyPriceMinor);
  const yearly = price(offer.yearlyPriceMinor);

  async function unlock() {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setFailed(false);
    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() },
        body: JSON.stringify({ plan: "plus", interval }),
      });
      const url = response.ok ? safeCheckoutUrl(((await response.json()) as { checkoutUrl?: unknown }).checkoutUrl) : null;
      if (url) { window.location.assign(url); return; }
      setFailed(true);
    } catch {
      setFailed(true);
    }
    busyRef.current = false;
    setBusy(false);
  }

  const current = copy.previewStays.replace("{current}", currentName);
  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center sm:p-6" data-appearance-plus-sheet={trigger.kind}>
      <div aria-hidden="true" className="absolute inset-0 bg-[#0D0D0D]/55 [animation:fade-in_160ms_ease-out]" onMouseDown={() => { if (!busyRef.current) onClose(); }} />
      <section aria-describedby={bodyId} aria-labelledby={titleId} aria-modal="true" className="relative flex max-h-[calc(100dvh-16px)] w-full flex-col gap-[18px] overflow-y-auto overscroll-contain rounded-t-[28px] bg-[#F5F4EF] px-6 pb-[calc(34px+env(safe-area-inset-bottom))] pt-3 text-[#0D0D0D] shadow-[0_-24px_60px_-30px_rgba(13,13,13,.5)] outline-none sm:max-w-[440px] sm:rounded-[28px] sm:px-8 sm:pb-8 sm:pt-8" ref={panel} role="dialog" tabIndex={-1}>
        <span aria-hidden="true" className="h-[5px] w-10 shrink-0 self-center rounded-full bg-[#0D0D0D]/20 sm:hidden" />
        <div className="flex items-center gap-2 pt-1.5 sm:pt-0"><MemberBadge decorative size={22} tier="plus" /><span className="font-label text-[12px] tracking-[0.16em]">{copy.sheetKicker}</span></div>
        <h2 className="font-display text-[38px] font-extrabold leading-[0.96] tracking-[-0.05em] [text-wrap:balance]" id={titleId}>{title}</h2>
        <p className="text-[15px] leading-[1.5] text-[#0D0D0D]/70" id={bodyId}>{body}</p>
        {plan === "free" && (
          <div aria-label={copy.billingInterval} className="grid grid-cols-2 gap-1 rounded-full bg-[#0D0D0D]/[0.06] p-1" role="group">
            {(["monthly", "yearly"] as const).map((item) => (
              <button aria-pressed={interval === item} className={`min-h-11 rounded-full px-3 text-[13px] font-semibold ${focusRing} ${interval === item ? "bg-[#0D0D0D] text-[#F5F4EF]" : "text-[#0D0D0D]/70"}`} disabled={busy} key={item} onClick={() => setBillingInterval(item)} type="button">
                {item === "monthly" ? `${monthly} / month` : `${yearly} / year`}
              </button>
            ))}
          </div>
        )}
        {failed && <p className="text-[14px] text-[#A43D36]" role="alert">{copy.billingFailed}</p>}
        <div className="flex flex-col gap-2">
          <button className={`h-[52px] rounded-full bg-[#FF5A4F] text-[16px] font-semibold text-[#0D0D0D] disabled:cursor-wait disabled:opacity-70 ${focusRing}`} disabled={busy} onClick={() => void unlock()} type="button">{busy ? copy.opening : interval === "monthly" ? copy.getPlus.replace("{price}", monthly) : copy.getPlusYearly.replace("{price}", yearly)}</button>
          <button className={`h-11 rounded-full text-[15px] font-semibold disabled:opacity-50 ${focusRing}`} disabled={busy} onClick={onClose} type="button">{copy.keepPreviewing}</button>
          <p className="text-center text-[12px] leading-5 text-[#0D0D0D]/65">{interval === "monthly" ? copy.orYearly.replace("{price}", yearly) : copy.orMonthly.replace("{price}", monthly)} {current} {copy.reviewFirst}</p>
        </div>
      </section>
    </div>
  );
}

export { useAppearance };
