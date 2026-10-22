"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { recordProfileShare } from "@/lib/analytics/client";
import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";

import { ProviderMark } from "@/components/links/provider-mark";
import { ProviderPicker } from "@/components/links/provider-picker";
import { meetMarkBottom, meetMarkTop, MeetMark } from "@/components/marketing/brand";
import { ProfileRenderer } from "@/components/profile/profile-renderer";
import { FocusedPhoto } from "@/components/profile/focused-photo";
import { modeFocus } from "@/components/profile/photo-focus";
import { APPEARANCE_NAMES, extraSlideLimit, inkOnAccent, QR_STYLES, resolveAppearance, resolveQrStyle, type QrStyle } from "@/components/profile/appearance";
import { QrFrame } from "@/components/profile/qr-frame";
import type { ModeSlug, ProfileLink, ProfileMode } from "@/components/profile/types";
import { hasCapability } from "@/lib/billing/capabilities";
import { useI18n } from "@/lib/i18n/provider";
import { linkProviderById, MODE_LINK_SUGGESTIONS, normalizeLinkPayload, providerForLink, resolveStoredLink, type LinkProvider } from "@/lib/links/providers";
import { PASSPORT_REWARDS, type RewardCategory } from "@/lib/passport/rewards";
import type { ConnectPolicy } from "@/lib/connections/access";
import { passExpiryLabel, useConnectPass } from "@/lib/connections/use-connect-pass";
import { isModeHandleSlug } from "@/lib/handles/mode-handle";
import { modeTools, type ModePage } from "@/components/app/side-nav";
import { GalleryRow } from "./editor-gallery";
import { PublicLinkCard } from "./editor-public-link";
import { MODE_SLUGS, SECTIONS, type EditorApi, type Section } from "./editor-types";
import { Card, Counter, Field, MonoLabel, Pill, PlusTag, SectionHeader, Segmented, TextArea, TextInput, Toggle, coral, cutCorner, ink, modeMeta, paper, previewVisitorAction } from "./editor-ui";

const modeIntro: Record<ModeSlug, string> = {
  personal: "The version of you that you give personally, to friends, communities and people you choose.",
  event: "Temporary and specific to one event. Personal and Business stay untouched.",
  business: "Clean and structured. What a client, investor or recruiter needs.",
  creator: "Your creative identity and audience-facing profile.",
};
const profileIntro: Record<ModeSlug, string> = {
  personal: "Expressive and personal. Only what you choose appears.",
  event: "Temporary and specific to this event. Personal and Business stay untouched.",
  business: "Clean and structured. What a client, investor or recruiter needs.",
  creator: "A public identity for your creative work.",
};
const CONTACT_PROVIDERS = ["email", "phone", "sms", "whatsapp", "telegram", "signal", "messenger"];

const text = (mode: ProfileMode, key: string) => (typeof mode.settings[key] === "string" ? String(mode.settings[key]) : "");

function summaries(api: EditorApi): Record<Exclude<Section, "home">, string> {
  const { mode, profile } = api;
  const hidden = mode.links.filter((link) => !link.is_visible).length;
  const contextLine = mode.slug === "personal" ? text(mode, "location") : mode.slug === "event" ? text(mode, "eventName") : mode.slug === "creator" ? text(mode, "category") : text(mode, "company");
  return {
    profile: [profile.display_name || "Add your name", contextLine, mode.image_path ? "photo set" : "no photo yet"].filter(Boolean).join(" · "),
    links: [mode.blocks?.length ? `${mode.blocks.length} block${mode.blocks.length === 1 ? "" : "s"}` : "", mode.links.length ? `${mode.links.length} link${mode.links.length === 1 ? "" : "s"}${hidden ? ` · ${hidden} hidden` : ""}` : ""].filter(Boolean).join(" · ") || "Nothing added yet",
    appearance: `${APPEARANCE_NAMES[resolveAppearance(mode, api.plan).id]} · equipped for ${mode.label}`,
    settings: `${mode.is_enabled ? "Mode is live" : "Mode is off"} · ${profile.is_published ? "public" : "draft"} · ${{ anyone: "anyone can connect", direct_only: "direct share only", nobody: "view-only" }[mode.connect_policy ?? "anyone"]}`,
    share: api.publicUrl(mode.slug).replace(/^https?:\/\//, ""),
  };
}

// ---------------------------------------------------------------- Home

/** What each Mode tool is for, shown on the Mode's Overview. */
const TOOL_NOTES: Partial<Record<ModePage, string>> = {
  events: "Create events, take RSVPs, check guests in.",
  leads: "Bookings, enquiries and pitches from your page.",
  testimonials: "Collect client quotes and choose which show.",
  builder: "Products, roadmap and verified revenue.",
  team: "Invite people to work your leads with you.",
  actions: "Giveaways, questions and sign-ups on your page.",
  audience: "Everyone who joined through your Actions.",
  work: "The films, photos and series your page leads with.",
  commerce: "Products, orders, customers and payouts.",
  collabs: "Brand deals and collaborations, start to paid.",
  kit: "A one-page media kit to send to brands.",
  insights: "Reach and growth across your platforms.",
  settings: "Studio defaults and connected platforms.",
};

export function HomeSection({ api }: { api: EditorApi }) {
  const { mode, slug } = api;
  const info = summaries(api);
  const tools = modeTools(slug).flat();
  return (
    <div>
      <p className="max-w-[560px] text-[16px] leading-7 text-black/62">{modeIntro[slug]}{info.share ? <> It lives at <span className="font-medium text-black">{info.share}</span>.</> : null}</p>

      <section aria-labelledby="sv-mode-page" className="mt-8">
        <h2 className="font-display text-[20px] font-bold tracking-[-0.03em]" id="sv-mode-page">Your page</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,200px)_minmax(0,1fr)]">
          <button className="group relative flex min-h-[220px] flex-col justify-end overflow-hidden rounded-[22px] bg-[#0D0D0D] p-5 text-left text-[#F5F4EF] focus-visible:outline-2 focus-visible:outline-offset-2" onClick={() => api.go("profile")} type="button">
            {mode.image_url && <>
              <FocusedPhoto alt="" className="opacity-60 transition duration-500 group-hover:scale-[1.03]" focus={modeFocus(mode)} sizes="240px" src={mode.image_url} />
              <span className="absolute inset-0 bg-gradient-to-t from-[#0D0D0D] via-[#0D0D0D]/45 to-transparent" />
            </>}
            <span className="relative font-display text-[22px] font-bold tracking-[-0.035em]">Profile</span>
            <span className="relative mt-1 line-clamp-2 text-[13px] text-white/75">{info.profile}</span>
          </button>
          <ul className="flex flex-col divide-y divide-black/[0.07] rounded-[22px] bg-white shadow-[inset_0_0_0_1px_rgba(13,13,13,.08)]">
            {(["links", "appearance", "share", "settings"] as const).map((id) => (
              <li key={id}>
                <button className="group flex min-h-[55px] w-full items-center gap-4 px-5 py-2.5 text-left transition-colors hover:bg-black/[0.02] focus-visible:outline-2 focus-visible:outline-offset-[-2px]" onClick={() => api.go(id)} type="button">
                  <span className="w-[104px] shrink-0 text-[15px] font-semibold">{id === "settings" ? "Settings" : SECTIONS.find((item) => item.id === id)?.title}</span>
                  <span className="min-w-0 flex-1 truncate text-[13.5px] text-black/55">{info[id]}</span>
                  <span aria-hidden="true" className="text-black/35 transition-transform group-hover:translate-x-0.5 group-hover:text-black">→</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section aria-labelledby="sv-mode-tools" className="mt-10">
        <h2 className="font-display text-[20px] font-bold tracking-[-0.03em]" id="sv-mode-tools">{modeMeta[slug].name} tools</h2>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          {tools.map((tool) => (
            <li key={tool.id}>
              <Link className="group flex h-full items-start gap-3.5 rounded-[20px] bg-white p-4 shadow-[inset_0_0_0_1px_rgba(13,13,13,.08)] transition-shadow hover:shadow-[inset_0_0_0_1.5px_#0D0D0D] focus-visible:outline-2 focus-visible:outline-offset-2 [&_svg]:size-[19px]" href={tool.href}>
                <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-full bg-[#F5F4EF]">{tool.icon}</span>
                <span className="min-w-0">
                  <span className="block text-[15px] font-semibold">{tool.label}</span>
                  <span className="mt-0.5 block text-[13px] leading-5 text-black/55">{TOOL_NOTES[tool.id]}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export function MobileHome({ api, onPreview }: { api: EditorApi; onPreview: () => void }) {
  const { mode, profile, slug } = api;
  const info = summaries(api);
  const { messages } = useI18n();
  const statusText = !profile.is_published ? "Draft · not live yet" : !mode.is_enabled ? "Mode is off" : "Live";
  return (
    <div>
      <div className="flex gap-4 rounded-[24px] bg-white p-3.5 shadow-[inset_0_0_0_1px_rgba(13,13,13,.08)]">
        {/* A div, not a button: the preview inside renders its own (inert) buttons. */}
        <div aria-label="Open full-screen preview" className="relative h-[196px] w-[104px] shrink-0 cursor-pointer overflow-hidden rounded-[18px] bg-[#0D0D0D] p-[3px]" onClick={onPreview} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onPreview(); } }} role="button" tabIndex={0}>
          <div aria-hidden="true" className="pointer-events-none h-full overflow-hidden rounded-[15px]">
            <div className="w-[360px] origin-top-left scale-[0.272] [&>article]:rounded-none" inert>
              <ProfileRenderer mode={mode} plan={api.plan} profile={profile} selectedRewards={api.selectedRewards} sound="off" viewerState="visitor_unconnected" visitorAction={previewVisitorAction(mode, messages.profile.connect)} />
            </div>
          </div>
        </div>
        <div className="flex min-w-0 flex-1 flex-col justify-center py-2">
          <h1 className="font-display text-[1.9rem] font-extrabold leading-[0.95] tracking-[-0.05em]">{modeMeta[slug].name} Mode</h1>
          <p className="mt-2 truncate font-label text-[11px] text-black/55">{info.share}</p>
          <p className="mt-2.5 flex items-center gap-2 text-[13px] font-semibold"><span aria-hidden="true" className="size-2 rounded-full" style={{ background: statusText === "Live" ? "#2BB673" : coral }} />{statusText}</p>
          <button className="mt-3 self-start text-[13px] font-semibold underline underline-offset-4" onClick={onPreview} type="button">Open full preview</button>
        </div>
      </div>

      <section aria-labelledby="sv-mobile-page" className="mt-7">
        <h2 className="px-1 font-display text-[1.3rem] font-bold tracking-[-0.04em]" id="sv-mobile-page">Your page</h2>
        <ul className="mt-2 flex flex-col divide-y divide-black/10 rounded-[22px] bg-white shadow-[inset_0_0_0_1px_rgba(13,13,13,.08)]">
          {SECTIONS.map((item) => (
            <li key={item.id}>
              <button className="flex min-h-[60px] w-full items-center gap-3 px-4 py-2.5 text-left" onClick={() => api.go(item.id)} type="button">
                <span className="min-w-0 flex-1"><span className="block text-[15px] font-semibold">{item.id === "settings" ? "Settings" : item.title}</span><span className="block truncate text-[13px] text-black/55">{info[item.id] || "Not set yet"}</span></span>
                <span aria-hidden="true" className="text-lg text-black/35">›</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="sv-mobile-tools" className="mt-8">
        <h2 className="px-1 font-display text-[1.3rem] font-bold tracking-[-0.04em]" id="sv-mobile-tools">{modeMeta[slug].name} tools</h2>
        <ul className="mt-2 flex flex-col divide-y divide-black/10 rounded-[22px] bg-white shadow-[inset_0_0_0_1px_rgba(13,13,13,.08)]">
          {modeTools(slug).flat().map((tool) => (
            <li key={tool.id}>
              <Link className="flex min-h-[64px] items-center gap-3.5 px-4 py-2.5 [&_svg]:size-[19px]" href={tool.href}>
                <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-full bg-[#F5F4EF]">{tool.icon}</span>
                <span className="min-w-0 flex-1"><span className="block text-[15px] font-semibold">{tool.label}</span><span className="block truncate text-[13px] text-black/55">{TOOL_NOTES[tool.id]}</span></span>
                <span aria-hidden="true" className="text-lg text-black/35">›</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <Link className="mt-6 inline-flex min-h-11 items-center text-sm font-semibold text-black/60 underline underline-offset-4" href="/app">Back to Setuvara home</Link>
    </div>
  );
}

// ---------------------------------------------------------------- Profile

function PhotoBlock({ api }: { api: EditorApi }) {
  const { mode, modes, profile, slug } = api;
  const personal = modes.find((item) => item.slug === "personal");
  const canBorrow = slug !== "personal" && personal?.image_path && personal.image_path !== mode.image_path;
  return (
    <div className="flex items-start gap-4 sm:gap-5">
      <button aria-label={mode.image_url ? "Crop and position photo" : "Upload a photo"} className="relative h-[110px] w-[88px] shrink-0 sm:h-[150px] sm:w-[120px] overflow-hidden bg-[#E4E2DA] transition hover:brightness-95" onClick={mode.image_url ? api.recropPhoto : api.pickPhoto} style={{ clipPath: cutCorner(34), borderRadius: 18 }} type="button">
        {mode.image_url
          ? <FocusedPhoto alt={`${profile.display_name} in ${modeMeta[slug].name} Mode`} focus={modeFocus(mode)} frameAspect={4 / 5} sizes="120px" src={mode.image_url} />
          : <span className="absolute inset-0 grid place-items-center"><span className="text-center"><span className="block font-display text-4xl font-extrabold text-black/25">{(profile.display_name.trim()[0] ?? "S").toUpperCase()}</span><span className="mt-1 block text-xs font-semibold text-black/55">Add photo</span></span></span>}
        {api.busyPhoto && <span className="absolute inset-0 grid place-items-center bg-white/70"><span className="size-6 animate-spin rounded-full border-2 border-black/20 border-t-black" /></span>}
      </button>
      <div className="min-w-0 pt-0.5 sm:pt-1">
        {/* Compact on phones, so the lines under the name start above the fold. */}
        <p className="text-sm font-semibold">Photo <span className="font-normal text-black/55">· {modeMeta[slug].name} Mode only</span></p>
        <div className="mt-2 flex flex-wrap gap-1.5 sm:mt-2.5 sm:gap-2">
          {mode.image_url ? <>
            <Pill className="max-sm:px-3" onClick={api.recropPhoto} variant="ink"><span className="sm:hidden">Crop</span><span className="max-sm:hidden">Crop & position</span></Pill>
            <Pill className="max-sm:px-3" onClick={api.pickPhoto}>Replace</Pill>
            <Pill className="text-black/60 max-sm:px-2" onClick={api.removePhoto} variant="ghost">Remove</Pill>
          </> : <Pill onClick={api.pickPhoto} variant="ink">Upload photo</Pill>}
        </div>
        {canBorrow && <button className="mt-1.5 min-h-9 text-[13px] font-semibold underline underline-offset-4" onClick={() => api.usePhotoFrom("personal")} type="button">Use my Personal photo</button>}
        {mode.image_url && <SlideshowRow api={api} />}
      </div>
    </div>
  );
}

/** Extra photos that cross-fade with the main one. Plus adds one, Pro three. */
function SlideshowRow({ api }: { api: EditorApi }) {
  const { mode, plan } = api;
  const limit = extraSlideLimit(plan);
  const slides = (mode.slide_urls ?? []).slice(0, limit);
  if (!limit) {
    return (
      <button className="mt-3 flex min-h-9 items-center gap-2 text-[13px] font-semibold" data-slideshow-upsell onClick={api.pickSlide} type="button">
        Slideshow<PlusTag />
      </button>
    );
  }
  return (
    <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-2 sm:mt-3" data-slideshow-editor>
      <p className="text-[13px] font-semibold">Slideshow <span className="font-normal text-black/55">{slides.length + 1} of {limit + 1}</span></p>
      <div className="flex flex-wrap gap-2">
        {slides.map((slide, index) => (
          <div className="relative h-[50px] w-10 overflow-hidden rounded-[10px] bg-[#E4E2DA]" data-slide-thumb key={`${slide.url}-${index}`}>
            <FocusedPhoto alt={`Slideshow photo ${index + 2}`} focus={{ x: slide.x, y: slide.y }} frameAspect={4 / 5} sizes="40px" src={slide.url} />
            <button aria-label={`Remove slideshow photo ${index + 2}`} className="absolute right-0.5 top-0.5 grid size-5 place-items-center rounded-full bg-[#0D0D0D]/75 text-[11px] font-bold text-white" onClick={() => api.removeSlide(index)} type="button">×</button>
          </div>
        ))}
        {slides.length < limit && <button aria-label="Add a slideshow photo" className="grid h-[50px] w-10 place-items-center rounded-[10px] border border-dashed border-black/25 text-lg font-semibold text-black/55 transition hover:bg-black/5" data-slide-add disabled={api.busyPhoto} onClick={api.pickSlide} type="button">+</button>}
      </div>
      {plan !== "pro" && slides.length >= limit && <p className="basis-full text-[12.5px] text-black/55">Pro slideshows hold up to four photos.</p>}
    </div>
  );
}

function NameField({ api, label = "Display name", big = false, hint }: { api: EditorApi; label?: string; big?: boolean; hint?: string }) {
  const id = useId();
  return (
    <Field error={api.fieldErrors.display_name} hint={hint ?? "Shared across all Modes"} htmlFor={id} label={label}>
      <TextInput aria-invalid={Boolean(api.fieldErrors.display_name)} autoComplete="name" big={big} id={id} maxLength={80} onChange={(event) => api.updateProfile({ display_name: event.target.value })} value={api.profile.display_name} />
    </Field>
  );
}

function SettingInput({ api, field, label, placeholder, hint, multiline = false, max }: { api: EditorApi; field: string; label: string; placeholder?: string; hint?: ReactNode; multiline?: boolean; max: number }) {
  const id = useId();
  const value = text(api.mode, field);
  return (
    <Field hint={hint ?? (multiline ? <Counter max={max} value={value} /> : undefined)} htmlFor={id} label={label}>
      {multiline
        ? <TextArea id={id} maxLength={max} onChange={(event) => api.updateSetting(field, event.target.value)} placeholder={placeholder} value={value} />
        : <TextInput id={id} maxLength={max} onChange={(event) => api.updateSetting(field, event.target.value)} placeholder={placeholder} value={value} />}
    </Field>
  );
}

function UsernameField({ api }: { api: EditorApi }) {
  const id = useId();
  const status = api.usernameStatus;
  const message = api.fieldErrors.username ?? (status === "invalid" ? "Use 3–24 lowercase letters, numbers or underscores." : status === "taken" ? "That username is taken." : undefined);
  const hint = status === "checking" ? "Checking…" : status === "available" ? <span className="font-semibold text-[#1E7B4F]">Available ✓ · your old link keeps working and stays yours</span> : `setuvara.com/${api.profile.username || "you"}`;
  return (
    <Field error={message} hint={hint} htmlFor={id} label="Username">
      <div className="relative">
        <span aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-base text-black/40">@</span>
        <TextInput aria-invalid={Boolean(message)} autoCapitalize="none" autoComplete="username" className="pl-9" id={id} maxLength={24} onChange={(event) => api.updateProfile({ username: event.target.value })} spellCheck={false} value={api.profile.username} />
      </div>
    </Field>
  );
}

export function ProfileSection({ api }: { api: EditorApi }) {
  const { slug } = api;
  const bioId = useId();
  return (
    <div>
      <SectionHeader description={profileIntro[slug]} slug={slug} title="Profile" />
      {slug === "personal" && (
        <div className="space-y-5 sm:space-y-6">
          <PhotoBlock api={api} />
          <NameField api={api} big hint="First name or what friends call you" />
          <Field error={api.fieldErrors.bio} hint={<Counter max={280} value={api.profile.bio} />} htmlFor={bioId} label="Personal line">
            <TextArea aria-invalid={Boolean(api.fieldErrors.bio)} id={bioId} maxLength={280} onChange={(event) => api.updateProfile({ bio: event.target.value })} placeholder="Film photography, late dinners, Sunday swims." value={api.profile.bio} />
          </Field>
          <UsernameField api={api} />
          <div className="grid grid-cols-2 gap-3 sm:gap-5">
            <SettingInput api={api} field="location" label="Location" max={80} placeholder="Lisbon" />
            <SettingInput api={api} field="pronouns" label="Pronouns" max={40} placeholder="she / her" />
          </div>
          <SettingInput api={api} field="note" hint="Optional" label="A little more" max={280} multiline placeholder="What you’re into lately, languages, where you’re from." />
        </div>
      )}
      {slug === "event" && (
        <div className="space-y-5 sm:space-y-6">
          <Card className="p-4 sm:p-6" tone="coral">
            <div className="flex items-baseline justify-between gap-3"><MonoLabel>The event</MonoLabel><span className="text-[13px] font-semibold">Saved on every connection</span></div>
            <label className="sr-only" htmlFor="event-name">Event name</label>
            <TextInput big className="mt-2.5 sm:mt-3" id="event-name" maxLength={100} onChange={(event) => api.updateSetting("eventName", event.target.value)} placeholder="Slush" value={text(api.mode, "eventName")} />
            <div className="mt-3 grid grid-cols-2 gap-3 sm:mt-4">
              <div><label className="mb-2 block text-sm font-semibold" htmlFor="event-city">City</label><TextInput id="event-city" maxLength={80} onChange={(event) => api.updateSetting("city", event.target.value)} placeholder="Helsinki" value={text(api.mode, "city")} /></div>
              <div><label className="mb-2 block text-sm font-semibold" htmlFor="event-dates">Dates</label><TextInput id="event-dates" maxLength={80} onChange={(event) => api.updateSetting("dateLabel", event.target.value)} placeholder="20–21 Nov 2026" value={text(api.mode, "dateLabel")} /></div>
            </div>
          </Card>
          <PhotoBlock api={api} />
          <NameField api={api} label="Name" />
          <SettingInput api={api} field="hereToMeet" hint="Shown under your name" label="Here to meet" max={280} multiline placeholder="Product designers and early-stage operators." />
          <SettingInput api={api} field="role" label="Role, project or company" max={80} placeholder="Founder · Northlight" />
        </div>
      )}
      {slug === "business" && (
        <div className="space-y-5 sm:space-y-6">
          <PhotoBlock api={api} />
          <div className="grid grid-cols-2 gap-x-3 gap-y-5 sm:gap-5">
            <NameField api={api} hint="Shared" label="Full name" />
            <SettingInput api={api} field="role" label="Role" max={80} placeholder="Partnerships Lead" />
            <SettingInput api={api} field="company" label="Company" max={100} placeholder="Lumen Labs" />
            <SettingInput api={api} field="city" label="City" max={80} placeholder="Lisbon" />
          </div>
          <SettingInput api={api} field="description" hint="Optional" label="Professional description" max={280} multiline placeholder="Add a one-line description" />
        </div>
      )}
      {slug === "creator" && (
        <div className="space-y-5 sm:space-y-6">
          <Link className="flex items-center justify-between gap-4 rounded-[22px] bg-[#0D0D0D] p-4 text-[#F5F4EF] sm:p-5" href="/app/identity/creator/work">
            <span><MonoLabel className="!text-[10px] text-[#E8A6FF]">Creator studio</MonoLabel><span className="mt-1 block text-[16px] font-semibold">Work, Commerce, Actions, Media kit and Insights</span></span>
            <span aria-hidden="true" className="text-xl">→</span>
          </Link>
          <PhotoBlock api={api} />
          <NameField api={api} label="Name" />
          <SettingInput api={api} field="tagline" hint="Shown under your name" label="What you make" max={280} multiline placeholder="Photographer and director. Quiet films about the sea." />
          <div className="grid grid-cols-2 gap-3 sm:gap-5">
            <SettingInput api={api} field="category" label="Craft" max={80} placeholder="Photographer and director" />
            <SettingInput api={api} field="city" label="City" max={80} placeholder="Lisbon" />
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Links

export function DragHandle(props: Record<string, unknown>) {
  return (
    <button aria-label="Drag to reorder" className="grid size-10 shrink-0 cursor-grab touch-none place-items-center rounded-xl text-black/35 hover:bg-black/[0.04] hover:text-black/70 active:cursor-grabbing" type="button" {...props}>
      <svg aria-hidden="true" className="size-4" fill="currentColor" viewBox="0 0 16 16"><circle cx="5.5" cy="3.5" r="1.4" /><circle cx="10.5" cy="3.5" r="1.4" /><circle cx="5.5" cy="8" r="1.4" /><circle cx="10.5" cy="8" r="1.4" /><circle cx="5.5" cy="12.5" r="1.4" /><circle cx="10.5" cy="12.5" r="1.4" /></svg>
    </button>
  );
}

/** Opens a row's editor. The whole row label opens it too; this is the visible affordance. */
export function RowChevron({ label, onClick, open }: { label: string; onClick: () => void; open?: boolean }) {
  return (
    <button aria-expanded={open} aria-label={label} className="grid size-10 shrink-0 place-items-center rounded-full text-black/40 transition hover:bg-black/[0.05] hover:text-black focus-visible:outline-2 focus-visible:outline-offset-2" onClick={onClick} type="button">
      <svg aria-hidden="true" className={`size-[18px] transition-transform ${open ? "rotate-90" : ""}`} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24"><path d="m9 6 6 6-6 6" /></svg>
    </button>
  );
}

export function LinkRow({ api, link, editing, onEdit, sortId, size }: { api: EditorApi; link: ProfileLink; editing: boolean; onEdit: (open: boolean) => void; sortId?: string; size?: ReactNode }) {
  const provider = providerForLink(link.link_type);
  const resolved = resolveStoredLink(provider.id, link.url);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: sortId ?? link.id });
  const [title, setTitle] = useState(link.title);
  const [value, setValue] = useState(resolved?.canonicalValue ?? link.url);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function toggleEditing() {
    if (!editing) {
      setTitle(link.title);
      setValue(resolveStoredLink(provider.id, link.url)?.canonicalValue ?? link.url);
      setError(null);
    }
    onEdit(!editing);
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) { setError("Give this link a label."); return; }
    const check = normalizeLinkPayload({ providerId: provider.id, value });
    if (!check.ok) { setError(check.message); return; }
    setSaving(true);
    const failure = await api.editLink(link, title, value);
    setSaving(false);
    if (failure) setError(failure);
    else onEdit(false);
  }

  return (
    <li className={`min-w-0 rounded-[18px] bg-white transition-shadow ${isDragging ? "relative z-10 shadow-[0_24px_50px_-20px_rgba(13,13,13,.45),inset_0_0_0_2px_#0D0D0D]" : editing ? "shadow-[inset_0_0_0_2px_#0D0D0D]" : "shadow-[inset_0_0_0_1px_rgba(13,13,13,.08)]"}`} ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform ? { ...transform, scaleX: 1, scaleY: 1 } : null), transition }}>
      <div className="flex min-h-[66px] items-center gap-1.5 py-2 pl-1 pr-1 sm:gap-2">
        <DragHandle {...attributes} {...listeners} />
        <ProviderMark className="size-10 rounded-xl bg-[#F5F4EF]" icon={provider.icon} label={provider.name} url={resolved?.url ?? link.url} />
        <button className={`min-w-0 flex-1 px-1.5 text-left ${link.is_visible ? "" : "opacity-50"}`} onClick={toggleEditing} type="button">
          <span className="flex items-center gap-2"><span className="truncate text-[15px] font-semibold">{editing ? "Editing link" : link.title}</span>{!link.is_visible && <span className="shrink-0 rounded-full px-2 py-0.5 font-label text-[9px] tracking-[0.1em] shadow-[inset_0_0_0_1px_rgba(13,13,13,.35)]">HIDDEN</span>}</span>
          <span className="block truncate text-[13px] text-black/55">{editing ? provider.name : resolved?.displayValue ?? provider.name}</span>
        </button>
        {size}
        <Toggle label={`${link.is_visible ? "Hide" : "Show"} ${link.title}`} on={link.is_visible} onChange={() => api.toggleLink(link)} />
        <RowChevron label={editing ? `Close ${link.title}` : `Edit ${link.title}`} onClick={toggleEditing} open={editing} />
      </div>
      {editing && (
        <form className="border-t border-black/[0.07] px-4 pb-4 pt-4 sm:px-5" onSubmit={save}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field htmlFor={`label-${link.id}`} label="Label"><TextInput autoFocus id={`label-${link.id}`} maxLength={60} onChange={(event) => setTitle(event.target.value)} value={title} /></Field>
            <Field htmlFor={`value-${link.id}`} label={valueLabel(provider)}><TextInput autoCapitalize="none" id={`value-${link.id}`} maxLength={2048} onChange={(event) => setValue(event.target.value)} placeholder={provider.placeholder} spellCheck={false} value={value} /></Field>
          </div>
          {error && <p className="mt-2 text-[13px] font-medium text-[#B42318]" role="alert">{error}</p>}
          <div className="mt-4 flex items-center justify-between gap-2">
            <button className="min-h-10 rounded-full px-3 text-sm font-semibold text-[#B42318] hover:bg-[#B42318]/[0.07]" onClick={() => api.deleteLink(link)} type="button">Delete</button>
            <div className="flex gap-2"><Pill onClick={() => onEdit(false)} variant="ghost">Cancel</Pill><Pill disabled={saving} type="submit" variant="ink">{saving ? "Saving…" : "Done"}</Pill></div>
          </div>
        </form>
      )}
    </li>
  );
}

function valueLabel(provider: LinkProvider) {
  return provider.inputKind === "email" ? "Email address" : provider.inputKind === "phone" ? "Phone number" : provider.inputKind === "handle" || provider.inputKind === "username" ? "Username or link" : "Destination";
}

export function AddLinkPanel({ api, initial, initialValue = "", onClose, bare = false }: { api: EditorApi; initial: LinkProvider | null; initialValue?: string; onClose: () => void; bare?: boolean }) {
  const [provider, setProvider] = useState<LinkProvider | null>(initial);
  const [title, setTitle] = useState(initial?.defaultLabel ?? "");
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const quick = MODE_LINK_SUGGESTIONS[api.slug].slice(0, 5).map((id) => linkProviderById[id]).filter(Boolean);
  const normalized = provider && value.trim() ? normalizeLinkPayload({ providerId: provider.id, value }) : null;

  useEffect(() => { if (!bare) panelRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, [bare, provider]);

  function choose(next: LinkProvider) { setProvider(next); setTitle(next.defaultLabel); setValue(""); setError(null); }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!provider) return;
    if (!value.trim()) { setError(`Add ${valueLabel(provider).toLowerCase()} first.`); return; }
    if (normalized && !normalized.ok) { setError(normalized.message); return; }
    setSaving(true);
    const failure = await api.addLink(provider, title, value);
    setSaving(false);
    if (failure) setError(failure);
    else onClose();
  }

  return (
    <div className={bare ? "" : "scroll-mb-28 rounded-[22px] bg-white p-5 shadow-[inset_0_0_0_1.5px_#0D0D0D] sm:p-6"} ref={panelRef}>
      {!provider ? (
        <>
          {!bare && <div className="flex items-center justify-between"><p className="text-[15px] font-semibold">Add link · choose type</p><button aria-label="Close" className="grid size-10 place-items-center rounded-full text-lg hover:bg-black/5" onClick={onClose} type="button">×</button></div>}
          <div className={`${bare ? "" : "mt-4 "}grid grid-cols-2 gap-2 sm:grid-cols-3`}>
            {quick.map((item) => (
              <button className="flex min-h-[60px] items-center gap-2.5 rounded-2xl bg-[#F5F4EF] px-3 text-left text-sm font-semibold transition hover:bg-[#0D0D0D] hover:text-[#F5F4EF]" key={item.id} onClick={() => choose(item)} type="button">
                <ProviderMark className="size-8 rounded-lg bg-white text-black" icon={item.icon} label={item.name} /><span className="truncate">{item.name}</span>
              </button>
            ))}
            <div className="col-span-2 sm:col-span-1 [&>button]:min-h-[60px] [&>button]:w-full [&>button]:rounded-2xl [&>button]:border-0 [&>button]:bg-[#F5F4EF]"><ProviderPicker mode={api.slug} onSelect={choose} /></div>
          </div>
          <p className="mt-3 text-[13px] text-black/50">The link is added only to {modeMeta[api.slug].name} Mode.</p>
        </>
      ) : (
        <form onSubmit={submit}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3"><ProviderMark className="size-10 rounded-xl bg-[#F5F4EF]" icon={provider.icon} label={provider.name} url={normalized?.ok ? normalized.data.url : null} /><div className="min-w-0"><p className="truncate text-[15px] font-semibold">{provider.name}</p><button className="text-[13px] font-semibold text-black/55 underline underline-offset-4" onClick={() => setProvider(null)} type="button">Change type</button></div></div>
            {!bare && <button aria-label="Close" className="grid size-10 shrink-0 place-items-center rounded-full text-lg hover:bg-black/5" onClick={onClose} type="button">×</button>}
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <Field htmlFor="new-link-label" label="Label"><TextInput id="new-link-label" maxLength={60} onChange={(event) => setTitle(event.target.value)} value={title} /></Field>
            <Field htmlFor="new-link-value" label={valueLabel(provider)}><TextInput autoCapitalize="none" autoFocus id="new-link-value" inputMode={provider.inputKind === "email" ? "email" : provider.inputKind === "phone" ? "tel" : "url"} maxLength={2048} onChange={(event) => { setValue(event.target.value); setError(null); }} placeholder={provider.placeholder} spellCheck={false} value={value} /></Field>
          </div>
          {provider.instructions && <p className="mt-2 text-[13px] text-black/55">{provider.instructions}</p>}
          {normalized?.ok && <p className="mt-2 text-[13px] text-black/55">Opens <span className="font-semibold text-black/80">{normalized.data.displayValue}</span></p>}
          {(error || (normalized && !normalized.ok)) && <p className="mt-2 text-[13px] font-medium text-[#B42318]" role="alert">{error ?? (normalized && !normalized.ok ? normalized.message : "")}</p>}
          <div className="mt-5 flex justify-end gap-2"><Pill onClick={onClose} variant="ghost">Cancel</Pill><Pill disabled={saving} type="submit" variant="ink">{saving ? "Adding…" : "Add link"}</Pill></div>
        </form>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Mode Settings

/**
 * Where this Mode lives, and where to change it. Personal is your username; Business and Creator can
 * claim their own name; Event links stay private on purpose.
 */
function YourLink({ api }: { api: EditorApi }) {
  const { slug } = api;
  const url = api.publicUrl(slug).replace(/^https?:\/\//, "");
  const copy = async () => { try { await navigator.clipboard.writeText(api.publicUrl(slug)); api.toast("Link copied"); } catch { api.toast("Copy is unavailable here. Select the link to copy it."); } };
  const share = async () => { try { await navigator.share({ url: api.publicUrl(slug) }); } catch { /* dismissed */ } };
  if (isModeHandleSlug(slug)) return <PublicLinkCard api={api} key={slug} onCopy={() => void copy()} onQr={() => api.go("share")} onShare={() => void share()} slug={slug} />;
  return (
    <Card className="p-5 sm:p-6">
      <div className="flex items-baseline justify-between gap-3">
        <MonoLabel className="text-black/55">Your link</MonoLabel>
        <button className="shrink-0 text-[12.5px] font-semibold underline underline-offset-4" onClick={() => api.go("share")} type="button">QR &amp; sharing</button>
      </div>
      <p className="mt-2.5 truncate font-display text-[1.6rem] font-bold leading-tight tracking-[-0.04em]" title={url}>{url || "Link unavailable"}</p>
      {slug === "personal"
        ? <div className="mt-4"><UsernameField api={api} /></div>
        : <p className="mt-2 text-[13px] leading-5 text-black/60">{modeMeta[slug].name} links stay private: only people you send this link to can open it. Make a new one any time in Share.</p>}
    </Card>
  );
}

export function SettingsSection({ api }: { api: EditorApi }) {
  const { mode, slug, profile } = api;
  const contacts = mode.links.filter((link) => CONTACT_PROVIDERS.includes(providerForLink(link.link_type).id));
  const description = { personal: "Who sees what in Personal Mode.", event: "What this Event Mode shows, and what it remembers.", business: "Contact rules and what Business Mode shows.", creator: "Creator identity and connection access." }[slug];
  return (
    <div>
      <SectionHeader description={description} slug={slug} title="Mode Settings" />

      <YourLink api={api} />

      <Card className="mt-4 divide-y divide-black/[0.07] px-5 sm:px-6">
        <SettingRow description={slug === "personal" ? "Personal is always on. It’s where people land by default." : mode.is_enabled ? "Its link and QR code open for anyone you share them with." : "Its link and QR code don’t open. Nothing is deleted."} title={`${modeMeta[slug].name} Mode is ${mode.is_enabled ? "on" : "off"}`}>
          <Toggle disabled={slug === "personal"} label={`${modeMeta[slug].name} Mode on`} on={mode.is_enabled} onChange={(next) => void api.setModeEnabled(next)} />
        </SettingRow>
        <SettingRow description={profile.is_published ? "Anyone with your link or QR can open your enabled Modes. Search engines can list your Personal Mode." : "Draft. Nobody can open your Setuvara until you publish."} title={profile.is_published ? "Your Setuvara is public" : "Your Setuvara is private"}>
          <Toggle label="Setuvara public" on={profile.is_published} onChange={(next) => void api.setPublished(next)} />
        </SettingRow>
        {slug !== "event" && <GalleryRow api={api} key={slug} />}
      </Card>

      <ConnectionAccess api={api} />

      {slug === "event" && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Card className="p-5 sm:p-6">
            <MonoLabel className="text-black/55">This event</MonoLabel>
            <p className="mt-3 font-display text-[2rem] font-extrabold leading-none tracking-[-0.05em]">{text(mode, "eventName") || "Not set yet"}</p>
            <p className="mt-2 text-sm text-black/60">{[text(mode, "city"), text(mode, "dateLabel")].filter(Boolean).join(" · ") || "Add a city and dates"}</p>
            <button className="mt-4 min-h-10 text-sm font-semibold underline underline-offset-4" onClick={() => api.go("profile")} type="button">Edit event details</button>
          </Card>
          <Card className="p-5 sm:p-6" tone="ink">
            <MonoLabel color={coral}>Every connection saves</MonoLabel>
            <dl className="mt-4 grid grid-cols-[64px_1fr] gap-y-2 text-[15px]">
              {[["event", text(mode, "eventName") || "—"], ["city", text(mode, "city") || "—"], ["mode", "Event"], ["time", "When you connect"]].map(([label, value]) => <div className="contents" key={label}><dt className="font-label text-[12px] text-white/50">{label}</dt><dd className="truncate font-semibold">{value}</dd></div>)}
            </dl>
            <p className="mt-4 text-[13px] text-white/55">Always on for Event Mode, so you remember where you met.</p>
          </Card>
        </div>
      )}

      <h2 className="mb-3 mt-8 text-[15px] font-semibold">Contact details in this Mode</h2>
      {contacts.length ? (
        <Card className="divide-y divide-black/[0.07] px-5 sm:px-6">
          {contacts.map((link) => {
            const provider = providerForLink(link.link_type);
            return (
              <div className="flex flex-wrap items-center justify-between gap-3 py-4" key={link.id}>
                <div className="min-w-0"><p className="text-[15px] font-semibold">{provider.name}</p><p className="truncate text-[13px] text-black/55">{resolveStoredLink(provider.id, link.url)?.displayValue ?? link.title}</p></div>
                <Segmented label={`${provider.name} visibility`} onChange={(next) => { if ((next === "visible") !== link.is_visible) api.toggleLink(link); }} options={[{ value: "visible", label: "Everyone" }, { value: "hidden", label: "Hidden" }]} size="sm" value={link.is_visible ? "visible" : "hidden"} />
              </div>
            );
          })}
        </Card>
      ) : (
        <Card className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-6"><p className="text-sm text-black/60">No email, phone or messaging links in {modeMeta[slug].name} Mode.</p><Pill onClick={() => api.go("links")}>Add one</Pill></Card>
      )}

      <AppearsIn api={api} />
    </div>
  );
}

const CONNECT_OPTIONS: { value: ConnectPolicy; title: string; description: string }[] = [
  { value: "anyone", title: "Anyone", description: "Anyone viewing this Mode can connect." },
  { value: "direct_only", title: "Direct share only", description: "Your public profile stays view-only. Connect appears when you share directly." },
  { value: "nobody", title: "Nobody", description: "This Mode is view-only." },
];

function ConnectionAccess({ api }: { api: EditorApi }) {
  const policy = api.mode.connect_policy ?? "anyone";
  const titleId = useId();
  return (
    <section aria-labelledby={titleId} className="mt-8">
      <h2 className="text-[15px] font-semibold" id={titleId}>Connections</h2>
      <p className="mb-3 mt-0.5 text-[13px] text-black/55">Who can connect from this Mode?</p>
      <Card className="divide-y divide-black/[0.07] px-2 sm:px-3">
        <div aria-labelledby={titleId} role="radiogroup">
          {CONNECT_OPTIONS.map((option) => {
            const on = option.value === policy;
            return (
              <button aria-checked={on} className="flex w-full items-center gap-3 rounded-[16px] px-3 py-3.5 text-left focus-visible:outline-2 sm:px-4" key={option.value} onClick={() => void api.setConnectPolicy(option.value)} role="radio" type="button">
                <span aria-hidden="true" className="grid size-[22px] shrink-0 place-items-center rounded-full" style={on ? { background: ink } : { boxShadow: "inset 0 0 0 1.5px rgba(13,13,13,.28)" }}>{on && <span className="size-2 rounded-full bg-white" />}</span>
                <span className="min-w-0"><span className="block text-[15px] font-semibold">{option.title}</span><span className="mt-0.5 block text-[13px] leading-5 text-black/55">{option.description}</span></span>
              </button>
            );
          })}
        </div>
      </Card>
      {policy === "direct_only" && <p className="mt-3 text-[13px] text-black/50">Use Connect in person in Share to let someone connect for the next 24 hours. You can still connect with anyone who allows it.</p>}
      {policy === "nobody" && <p className="mt-3 text-[13px] text-black/50">Existing connections stay. You can still connect with anyone who allows it.</p>}
    </section>
  );
}

function SettingRow({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return <div className="flex items-center justify-between gap-4 py-4"><div className="min-w-0"><p className="text-[15px] font-semibold">{title}</p><p className="mt-0.5 text-[13px] leading-5 text-black/55">{description}</p></div>{children}</div>;
}

function AppearsIn({ api }: { api: EditorApi }) {
  const rows = useMemo(() => {
    const bySlug = Object.fromEntries(api.modes.map((mode) => [mode.slug, mode])) as Record<ModeSlug, ProfileMode | undefined>;
    const has = (slug: ModeSlug, test: (mode: ProfileMode) => boolean) => Boolean(bySlug[slug] && test(bySlug[slug]!));
    const list: { label: string; cells: Record<ModeSlug, boolean> }[] = [
      { label: "Photo", cells: { personal: has("personal", (m) => Boolean(m.image_path)), event: has("event", (m) => Boolean(m.image_path)), business: has("business", (m) => Boolean(m.image_path)), creator: has("creator", (m) => Boolean(m.image_path)) } },
      { label: "Personal line", cells: { personal: Boolean(api.profile.bio.trim()), event: false, business: false, creator: false } },
      { label: "Location or city", cells: { personal: has("personal", (m) => Boolean(text(m, "location").trim())), event: has("event", (m) => Boolean(text(m, "city").trim())), business: has("business", (m) => Boolean(text(m, "city").trim())), creator: false } },
      { label: "Role & company", cells: { personal: false, event: has("event", (m) => Boolean(text(m, "role").trim())), business: has("business", (m) => Boolean(text(m, "role").trim() || text(m, "company").trim())), creator: false } },
      { label: "Here to meet", cells: { personal: false, event: has("event", (m) => Boolean(text(m, "hereToMeet").trim())), business: false, creator: false } },
    ];
    const names = new Map<string, Record<ModeSlug, boolean>>();
    for (const mode of api.modes) for (const link of mode.links) {
      const name = providerForLink(link.link_type).name;
      const cells = names.get(name) ?? { personal: false, event: false, business: false, creator: false };
      if (link.is_visible) cells[mode.slug] = true;
      names.set(name, cells);
    }
    for (const [label, cells] of names) list.push({ label, cells });
    return list;
  }, [api.modes, api.profile.bio]);

  return (
    <div className="mt-8">
      <h2 className="mb-3 text-[15px] font-semibold">What appears where</h2>
      <Card className="overflow-x-auto px-3 py-2 sm:px-5">
        <table className="w-full min-w-[420px] text-sm">
          <thead><tr><th className="py-3 pl-2 text-left font-semibold">Appears in</th>{MODE_SLUGS.map((slug) => <th className={`w-[22%] py-3 text-center font-semibold ${slug === api.slug ? "text-[#FF5A4F]" : ""}`} key={slug} scope="col">{modeMeta[slug].name}</th>)}</tr></thead>
          <tbody>
            {rows.map((row) => (
              <tr className="border-t border-black/[0.06]" key={row.label}>
                <th className="py-2.5 pl-2 text-left font-normal" scope="row">{row.label}</th>
                {MODE_SLUGS.map((slug) => <td className={`text-center ${slug === api.slug ? "bg-[#FF5A4F]/[0.07]" : ""}`} key={slug}><span aria-label={row.cells[slug] ? "Shown" : "Not shown"} className="mx-auto grid size-[18px] place-items-center rounded-full text-[10px] font-bold" role="img" style={row.cells[slug] ? { background: ink, color: paper } : { boxShadow: "inset 0 0 0 1.5px rgba(13,13,13,.22)" }}>{row.cells[slug] ? "✓" : ""}</span></td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <p className="mt-3 text-[13px] text-black/50">Every field, link and look belongs to one Mode. Hidden links don’t count as shown.</p>
    </div>
  );
}

// ---------------------------------------------------------------- Share

const markDataUri = `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="24" fill="#FF5A4F"/><g transform="translate(17 17) scale(.66)" fill="#0D0D0D"><path d="${meetMarkTop}"/><path d="${meetMarkBottom}"/></g></svg>`)}`;

export function ShareSection({ api }: { api: EditorApi }) {
  const { mode, slug, profile } = api;
  const [copied, setCopied] = useState(false);
  const [full, setFull] = useState(false);
  const [intent, setIntent] = useState(api.initialShareIntent);
  const [confirmNewLink, setConfirmNewLink] = useState(false);
  const [rotating, setRotating] = useState(false);
  const qrId = useId().replace(/:/g, "");
  const offline = !profile.is_published || !mode.is_enabled;
  const policy = mode.connect_policy ?? "anyone";
  // Direct share only: Share profile stays view-only, Connect in person carries a temporary Connection Pass.
  const inPerson = intent === "in_person" && policy === "direct_only";
  const { pass, end: resetPass } = useConnectPass(slug, inPerson && !offline);
  const passUrl = pass?.ok ? pass.url : null;
  const handleSlug = isModeHandleSlug(slug) ? slug : null;
  const handleLive = Boolean(handleSlug && api.modeHandles[handleSlug]?.is_live);
  // With a live handle, "Your public link" shares the handle and this card keeps the shortlink.
  const shortlinkCard = handleLive && !inPerson;
  const linkUrl = inPerson ? passUrl : shortlinkCard ? api.shortUrl(slug) : api.publicUrl(slug, "link");
  const qrUrl = inPerson ? passUrl : api.publicUrl(slug, "qr");
  const displayUrl = inPerson ? (passUrl ? passUrl.replace(/^https?:\/\//, "").replace(/\/connect\/.+$/, "/connect/…") : "Connection Pass") : (shortlinkCard ? api.shortUrl(slug) ?? "" : api.publicUrl(slug)).replace(/^https?:\/\//, "");
  const qrDisplayUrl = api.publicUrl(slug).replace(/^https?:\/\//, "");
  const darkShare = api.selectedRewards.share_treatment === "signal_share" || api.selectedRewards.share_treatment === "network_share";
  const coralFrame = api.selectedRewards.qr_frame === "coral_qr_frame";
  const qrStyle = resolveQrStyle(mode, api.plan);
  // A Connection Pass QR stays plain: it is temporary and must scan first time.
  const shownQrStyle = inPerson ? "standard" : qrStyle;
  const { messages } = useI18n();
  const qrCopy = messages.appearance;
  const eventName = text(mode, "eventName");
  async function copy() {
    if (!linkUrl) return;
    const ok = await copyText(linkUrl);
    setCopied(ok);
    api.toast(ok ? "Link copied" : "Copy didn’t work. Select the link instead.");
    if (ok && !inPerson && !offline) recordProfileShare(slug, "copy");
    if (ok) window.setTimeout(() => setCopied(false), 2000);
  }

  async function copyPublic() {
    const ok = await copyText(api.publicUrl(slug, "link"));
    api.toast(ok ? "Link copied" : "Copy didn’t work. Select the link instead.");
    if (ok && !offline) recordProfileShare(slug, "copy");
  }

  async function newLink() {
    setRotating(true);
    const ok = await api.regenerateShareLink(slug);
    setRotating(false);
    setConfirmNewLink(false);
    api.toast(ok ? "New link ready. Older links to this Mode no longer open." : "Couldn’t make a new link. Try again.");
  }

  async function share() {
    const url = inPerson ? passUrl : api.publicUrl(slug, "native_share");
    if (!url) return;
    if (navigator.share) {
      try {
        await navigator.share({ title: `${profile.display_name} · ${modeMeta[slug].name} Mode`, url });
        if (!inPerson && !offline) recordProfileShare(slug, "native_share");
      } catch { /* dismissed */ }
    } else await copy();
  }

  return (
    <div>
      <SectionHeader description={`People who scan, tap or open this link land straight on ${modeMeta[slug].name} Mode.`} slug={slug} title="Share" />

      {offline && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-[18px] bg-[#FF5A4F]/[0.12] px-5 py-4">
          <p className="text-sm font-semibold">{!profile.is_published ? "Your Setuvara is a draft. This link won’t open until you publish." : `${modeMeta[slug].name} Mode is off, so this link won’t open.`}</p>
          <Pill onClick={() => void (!profile.is_published ? api.setPublished(true) : api.setModeEnabled(true))} variant="ink">{!profile.is_published ? "Publish" : "Turn on"}</Pill>
        </div>
      )}

      {/* Sized by the space the editor leaves (preview pane open or not), not the window. */}
      <div className="@container/share">
      <div className="grid grid-cols-1 items-start gap-4 @min-[560px]/share:grid-cols-[minmax(0,236px)_minmax(0,1fr)] @min-[760px]/share:grid-cols-[minmax(0,280px)_minmax(0,1fr)] @min-[760px]/share:gap-6">
        <div className={`order-2 mx-auto w-full max-w-[360px] self-start rounded-[24px] @min-[560px]/share:order-none ${handleSlug ? "@min-[560px]/share:row-span-3" : "@min-[560px]/share:row-span-2"} bg-[#0D0D0D] p-4 text-[#F5F4EF] @min-[560px]/share:sticky @min-[560px]/share:top-6 @min-[760px]/share:p-5`}>
          <MonoLabel className="truncate !text-[10px]" color={coral}>{inPerson ? "Connect in person" : "Sharing now"} · {modeMeta[slug].name}{eventName && slug === "event" ? ` · ${eventName}` : ""}</MonoLabel>
          <button aria-label="Show QR code full screen" className={`mt-4 block w-full rounded-[20px] disabled:cursor-default ${coralFrame ? "outline outline-4 outline-offset-2 outline-[#FF5A4F]" : ""}`} data-qr-treatment={qrStyle} disabled={!qrUrl} onClick={() => { setFull(true); if (!inPerson && !offline) recordProfileShare(slug, "qr_open"); }} type="button">
            <QrFrame accent={resolveAppearance(mode, api.plan).accent} modeLabel={modeMeta[slug].name} name={profile.display_name} style={shownQrStyle}>
              {qrUrl
                ? <QRCodeSVG bgColor="#FFFFFF" className="h-auto w-full" data-qr-value={qrUrl} data-share-intent={inPerson ? "in_person" : "profile"} fgColor={ink} id={qrId} imageSettings={{ src: markDataUri, height: 48, width: 48, excavate: true }} level="H" marginSize={4} size={256} title={`${modeMeta[slug].name} Mode ${inPerson ? "Connect in person " : ""}QR code`} value={qrUrl} />
                : <span aria-live="polite" className="grid aspect-square w-full place-items-center px-3 text-center text-sm text-black/60">{pass && !pass.ok ? pass.message : offline ? "Turn this Mode on to connect in person." : inPerson ? "Making your pass…" : "This link isn’t ready yet. Refresh in a moment."}</span>}
            </QrFrame>
          </button>
          <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/10 pt-3.5 text-[12.5px] text-white/60">
            <span>Download</span>
            <span className="flex gap-1">
              <button className="min-h-8 rounded-full px-3 font-semibold text-white shadow-[inset_0_0_0_1px_rgba(245,244,239,.22)] transition hover:bg-white/10 disabled:opacity-40" disabled={!qrUrl} onClick={() => void downloadQr(qrId, "png", `setuvara-${profile.username}-${slug}`)} type="button">PNG</button>
              <button className="min-h-8 rounded-full px-3 font-semibold text-white shadow-[inset_0_0_0_1px_rgba(245,244,239,.22)] transition hover:bg-white/10 disabled:opacity-40" disabled={!qrUrl} onClick={() => void downloadQr(qrId, "svg", `setuvara-${profile.username}-${slug}`)} type="button">SVG</button>
            </span>
          </div>
        </div>

        {handleSlug && !inPerson && <PublicLinkCard api={api} key={handleSlug} onCopy={() => void copyPublic()} onQr={() => { setFull(true); if (!offline) recordProfileShare(slug, "qr_open"); }} onShare={() => void share()} slug={handleSlug} />}

        {/* Phones lead with the link (copy and share sit above the fold); wide, the QR holds the left column. */}
          <section aria-label="Link" className="@container/link order-1 min-w-0 rounded-[22px] @min-[560px]/share:order-none bg-white p-4 shadow-[inset_0_0_0_1px_rgba(13,13,13,.08)] @min-[760px]/share:p-5">
            {policy === "direct_only" && <div className="mb-4"><Segmented full label="What you are sharing" onChange={setIntent} options={[{ value: "profile", label: "Share profile" }, { value: "in_person", label: "Connect in person" }]} size="sm" value={inPerson ? "in_person" : "profile"} /></div>}
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-sm font-semibold">{inPerson ? "Connection Pass link" : slug === "personal" ? "Public link" : shortlinkCard ? "Shortlink" : "Private Mode link"}</p>
              {!inPerson && policy !== "anyone" && <span className="shrink-0 text-[12px] text-black/50">View only</span>}
            </div>
            <p className="mt-1 text-[12.5px] leading-5 text-black/55">
              {inPerson
                ? <>Anyone who scans or opens this can connect with your {modeMeta[slug].name} Mode{pass?.ok ? ` until ${passExpiryLabel(pass.expiresAt)}` : ""}. <button className="font-semibold text-black underline underline-offset-4" onClick={() => void resetPass()} type="button">Reset pass</button></>
                : slug === "personal"
                  ? "Your username link always opens Personal Mode."
                  : shortlinkCard
                    ? "Still opens this Mode, and so do QR codes and Tap you’ve already shared."
                  : `Only people you send this link to can open ${modeMeta[slug].name} Mode. Your username link never shows it.`}
            </p>
            <div className="mt-3 flex min-h-[52px] items-center gap-2 rounded-2xl bg-[#F5F4EF] py-1.5 pl-4 pr-1.5">
              <span className="min-w-0 flex-1 truncate font-label text-[12.5px]" title={displayUrl}>{displayUrl || "Link unavailable"}</span>
              <Pill className="!min-h-10 shrink-0 !px-4" disabled={!linkUrl} onClick={() => void copy()} variant="ink">{copied ? "Copied ✓" : "Copy link"}</Pill>
            </div>
            {!shortlinkCard && <div className="mt-3 grid grid-cols-1 gap-2 @min-[300px]/link:grid-cols-2">
              <Pill className="!min-h-11 whitespace-nowrap !px-3" disabled={!linkUrl} onClick={() => void share()} variant="coral">Share…</Pill>
              <Pill className="!min-h-11 whitespace-nowrap !px-3" disabled={!qrUrl} onClick={() => { setFull(true); if (!inPerson && !offline) recordProfileShare(slug, "qr_open"); }}>Full-screen QR</Pill>
            </div>}
            {!inPerson && slug !== "personal" && linkUrl && (
              confirmNewLink
                ? <div className="mt-3 rounded-2xl bg-[#FF5A4F]/[0.1] px-4 py-3" data-share-new-link="confirm">
                    <p className="text-[12.5px] leading-5">Make a new {modeMeta[slug].name} Mode link? Older links and printed QR codes for this Mode stop working.</p>
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      <Pill className="!min-h-10 !px-4" disabled={rotating} onClick={() => void newLink()} variant="ink">{rotating ? "Making link…" : "Make new link"}</Pill>
                      <Pill className="!min-h-10 !px-4" disabled={rotating} onClick={() => setConfirmNewLink(false)}>Keep this link</Pill>
                    </div>
                  </div>
                : <button className="mt-3 text-[12.5px] font-semibold text-black/60 underline underline-offset-4 hover:text-black" onClick={() => setConfirmNewLink(true)} type="button">New link</button>
            )}
          </section>

          <section aria-label={qrCopy.qr} className="@container/qr order-3 min-w-0 rounded-[22px] @min-[560px]/share:order-none bg-white p-4 shadow-[inset_0_0_0_1px_rgba(13,13,13,.08)] @min-[760px]/share:p-5" data-qr-treatment={qrStyle}>
            <p className="text-sm font-semibold">{qrCopy.qr}</p>
            <p className="mt-1 text-[12.5px] leading-5 text-black/55">{(mode.appearance.qrStyle ?? "standard") !== qrStyle ? qrCopy.inactive : qrCopy.qrNote}</p>
            <div className="mt-3 grid grid-cols-2 gap-2 @min-[460px]/qr:grid-cols-3">
              {QR_STYLES.map((style) => {
                const qrAccent = resolveAppearance(mode, api.plan).accent;
                const on = qrStyle === style;
                const allowed = style === "standard" || hasCapability(api.plan, "share.qr_premium");
                return (
                  <button aria-label={`${qrCopy.qrStyles[style]}${style === "standard" ? "" : ` · ${qrCopy.plus}`}`} aria-pressed={on} className={`group relative flex min-w-0 flex-col gap-2 rounded-[18px] p-1.5 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 ${on ? "bg-white shadow-[inset_0_0_0_2px_#0D0D0D]" : "bg-white shadow-[inset_0_0_0_1px_rgba(13,13,13,.1)] hover:shadow-[inset_0_0_0_1px_rgba(13,13,13,.3)]"}`} key={style} onClick={() => allowed ? api.updateAppearance({ qrStyle: style === "standard" ? undefined : style }) : api.openPlusSheet({ kind: "qr", name: style })} type="button">
                    <QrSwatch accent={qrAccent} style={style} />
                    <span className="flex min-h-6 items-center justify-between gap-1.5 px-1.5 pb-1">
                      <span className="min-w-0 truncate text-[13px] font-semibold leading-[1.2]">{qrCopy.qrStyles[style]}</span>
                      {on ? <span aria-hidden="true" className="grid size-5 shrink-0 place-items-center rounded-full bg-[#0D0D0D] text-[11px] text-white">✓</span> : !allowed ? <PlusTag /> : null}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="mt-4 divide-y divide-black/[0.07] border-t border-black/[0.07]">
              {(["qr_frame", "share_treatment"] as const).map((category) => <RewardSelect api={api} category={category} key={category} />)}
            </div>
          </section>

          {!offline && <LinkPreviewCard api={api} slug={slug} />}

      </div>

      </div>

      {full && qrUrl && <FullscreenQr caption={inPerson ? "Scan to connect with me" : undefined} dark={darkShare} name={profile.display_name} onClose={() => setFull(false)} onCopy={() => void (shortlinkCard ? copyPublic() : copy())} qrStyle={shownQrStyle} accent={resolveAppearance(mode, api.plan).accent} subtitle={`${modeMeta[slug].name}${eventName && slug === "event" ? ` · ${eventName}` : ""}`} url={shortlinkCard ? qrDisplayUrl : displayUrl} value={qrUrl} />}
    </div>
  );
}

/** The card the link unfurls into, from the same route the page metadata names. */
function cardImagePath(api: EditorApi, slug: ModeSlug) {
  const path = new URL(api.publicUrl(slug)).pathname;
  if (path.startsWith("/s/")) return `/og${path}`;
  if (isModeHandleSlug(slug) && api.modeHandles[slug]?.is_live) return `/og/h/${api.modeHandles[slug].handle}`;
  return slug === "personal" && api.profile.username ? `/og/profile/${api.profile.username}/personal` : null;
}

function LinkPreviewCard({ api, slug }: { api: EditorApi; slug: ModeSlug }) {
  // A fresh query per visit, so a card edited a moment ago never shows from the browser cache.
  const [version] = useState(() => Date.now().toString(36));
  const [saving, setSaving] = useState<"link" | "feed" | null>(null);
  const path = cardImagePath(api, slug);
  if (!path) return null;

  async function save(format: "link" | "feed") {
    setSaving(format);
    try {
      const response = await fetch(`${path}?format=${format}&v=${version}`, { cache: "no-store" });
      if (!response.ok) throw new Error("card");
      const href = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a");
      anchor.href = href;
      anchor.download = `setuvara-${api.profile.username}-${slug}-${format === "feed" ? "post" : "preview"}.png`;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(href), 1000);
    } catch {
      api.toast("Couldn’t make the image. Try again.");
    } finally {
      setSaving(null);
    }
  }

  return (
    <section aria-label="Link preview" className="@container/preview order-4 min-w-0 rounded-[22px] bg-white p-4 shadow-[inset_0_0_0_1px_rgba(13,13,13,.08)] @min-[560px]/share:order-none @min-[560px]/share:col-start-2 @min-[760px]/share:p-5" data-share-card-preview>
      <p className="text-sm font-semibold">Link preview</p>
      <p className="mt-1 text-[12.5px] leading-5 text-black/55">What your link shows in messages and social posts. Download it as a post for Instagram or Threads.</p>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img alt="Your link preview card" className="mt-3 aspect-[1200/630] w-full rounded-2xl bg-[#0D0D0D] object-cover" decoding="async" height={630} loading="lazy" src={`${path}?v=${version}`} width={1200} />
      <div className="mt-3 grid grid-cols-1 gap-2 @min-[340px]/preview:grid-cols-2">
        <Pill className="!min-h-11 whitespace-nowrap !px-3" disabled={saving !== null} onClick={() => void save("feed")} variant="ink">{saving === "feed" ? "Making post…" : "Download post"}</Pill>
        <Pill className="!min-h-11 whitespace-nowrap !px-3" disabled={saving !== null} onClick={() => void save("link")}>{saving === "link" ? "Saving…" : "Download preview"}</Pill>
      </div>
    </section>
  );
}

function RewardSelect({ api, category }: { api: EditorApi; category: RewardCategory }) {
  const options = PASSPORT_REWARDS.filter((reward) => reward.category === category);
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-3 pt-3">
      <label className="shrink-0 text-[13px] font-semibold" htmlFor={id}>{category === "qr_frame" ? "QR frame" : "Share treatment"}</label>
      <select className="min-h-10 w-full min-w-0 max-w-[200px] flex-1 rounded-full bg-[#F5F4EF] px-3 text-[13px] font-medium" id={id} onChange={(event) => { if (event.target.value) void api.equipReward(category, event.target.value); }} value={api.selectedRewards[category] ?? ""}>
        <option value="">Setuvara default</option>
        {options.map((reward) => <option disabled={!api.unlockedRewards.includes(reward.id)} key={reward.id} value={reward.id}>{reward.name}{api.unlockedRewards.includes(reward.id) ? "" : ` · at ${reward.milestone}`}</option>)}
      </select>
    </div>
  );
}

function FullscreenQr({ value, url, name, subtitle, dark, onClose, onCopy, caption = "Scan to open my Setuvara", qrStyle, accent }: { value: string; url: string; name: string; subtitle: string; dark: boolean; onClose: () => void; onCopy: () => void; caption?: string; qrStyle: QrStyle; accent: string }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div aria-label="QR code" aria-modal="true" className={`fixed inset-0 z-[90] flex flex-col items-center justify-center px-6 text-center ${dark ? "bg-[#0D0D0D] text-[#F5F4EF]" : "bg-[#F5F4EF] text-[#0D0D0D]"}`} role="dialog">
      <MeetMark className="size-8" />
      <p className="mt-4 font-display text-[2rem] font-extrabold leading-none tracking-[-0.05em]">{name}</p>
      <p className="mt-2 font-label text-[11px] uppercase tracking-[0.16em] opacity-60">{subtitle} Mode</p>
      <QrFrame accent={accent} className="mt-7 w-full max-w-[320px] shadow-[0_30px_80px_-40px_rgba(13,13,13,.6)]" modeLabel={subtitle} name={name} size="lg" style={qrStyle}>
        <QRCodeSVG bgColor="#FFFFFF" className="h-auto w-full" fgColor={ink} imageSettings={{ src: markDataUri, height: 56, width: 56, excavate: true }} level="H" marginSize={4} size={300} value={value} />
      </QrFrame>
      <p className="mt-6 text-[15px] font-semibold">{caption}</p>
      <p className="mt-1 font-label text-xs opacity-55">{url}</p>
      <div className="mt-7 flex gap-3"><button className="min-h-12 rounded-full px-6 text-[15px] font-semibold shadow-[inset_0_0_0_1.5px_currentColor]" onClick={onCopy} type="button">Copy link</button><button className="min-h-12 rounded-full bg-[#FF5A4F] px-7 text-[15px] font-semibold text-[#0D0D0D]" onClick={onClose} type="button">Done</button></div>
    </div>
  );
}

async function copyText(value: string) {
  try {
    if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(value); return true; }
  } catch { /* fall back below */ }
  try {
    const input = document.createElement("textarea");
    input.value = value;
    input.setAttribute("readonly", "");
    input.style.position = "fixed";
    input.style.opacity = "0";
    document.body.append(input);
    input.select();
    const ok = document.execCommand("copy");
    input.remove();
    return ok;
  } catch { return false; }
}

async function downloadQr(id: string, format: "png" | "svg", filename: string) {
  const svg = document.getElementById(id);
  if (!(svg instanceof SVGSVGElement)) return;
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", "1024");
  clone.setAttribute("height", "1024");
  const markup = new XMLSerializer().serializeToString(clone);
  const svgUrl = URL.createObjectURL(new Blob([markup], { type: "image/svg+xml" }));
  const save = (href: string, extension: string) => { const anchor = document.createElement("a"); anchor.href = href; anchor.download = `${filename}.${extension}`; anchor.click(); };
  if (format === "svg") { save(svgUrl, "svg"); window.setTimeout(() => URL.revokeObjectURL(svgUrl), 1000); return; }
  const image = new window.Image();
  image.src = svgUrl;
  await image.decode();
  const canvas = document.createElement("canvas");
  canvas.width = 1024; canvas.height = 1024;
  canvas.getContext("2d")?.drawImage(image, 0, 0, 1024, 1024);
  URL.revokeObjectURL(svgUrl);
  save(canvas.toDataURL("image/png"), "png");
}

/** A small picture of each QR style, so the choice reads at a glance. */
function QrSwatch({ style, accent }: { style: string; accent: string }) {
  const code = (
    <svg aria-hidden="true" className="size-full" viewBox="0 0 21 21">
      <path d="M0 0h7v7H0zM14 0h7v7h-7zM0 14h7v7H0z" fill="#0D0D0D" /><path d="M1.5 1.5h4v4h-4zM15.5 1.5h4v4h-4zM1.5 15.5h4v4h-4z" fill="#fff" /><path d="M2.5 2.5h2v2h-2zM16.5 2.5h2v2h-2zM2.5 16.5h2v2h-2z" fill="#0D0D0D" />
      <path d="M9 1h2v2H9zM9 5h3v2H9zM1 9h2v3H1zM5 9h4v2H5zM11 9h2v4h-2zM15 9h4v2h-4zM9 13h2v4H9zM13 15h2v2h-2zM17 13h3v2h-3zM15 18h5v2h-5zM11 18h2v2h-2z" fill="#0D0D0D" />
    </svg>
  );
  const framed = style === "label" || style === "inverse" || style === "rounded";
  const outer = style === "inverse" ? "#0D0D0D" : accent;
  return (
    <span aria-hidden="true" className="grid h-[76px] place-items-center rounded-[13px] bg-[#F5F4EF]">
      {framed ? (
        <span className={`flex flex-col gap-1 p-1 ${style === "rounded" ? "rounded-[14px]" : "rounded-[9px]"}`} style={{ background: outer }}>
          <span className={`block size-10 bg-white p-1 ${style === "rounded" ? "rounded-[10px]" : "rounded-[6px]"}`}>{code}</span>
          {style === "label" && <span className="mx-0.5 mb-0.5 block h-1 w-6 rounded-full" style={{ background: inkOnAccent(accent), opacity: 0.8 }} />}
        </span>
      ) : (
        <span className="block size-11 rounded-[7px] bg-white p-1.5" style={{ boxShadow: style === "accent-frame" ? `0 0 0 2.5px ${accent}` : "inset 0 0 0 1px rgba(13,13,13,.12)" }}>{code}</span>
      )}
    </span>
  );
}
