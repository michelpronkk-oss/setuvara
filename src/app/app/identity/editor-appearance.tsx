"use client";

import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useId, useRef, useState, type CSSProperties } from "react";

import { MemberBadge } from "@/components/app/status-badge";
import { ProfileRenderer } from "@/components/profile/profile-renderer";
import { QrFrame } from "@/components/profile/qr-frame";
import { resolveSkin } from "@/components/profile/profile-skin";
import {
  ACCENT_PRESETS, BUTTON_STYLES, CARD_STYLES, IMAGE_TREATMENTS, INTENSITIES, LAYOUT_FAMILIES, LINK_STYLES, QR_STYLES, RADII, SOUND_STYLES, THEMES, THEME_DEFAULTS, THEME_LAYOUTS,
  CONNECT_EDGE_CONTRAST, FREE_LAYOUT_FAMILIES, FREE_THEMES, capabilityForField, contrastRatio, layoutFamily, layoutForFamily, lockedFields, resolveAppearance,
  type LayoutFamily, type ResolvedAppearance, type ThemeId,
} from "@/components/profile/appearance";
import type { ModeAppearance, ModeSlug } from "@/components/profile/types";
import { soundtrackBlock } from "@/lib/blocks/registry";
import { getPublicPlan, type BillingInterval, type PlanCode } from "@/lib/billing/catalog";
import { hasCapability } from "@/lib/billing/capabilities";
import { useI18n } from "@/lib/i18n/provider";
import type { MessageDictionary } from "@/lib/i18n/messages";
import { PASSPORT_REWARDS } from "@/lib/passport/rewards";
import { MODE_SLUGS, type EditorApi, type PlusTrigger } from "./editor-types";
import { Pill, Sheet, modeMeta } from "./editor-ui";

/**
 * Appearance editor from the approved design (boards 22–26): theme, layout, colour and the
 * "More" refinements on the left, the shared ProfileRenderer on the right. Premium picks by a
 * member without Plus preview for the owner only; Apply opens the Plus sheet; nothing unpaid
 * is ever saved (the database trigger refuses it too).
 */

type Copy = MessageDictionary["appearance"];
type MoreKey = "image" | "surfaces" | "links" | "soundtrack" | "qr" | "earned";

export const pendingAppearanceKey = (modeId: string) => `setuvara:appearance-pending:${modeId}`;

const PLUS_TAG = "#A43D36";
const ring = (on: boolean) => (on ? "0 0 0 2px #F5F4EF, 0 0 0 4px #FF5A4F" : "inset 0 0 0 1px #0D0D0D1F");
const savedRing = "inset 0 0 0 1.5px #0D0D0D, inset 0 0 0 3px #F5F4EF";
/** Extends a compact control's hit area to 44px tall without changing how it looks. */
const hitArea = "relative after:absolute after:inset-x-0 after:-inset-y-[5px] after:content-['']";
const focusRing = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0D0D0D]";

function useAppearance(api: EditorApi) {
  const { messages } = useI18n();
  const copy = messages.appearance;
  const saved = api.mode.appearance;
  const previewing = Boolean(api.appearancePreview);
  const working = api.appearancePreview ?? saved;
  const effective = resolveAppearance(api.mode, api.plan);
  // What the controls and the preview show: the preview (as Plus would draw it) or the live look.
  const look = previewing ? resolveAppearance({ slug: api.slug, appearance: working }, "pro") : effective;
  const locked = lockedFields(saved, api.plan);
  const savedLook = resolveAppearance(api.mode, "pro");
  return { copy, saved, working, previewing, effective, look, locked, savedLook };
}

const free = (plan: PlanCode, field: keyof ModeAppearance, value: unknown) => {
  const capability = capabilityForField(field, value);
  return capability === null || hasCapability(plan, capability);
};

function PlanTag({ isFree, copy, className = "" }: { isFree: boolean; copy: Copy; className?: string }) {
  return <span className={`font-label text-[9px] uppercase tracking-[0.1em] ${className}`} style={{ color: isFree ? "#0D0D0DB3" : PLUS_TAG }}>{isFree ? copy.free : copy.plus}</span>;
}

function themePatch(theme: ThemeId, slug: ModeSlug, working: ModeAppearance): Partial<ModeAppearance> {
  const image = theme === "noir" || theme === "signal" ? "frame" : working.imageTreatment === "frame" ? "full-bleed" : working.imageTreatment;
  return { theme, layout: layoutForFamily(slug, THEME_DEFAULTS[theme].layout), imageTreatment: image };
}

/** A real ProfileRenderer at thumbnail scale (the design's zoomed instances). Never interactive. */
export function LookThumb({ api, appearance, look, width, height, zoom, radius = 12, style }: { api: EditorApi; appearance?: ModeAppearance; look?: ResolvedAppearance; width: number | string; height: number; zoom: number; radius?: number; style?: CSSProperties }) {
  const resolved = look ?? resolveAppearance({ slug: api.slug, appearance: appearance ?? api.mode.appearance }, "pro");
  return (
    <div aria-hidden="true" className="pointer-events-none relative shrink-0 overflow-hidden" inert style={{ width, height, borderRadius: radius, background: resolveSkin(resolved).page, ...style }}>
      <div style={{ width: 390, zoom, "--profile-vh": "844px" } as CSSProperties}>
        <ProfileRenderer memberTier={api.memberTier} mode={api.mode} plan="pro" previewLook={resolved} profile={api.profile} selectedRewards={api.selectedRewards} sound="off" viewerState="visitor_unconnected" />
      </div>
    </div>
  );
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

type State = ReturnType<typeof useAppearance>;

function DesktopControls({ api, state, onMore }: { api: EditorApi; state: State; onMore: (key: MoreKey) => void }) {
  const { copy, previewing, locked } = state;
  return (
    <div className="flex flex-col gap-[26px] pb-24">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="font-display text-[36px] font-extrabold leading-none tracking-[-0.045em]">{copy.title}</h1>
        <ModeSwitch api={api} />
      </div>
      {locked.length > 0 && !previewing && <DowngradeCard api={api} state={state} />}

      <div className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3"><h2 className="font-label text-[11px] font-normal uppercase tracking-[0.14em]">{copy.theme}</h2><span className="text-[12.5px] text-black/70">{copy.tapToPreview}</span></div>
        <div className="grid grid-cols-6 gap-2.5">
          {THEMES.map((theme) => <ThemeTile api={api} height={118} key={theme} state={state} theme={theme} zoom={0.22} />)}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="font-label text-[11px] font-normal uppercase tracking-[0.14em]">{copy.layout}</h2>
        <LayoutTiles api={api} state={state} />
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="font-label text-[11px] font-normal uppercase tracking-[0.14em]">{copy.colour}</h2>
        <ColourControls api={api} state={state} />
      </div>

      <MoreRows api={api} include={["image", "surfaces", "links", "soundtrack", "qr", "earned"]} onMore={onMore} state={state} />
      <p className="sr-only" aria-live="polite">{previewing ? copy.previewing.replace("{name}", previewName(state, copy)) : ""}</p>
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
          <button aria-selected={on} className={`${hitArea} flex min-h-[34px] items-center rounded-full px-2.5 text-[12.5px] min-[375px]:px-3.5 min-[375px]:text-[13px] font-semibold ${focusRing}`} key={slug} onClick={() => api.go("appearance", slug)} role="tab" style={{ background: on ? (dark ? "#F5F4EF" : "#0D0D0D") : "transparent", color: on ? (dark ? "#0D0D0D" : "#F5F4EF") : dark ? "#F5F4EF" : "#0D0D0D" }} type="button">{modeMeta[slug].name}</button>
        );
      })}
    </div>
  );
}

function ThemeTile({ api, state, theme, height, zoom, width }: { api: EditorApi; state: State; theme: ThemeId; height: number; zoom: number; width?: number }) {
  const { copy, look, saved, locked, working } = state;
  const on = look.theme === theme;
  const savedInactive = locked.includes("theme") && saved.theme === theme;
  const isFree = FREE_THEMES.includes(theme);
  const appearance: ModeAppearance = { theme, accent: look.accent, layout: layoutForFamily(api.slug, THEME_DEFAULTS[theme].layout), imageTreatment: THEME_DEFAULTS[theme].image };
  return (
    <div className="relative flex min-w-0 flex-col gap-1.5" style={width ? { width, flex: "none" } : undefined}>
      <LookThumb api={api} appearance={appearance} height={height} style={{ boxShadow: on ? ring(true) : savedInactive ? savedRing : ring(false) }} width="100%" zoom={zoom} />
      <span className="text-[12.5px] font-bold leading-[1.1]">{copy.themes[theme]}</span>
      <span className="flex items-center gap-1"><PlanTag copy={copy} isFree={isFree} />{savedInactive && <span className="font-label text-[9px] uppercase tracking-[0.1em] text-black/55">· {copy.inactive.split(" · ")[0]}</span>}</span>
      <button aria-label={`${copy.themes[theme]}${isFree ? "" : ` · ${copy.plus}`}`} aria-pressed={on} className={`absolute inset-0 rounded-[12px] ${focusRing}`} onClick={() => api.chooseAppearance(themePatch(theme, api.slug, working))} type="button" />
    </div>
  );
}

function LayoutTiles({ api, state, compact = false }: { api: EditorApi; state: State; compact?: boolean }) {
  const { copy, look, saved, locked } = state;
  const savedFamily = layoutFamily(api.slug, saved.layout);
  return (
    <div className={compact ? "grid grid-cols-2 gap-2 sm:grid-cols-3" : "grid grid-cols-5 gap-2"}>
      {LAYOUT_FAMILIES.map((family) => {
        const on = look.family === family;
        const allowed = THEME_LAYOUTS[look.theme].includes(family);
        const savedInactive = locked.includes("layout") && savedFamily === family;
        const isFree = FREE_LAYOUT_FAMILIES.includes(family);
        return (
          <button aria-disabled={!allowed} aria-pressed={on} className={`flex min-h-14 flex-col justify-center rounded-[12px] px-3 text-left transition ${focusRing} ${allowed ? "" : "cursor-not-allowed opacity-45"}`} key={family} onClick={() => { if (allowed) api.chooseAppearance({ layout: layoutForFamily(api.slug, family) }); }} style={{ boxShadow: on ? "inset 0 0 0 2px #0D0D0D" : savedInactive ? "inset 0 0 0 1.5px #0D0D0D, inset 0 0 0 3px #F5F4EF" : "inset 0 0 0 1px #0D0D0D1F" }} title={allowed ? undefined : copy.notAvailable.replace("{theme}", copy.themes[look.theme])} type="button">
            <span className="text-[13.5px] font-bold">{copy.layouts[family]}</span>
            <PlanTag copy={copy} isFree={isFree} />
          </button>
        );
      })}
    </div>
  );
}

function ColourControls({ api, state, stacked = false }: { api: EditorApi; state: State; stacked?: boolean }) {
  const { copy, look } = state;
  const custom = !ACCENT_PRESETS.some((preset) => preset.hex === look.accent);
  const skin = resolveSkin(look);
  const low = contrastRatio(skin.connect.background, skin.page) < CONNECT_EDGE_CONTRAST;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2.5">
        {ACCENT_PRESETS.map((preset) => {
          const on = look.accent === preset.hex;
          return <button aria-label={copy.accentLabel.replace("{name}", copy.accents[preset.id])} aria-pressed={on} className={`size-11 rounded-full ${focusRing}`} key={preset.id} onClick={() => api.chooseAppearance({ accent: preset.hex })} style={{ background: preset.hex, boxShadow: on ? "0 0 0 3px #F5F4EF, 0 0 0 5px #0D0D0D" : "none" }} title={copy.accents[preset.id]} type="button" />;
        })}
        <label className="relative grid size-11 cursor-pointer place-items-center rounded-full text-lg focus-within:outline focus-within:outline-2 focus-within:outline-offset-2" style={custom ? { background: look.accent, boxShadow: "0 0 0 3px #F5F4EF, 0 0 0 5px #0D0D0D" } : { boxShadow: "inset 0 0 0 1.5px #0D0D0D59" }} title={copy.custom}>
          {!custom && <span aria-hidden="true">+</span>}
          <input aria-label={copy.customAccent} className="absolute inset-0 size-full cursor-pointer opacity-0" onChange={(event) => { if (/^#[\da-f]{6}$/i.test(event.target.value)) api.chooseAppearance({ accent: event.target.value.toUpperCase() }); }} type="color" value={look.accent.toLowerCase()} />
        </label>
        {!stacked && <span aria-hidden="true" className="mx-1.5 h-7 w-px bg-black/15" />}
        <div aria-label={copy.intensity} className={`flex gap-0.5 rounded-full bg-[#0D0D0D]/[0.06] p-[3px] ${stacked ? "w-full" : ""}`} role="radiogroup">
          {INTENSITIES.map((intensity) => {
            const on = look.intensity === intensity;
            return <button aria-checked={on} className={`${hitArea} flex min-h-9 items-center justify-center gap-1 rounded-full px-3 text-[12.5px] font-semibold ${stacked ? "flex-1" : ""} ${focusRing}`} key={intensity} onClick={() => api.chooseAppearance({ intensity: intensity === "balanced" ? undefined : intensity })} role="radio" style={{ background: on ? "#0D0D0D" : "transparent", color: on ? "#F5F4EF" : "#0D0D0D" }} type="button">{copy.intensities[intensity]}{intensity !== "balanced" && !hasCapability(api.plan, "appearance.advanced_controls") && <span aria-hidden="true" className="size-1.5 rounded-full bg-[#FF5A4F]" />}</button>;
          })}
        </div>
      </div>
      {low && <p className="text-[12.5px] leading-5 text-black/70" role="status">{copy.lowContrast}</p>}
    </div>
  );
}

function MoreRows({ api, state, include, onMore }: { api: EditorApi; state: State; include: MoreKey[]; onMore: (key: MoreKey) => void }) {
  const { copy, look } = state;
  const rows: Record<MoreKey, { title: string; value: string; isFree: boolean | null }> = {
    image: { title: copy.image, value: copy.images[look.imageTreatment], isFree: look.imageTreatment !== "frame" },
    surfaces: { title: copy.surfaces, value: `${copy.cardStyles[look.card]} · ${copy.radii[look.radius]} · ${copy.buttonStyles[look.button]}`, isFree: false },
    links: { title: copy.links, value: copy.linkStyles[look.links], isFree: false },
    soundtrack: { title: copy.soundtrack, value: copy.soundStyles[look.soundStyle], isFree: false },
    qr: { title: copy.qr, value: copy.qrStyles[look.qrStyle], isFree: false },
    earned: { title: copy.rowEarned, value: earnedSummary(api) ?? copy.none, isFree: null },
  };
  return (
    <ul className="flex flex-col border-t border-black/10">
      {include.map((key) => {
        const row = rows[key];
        return (
          <li className="border-b border-black/10" key={key}>
            <button className={`flex min-h-[50px] w-full items-center justify-between gap-3 text-left ${focusRing}`} onClick={() => onMore(key)} type="button">
              <span className="text-[14.5px] font-semibold">{row.title}</span>
              <span className="flex min-w-0 items-center gap-2 text-[13px] text-black/70">
                <span className="truncate">{row.value}</span>
                {row.isFree !== null && <span className="shrink-0 rounded-full px-[7px] py-[3px] font-label text-[9.5px] uppercase tracking-[0.1em] text-[#0D0D0D]" style={{ background: row.isFree ? "#0D0D0D14" : "#FF5A4F" }}>{row.isFree ? copy.free : copy.plus}</span>}
                <span aria-hidden="true">›</span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function earnedSummary(api: EditorApi) {
  const names = (["profile_mark", "profile_treatment", "accent"] as const)
    .map((category) => PASSPORT_REWARDS.find((reward) => reward.id === api.selectedRewards[category])?.name)
    .filter(Boolean);
  return names.length ? names.join(" · ") : null;
}

function previewName(state: State, copy: Copy) {
  const { working, saved, look } = state;
  const parts: string[] = [];
  if (working.theme !== saved.theme && !FREE_THEMES.includes(look.theme)) parts.push(copy.themes[look.theme]);
  if (working.layout !== saved.layout && !FREE_LAYOUT_FAMILIES.includes(look.family)) parts.push(copy.layouts[look.family]);
  if (working.imageTreatment !== saved.imageTreatment && look.imageTreatment === "frame") parts.push(copy.images.frame);
  if (working.intensity !== saved.intensity && look.intensity !== "balanced") parts.push(copy.intensities[look.intensity]);
  if (["card", "radius", "button", "links"].some((field) => working[field as keyof ModeAppearance] !== saved[field as keyof ModeAppearance])) parts.push(copy.surfaces);
  if (working.soundStyle !== saved.soundStyle && look.soundStyle !== "core") parts.push(copy.soundStyles[look.soundStyle]);
  if (working.qrStyle !== saved.qrStyle && look.qrStyle !== "standard") parts.push(copy.qrStyles[look.qrStyle]);
  return parts.join(" · ") || copy.themes[look.theme];
}

/** "Standard Dark": how the live profile reads while a preview is open or Plus has lapsed. */
function currentName(state: State, copy: Copy) {
  return copy.standard.replace("{theme}", copy.themes[state.effective.theme]);
}

export function PreviewingBar({ api, state }: { api: EditorApi; state: State }) {
  const { copy } = state;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-[18px] bg-[#0D0D0D] py-3 pl-4 pr-3 text-[#F5F4EF]" data-previewing-bar>
      <span className="flex min-w-0 items-center gap-2 text-[14px] font-semibold"><MemberBadge decorative size={18} tier="plus" /><span className="truncate">{copy.previewing.replace("{name}", previewName(state, copy))}</span></span>
      <div className="flex gap-1.5">
        <button className={`flex min-h-10 items-center rounded-full px-3.5 text-[13px] font-semibold shadow-[inset_0_0_0_1px_#F5F4EF55] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F5F4EF]`} onClick={api.clearAppearancePreview} type="button">{copy.backToCurrent}</button>
        <button className="flex min-h-10 items-center rounded-full bg-[#FF5A4F] px-3.5 text-[13px] font-semibold text-[#0D0D0D] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F5F4EF]" onClick={api.applyAppearancePreview} type="button">{copy.applyWithPlus}</button>
      </div>
    </div>
  );
}

/** Downgrade (board 24): the saved premium look is kept and shown as inactive, with restore. */
function DowngradeCard({ api, state }: { api: EditorApi; state: State }) {
  const { copy, saved, effective, locked, savedLook } = state;
  const savedFamily = layoutFamily(api.slug, saved.layout);
  const arrow = (from: string, to: string) => `${from} → ${to}`;
  const rows: [string, string][] = [
    [copy.rowTheme, locked.includes("theme") ? arrow(copy.themes[savedLook.theme], currentName(state, copy)) : copy.themes[effective.theme]],
    [copy.rowLayout, locked.includes("layout") ? arrow(copy.layouts[savedFamily], copy.layouts[effective.family]) : copy.kept.replace("{value}", copy.layouts[effective.family])],
    [copy.rowAccent, copy.kept.replace("{value}", effective.accent)],
  ];
  if (locked.some((field) => ["intensity", "card", "radius", "button", "links"].includes(field))) rows.push([copy.rowSurfaces, arrow(`${copy.cardStyles[savedLook.card]} · ${copy.buttonStyles[savedLook.button]}`, copy.themeDefault)]);
  if (locked.includes("soundStyle")) rows.push([copy.rowSoundtrack, arrow(copy.soundStyles[savedLook.soundStyle], copy.soundStyles.core)]);
  if (locked.includes("qrStyle")) rows.push([copy.rowQr, arrow(copy.qrStyles[savedLook.qrStyle], copy.qrStyles.standard)]);
  const earned = earnedSummary(api);
  rows.push([copy.rowEarned, earned ? `${earned} · ${copy.unchanged}` : copy.none]);
  return (
    <section aria-label={copy.inactive} className="flex flex-col gap-4 rounded-[28px] bg-[#F5F4EF] p-6 shadow-[0_30px_70px_-40px_#0D0D0D80,inset_0_0_0_1px_#0D0D0D14]" data-downgrade-card>
      <div className="flex items-center gap-3.5 rounded-[20px] border-[1.5px] border-dashed border-black/25 p-4">
        <LookThumb api={api} height={108} look={savedLook} style={{ opacity: 0.9 }} width={78} zoom={0.2} />
        <div className="flex min-w-0 flex-col gap-1.5">
          <p className="flex items-center gap-1.5 text-[16px] font-bold"><MemberBadge decorative size={16} tier="plus" /><span className="truncate">{copy.themes[savedLook.theme]} · {copy.layouts[savedFamily]} · {savedLook.accent}</span></p>
          <p className="text-[13.5px] leading-[1.45] text-black/70">{copy.savedBody.replace("{current}", currentName(state, copy))}</p>
        </div>
      </div>
      <dl className="flex flex-col border-t border-black/10">
        {rows.map(([key, value]) => <div className="flex min-h-11 items-center justify-between gap-3 border-b border-black/10 text-[14px]" key={key}><dt className="font-semibold">{key}</dt><dd className="text-right text-black/70">{value}</dd></div>)}
      </dl>
      <button className={`min-h-[52px] rounded-full bg-[#FF5A4F] text-[15px] font-semibold text-[#0D0D0D] ${focusRing}`} onClick={() => api.openPlusSheet({ kind: "restore" })} type="button">{copy.restore}</button>
      <p className="text-[12.5px] leading-[1.45] text-black/70">{copy.restoreNote}</p>
    </section>
  );
}

// ---------------------------------------------------------------- More sheets

function OptionGrid<T extends string>({ label, options, value, onPick, name, isFree, cols = 4, disabled }: { label: string; options: readonly T[]; value: T | "default"; onPick: (value: T | undefined) => void; name: (value: T) => string; isFree: (value: T) => boolean; cols?: number; disabled?: boolean }) {
  const { messages } = useI18n();
  const copy = messages.appearance;
  return (
    <fieldset className="flex flex-col gap-2" disabled={disabled}>
      <legend className="mb-2 font-label text-[11px] uppercase tracking-[0.14em]">{label}</legend>
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {options.map((option) => {
          const on = value === option;
          return (
            <button aria-pressed={on} className={`flex min-h-14 flex-col justify-center rounded-[12px] px-3 text-left disabled:opacity-45 ${focusRing}`} key={option} onClick={() => onPick(option)} style={{ boxShadow: on ? "inset 0 0 0 2px #0D0D0D" : "inset 0 0 0 1px #0D0D0D1F" }} type="button">
              <span className="text-[13.5px] font-bold">{name(option)}</span>
              <PlanTag copy={copy} isFree={isFree(option)} />
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function MoreSheet({ api, state, section, onClose }: { api: EditorApi; state: State; section: MoreKey; onClose: () => void }) {
  const { copy, look, working } = state;
  const { messages } = useI18n();
  const titles: Record<MoreKey, string> = { image: copy.image, surfaces: copy.surfaces, links: copy.links, soundtrack: copy.soundtrack, qr: copy.qr, earned: messages.appearance.earnedTitle };
  return (
    <Sheet footer={state.previewing && section !== "earned" ? <PreviewingBar api={api} state={state} /> : <Pill className="w-full" onClick={onClose} variant="ink">{copy.done}</Pill>} onClose={onClose} title={titles[section]} wide>
      <div className="flex flex-col gap-6">
        {section === "image" && <ImageOptions api={api} state={state} />}
        {section === "surfaces" && (
          <>
            <OptionGrid cols={5} isFree={() => false} label={copy.cards} name={(value) => copy.cardStyles[value]} onPick={(card) => api.chooseAppearance({ card })} options={CARD_STYLES} value={working.card ? look.card : "default"} />
            <div className="flex flex-col gap-2">
              <OptionGrid cols={3} disabled={look.theme === "editorial"} isFree={() => false} label={copy.corners} name={(value) => copy.radii[value]} onPick={(radius) => api.chooseAppearance({ radius })} options={RADII} value={working.radius ? look.radius : "default"} />
              {look.theme === "editorial" && <p className="text-[12.5px] text-black/70">{copy.editorialSharp}</p>}
            </div>
            <OptionGrid cols={4} isFree={() => false} label={copy.buttons} name={(value) => copy.buttonStyles[value]} onPick={(button) => api.chooseAppearance({ button })} options={BUTTON_STYLES} value={working.button ? look.button : "default"} />
            <ThemeDefaultButton active={!working.card && !working.radius && !working.button} copy={copy} onClick={() => api.chooseAppearance({ card: undefined, radius: undefined, button: undefined })} />
          </>
        )}
        {section === "links" && (
          <>
            <OptionGrid cols={4} isFree={() => false} label={copy.linkStyle} name={(value) => copy.linkStyles[value]} onPick={(links) => api.chooseAppearance({ links })} options={LINK_STYLES} value={working.links ? look.links : "default"} />
            <ThemeDefaultButton active={!working.links} copy={copy} onClick={() => api.chooseAppearance({ links: undefined })} />
          </>
        )}
        {section === "soundtrack" && (
          <>
            <OptionGrid cols={4} isFree={(value) => value === "core"} label={copy.soundtrack} name={(value) => copy.soundStyles[value]} onPick={(soundStyle) => api.chooseAppearance({ soundStyle: soundStyle === "core" ? undefined : soundStyle })} options={SOUND_STYLES} value={look.soundStyle} />
            {!soundtrackBlock(api.mode) && <p className="text-[13px] text-black/70">{copy.noSoundtrack}</p>}
          </>
        )}
        {section === "qr" && <QrOptions api={api} state={state} />}
        {section === "earned" && <EarnedTreatments api={api} />}
      </div>
    </Sheet>
  );
}

function ThemeDefaultButton({ active, onClick, copy }: { active: boolean; onClick: () => void; copy: Copy }) {
  return <button aria-pressed={active} className={`min-h-11 self-start rounded-full px-4 text-[13px] font-semibold ${focusRing}`} onClick={onClick} style={{ boxShadow: active ? "inset 0 0 0 2px #0D0D0D" : "inset 0 0 0 1px #0D0D0D33" }} type="button">{copy.themeDefault}</button>;
}

function ImageOptions({ api, state }: { api: EditorApi; state: State }) {
  const { copy, look } = state;
  return (
    <div className="flex flex-col gap-3">
      <OptionGrid cols={4} isFree={(value) => free(api.plan, "imageTreatment", value) || value !== "frame"} label={copy.image} name={(value) => copy.images[value]} onPick={(imageTreatment) => api.chooseAppearance({ imageTreatment })} options={IMAGE_TREATMENTS} value={look.imageTreatment} />
      {api.mode.image_url ? <Pill className="self-start" onClick={api.recropPhoto}>{copy.adjustFocus}</Pill> : <p className="text-[13px] text-black/70">{copy.noPhoto}</p>}
    </div>
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
              <span className="flex items-baseline justify-between gap-2"><span className="text-[13.5px] font-bold">{copy.qrStyles[style]}</span><PlanTag copy={copy} isFree={style === "standard"} /></span>
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

// ---------------------------------------------------------------- Mobile (board 26)

type MobileTab = "theme" | "layout" | "colour" | "image" | "more";

function MobileAppearance({ api, state, onMore }: { api: EditorApi; state: State; onMore: (key: MoreKey) => void }) {
  const { copy, look, previewing } = state;
  const [tab, setTab] = useState<MobileTab>("theme");
  const [collapsed, setCollapsed] = useState(false);
  const drag = useRef<number | null>(null);
  const tabs: MobileTab[] = ["theme", "layout", "colour", "image", "more"];
  const tabLabel: Record<MobileTab, string> = { theme: copy.theme, layout: copy.layout, colour: copy.colour, image: copy.image, more: copy.more };
  const sheetHeight = collapsed ? "132px" : "min(430px, calc(100dvh - 236px))";

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-[#0D0D0D] text-[#0D0D0D] lg:hidden" data-appearance-editor="mobile">
      <div className="flex h-[52px] shrink-0 items-center justify-between gap-2 px-3 pt-[env(safe-area-inset-top)] text-[#F5F4EF]">
        <button className="flex min-h-11 min-w-11 shrink-0 items-center gap-1 rounded-full px-2 text-[15px] font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#F5F4EF]" onClick={() => api.go("home")} type="button"><span aria-hidden="true">‹</span><span className="max-[359px]:sr-only">{copy.title}</span></button>
        <ModeSwitch api={api} dark />
      </div>
      <div className="relative mx-auto flex min-h-0 w-full justify-center px-4 pt-1.5" style={{ height: `calc(100dvh - 52px - ${sheetHeight} + 4px)` }}>
        <div aria-label={copy.previewLabel} className="relative h-full max-h-full w-[234px] overflow-y-auto overscroll-contain rounded-[22px] [scrollbar-width:none]" role="region" style={{ height: collapsed ? "100%" : "min(356px, 100%)" }} tabIndex={0}>
          <div inert style={{ width: 390, zoom: 0.6, "--profile-vh": "844px" } as CSSProperties}>
            <ProfileRenderer attribution memberTier={api.memberTier} mode={api.mode} onShare={() => api.go("share")} plan={api.plan} previewLook={previewing ? look : undefined} profile={api.profile} selectedRewards={api.selectedRewards} sound="preview" viewerState="owner" />
          </div>
        </div>
        {previewing && <span className="absolute left-7 top-4 flex h-[30px] items-center gap-[7px] rounded-full bg-[#F5F4EF] pl-2 pr-3 font-label text-[10.5px] uppercase tracking-[0.12em]"><MemberBadge decorative size={16} tier="plus" />{copy.previewing.replace("{name}", previewName(state, copy))}</span>}
      </div>

      <section aria-label={copy.controls} className="absolute inset-x-0 bottom-0 flex flex-col gap-3.5 rounded-t-[28px] bg-[#F5F4EF] pb-[max(26px,env(safe-area-inset-bottom))] pt-2.5 transition-[height] duration-300 motion-reduce:transition-none" style={{ height: sheetHeight }}>
        <button aria-expanded={!collapsed} aria-label={copy.controls} className="mx-auto -my-2.5 flex h-11 w-16 shrink-0 touch-none items-start justify-center focus-visible:outline focus-visible:outline-2" onClick={() => setCollapsed((value) => !value)} onPointerDown={(event) => { drag.current = event.clientY; }} onPointerUp={(event) => { if (drag.current === null) return; const delta = event.clientY - drag.current; drag.current = null; if (delta > 30) setCollapsed(true); else if (delta < -30) setCollapsed(false); }} type="button"><span className="mt-3.5 h-[5px] w-10 rounded-full bg-black/20" /></button>
        <div aria-label={copy.controls} className="-my-[5px] flex shrink-0 gap-1.5 overflow-x-auto px-4 py-[5px] [scrollbar-width:none]" role="tablist">
          {tabs.map((item) => <button aria-selected={tab === item} className={`${hitArea} flex h-9 shrink-0 items-center rounded-full px-[13px] text-[13px] font-semibold ${focusRing}`} key={item} onClick={() => { setTab(item); setCollapsed(false); }} role="tab" style={{ background: tab === item ? "#0D0D0D" : "transparent", color: tab === item ? "#F5F4EF" : "#0D0D0D" }} type="button">{tabLabel[item]}</button>)}
        </div>
        {!collapsed && (
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4" role="tabpanel">
            {tab === "theme" && state.locked.length > 0 && !previewing && <p className="mb-2.5 flex items-start gap-1.5 text-[12.5px] leading-[1.4] text-black/70"><MemberBadge decorative size={14} tier="plus" /><span>{copy.savedBody.replace("{current}", currentName(state, copy))}</span></p>}
            {tab === "theme" && (
              <div className="-mx-4 flex gap-2.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
                {THEMES.map((theme) => <ThemeTile api={api} height={134} key={theme} state={state} theme={theme} width={96} zoom={0.246} />)}
              </div>
            )}
            {tab === "layout" && <LayoutTiles api={api} compact state={state} />}
            {tab === "colour" && <ColourControls api={api} stacked state={state} />}
            {tab === "image" && <ImageOptions api={api} state={state} />}
            {tab === "more" && <MoreRows api={api} include={["surfaces", "links", "soundtrack", "qr", "earned"]} onMore={onMore} state={state} />}
          </div>
        )}
        <div className="mt-auto flex shrink-0 flex-col gap-1 px-4">
          {previewing
            ? <>
              <button className={`h-[52px] rounded-full bg-[#FF5A4F] text-[15px] font-semibold text-[#0D0D0D] ${focusRing}`} onClick={api.applyAppearancePreview} type="button">{copy.applyWithPlus}</button>
              {!collapsed && <button className={`h-11 rounded-full text-[15px] font-semibold ${focusRing}`} onClick={api.clearAppearancePreview} type="button">{copy.backToCurrent}</button>}
            </>
            : <>
              {state.locked.length > 0 && <button className={`h-[52px] rounded-full bg-[#FF5A4F] text-[15px] font-semibold text-[#0D0D0D] ${focusRing}`} data-downgrade-card onClick={() => api.openPlusSheet({ kind: "restore" })} type="button">{copy.restore}</button>}
              <button className={`h-[52px] rounded-full bg-[#0D0D0D] text-[15px] font-semibold text-[#F5F4EF] ${focusRing}`} onClick={() => api.go("home")} type="button">{copy.saveAppearance}</button>
            </>}
        </div>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------- Plus sheet (board 22)

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
 * One sheet for every Appearance trigger. It never unlocks anything itself: it starts the
 * canonical Plus checkout; the plan is re-read from the server when billing returns.
 */
export function AppearancePlusSheet({ trigger, plan, onClose }: { trigger: PlusTrigger; plan: PlanCode; onClose: () => void }) {
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

  const name = trigger.kind === "theme" ? copy.themes[trigger.name as ThemeId] ?? trigger.name
    : trigger.kind === "layout" ? copy.layouts[(LAYOUT_FAMILIES.includes(trigger.name as LayoutFamily) ? trigger.name : "portrait") as LayoutFamily]
      : trigger.kind === "soundtrack" ? copy.soundStyles[trigger.name as keyof Copy["soundStyles"]] ?? ""
        : trigger.kind === "qr" ? copy.qrStyles[trigger.name as keyof Copy["qrStyles"]] ?? "" : "";
  const body = { theme: copy.sheetTheme, layout: copy.sheetLayout, advanced: copy.sheetAdvanced, image: copy.sheetImage, soundtrack: copy.sheetSoundtrack, qr: copy.sheetQr, restore: copy.sheetRestore }[trigger.kind].replace("{name}", name ?? "");
  const items: [string, string][] = [[copy.sheetItems.looks, copy.sheetItems.looksTag], [copy.sheetItems.surfaces, copy.sheetItems.surfacesTag], [copy.sheetItems.presentation, copy.sheetItems.presentationTag]];

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

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center sm:p-6" data-appearance-plus-sheet={trigger.kind}>
      <div aria-hidden="true" className="absolute inset-0 bg-[#0D0D0D]/55 [animation:fade-in_160ms_ease-out]" onMouseDown={() => { if (!busyRef.current) onClose(); }} />
      <section aria-describedby={bodyId} aria-labelledby={titleId} aria-modal="true" className="relative flex max-h-[calc(100dvh-16px)] w-full flex-col gap-[18px] overflow-y-auto overscroll-contain rounded-t-[28px] bg-[#F5F4EF] px-6 pb-[calc(34px+env(safe-area-inset-bottom))] pt-3 text-[#0D0D0D] shadow-[0_-24px_60px_-30px_rgba(13,13,13,.5)] outline-none sm:max-w-[440px] sm:rounded-[28px] sm:px-8 sm:pb-8 sm:pt-8" ref={panel} role="dialog" tabIndex={-1}>
        <span aria-hidden="true" className="h-[5px] w-10 shrink-0 self-center rounded-full bg-[#0D0D0D]/20 sm:hidden" />
        <div className="flex items-center gap-2 pt-1.5 sm:pt-0"><MemberBadge decorative size={22} tier="plus" /><span className="font-label text-[12px] tracking-[0.16em]">{copy.sheetKicker}</span></div>
        <h2 className="font-display text-[38px] font-extrabold leading-[0.96] tracking-[-0.05em] [text-wrap:balance]" id={titleId}>{copy.sheetTitle}</h2>
        <p className="text-[15px] leading-[1.5] text-[#0D0D0D]/70" id={bodyId}>{body}</p>
        <ul className="flex flex-col border-t border-[#0D0D0D]/10">
          {items.map(([label, tag]) => <li className="flex min-h-11 items-center justify-between gap-3 border-b border-[#0D0D0D]/10" key={label}><span className="text-[14.5px] font-semibold">{label}</span><span className="font-label text-[10.5px] text-[#0D0D0D]/70">{tag}</span></li>)}
        </ul>
        {plan === "free" && (
          <div aria-label={copy.billingInterval} className="grid grid-cols-2 gap-1 rounded-full bg-[#0D0D0D]/[0.06] p-1" role="group">
            {(["monthly", "yearly"] as const).map((item) => (
              <button aria-pressed={interval === item} className={`min-h-11 rounded-full px-3 text-[13px] font-semibold ${focusRing} ${interval === item ? "bg-[#0D0D0D] text-[#F5F4EF]" : "text-[#0D0D0D]/70"}`} disabled={busy} key={item} onClick={() => setBillingInterval(item)} type="button">
                {item === "monthly" ? copy.monthly.replace("{price}", price(offer.monthlyPriceMinor)) : copy.yearly.replace("{price}", price(offer.yearlyPriceMinor))}
              </button>
            ))}
          </div>
        )}
        {failed && <p className="text-[14px] text-[#A43D36]" role="alert">{copy.billingFailed}</p>}
        <div className="flex flex-col gap-2">
          <button className={`h-[52px] rounded-full bg-[#FF5A4F] text-[16px] font-semibold text-[#0D0D0D] disabled:cursor-wait disabled:opacity-70 ${focusRing}`} disabled={busy} onClick={() => void unlock()} type="button">{busy ? copy.opening : copy.unlock}</button>
          <p className="text-center text-[12px] text-[#0D0D0D]/65">{copy.reviewFirst}</p>
          <button className={`h-11 rounded-full text-[15px] font-semibold disabled:opacity-50 ${focusRing}`} disabled={busy} onClick={onClose} type="button">{copy.keepPreviewing}</button>
        </div>
      </section>
    </div>
  );
}

export { useAppearance };
