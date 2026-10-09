"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";

import { ProviderMark } from "@/components/links/provider-mark";
import { ProviderPicker } from "@/components/links/provider-picker";
import { meetMarkBottom, meetMarkTop, MeetMark } from "@/components/marketing/brand";
import { ProfileRenderer } from "@/components/profile/profile-renderer";
import type { ModeSlug, ProfileLink, ProfileMode } from "@/components/profile/types";
import { linkProviderById, MODE_LINK_SUGGESTIONS, normalizeLinkPayload, providerForLink, resolveStoredLink, type LinkProvider } from "@/lib/links/providers";
import { PASSPORT_REWARDS, type RewardCategory } from "@/lib/passport/rewards";
import { LAYOUTS, MODE_SLUGS, SECTIONS, type EditorApi, type Section } from "./editor-types";
import { Card, Counter, Field, MonoLabel, Pill, SectionHeader, Segmented, TextArea, TextInput, Toggle, coral, cutCorner, ink, modeMeta, paper } from "./editor-ui";

const modeIntro: Record<ModeSlug, string> = {
  personal: "The version of you that you give personally, to friends, communities and people you choose.",
  event: "Temporary and specific to one event. Personal and Business stay untouched.",
  business: "Clean and structured. What a client, investor or recruiter needs.",
};
const profileIntro: Record<ModeSlug, string> = {
  personal: "Expressive and personal. Only what you choose appears.",
  event: "Temporary and specific to this event. Personal and Business stay untouched.",
  business: "Clean and structured. What a client, investor or recruiter needs.",
};
const CONTACT_PROVIDERS = ["email", "phone", "sms", "whatsapp", "telegram", "signal", "messenger"];
const ACCENTS = [{ name: "Coral", hex: "#FF5A4F" }, { name: "Lime", hex: "#C7FF4A" }, { name: "Blue", hex: "#AFCBFF" }, { name: "Lilac", hex: "#E8A6FF" }, { name: "Gold", hex: "#F5C66E" }];
const themeSwatches = { light: { bg: "#FFFFFF", fg: ink }, dark: { bg: ink, fg: paper }, editorial: { bg: paper, fg: coral } } as const;

const text = (mode: ProfileMode, key: string) => (typeof mode.settings[key] === "string" ? String(mode.settings[key]) : "");
const layoutLabel = (mode: ProfileMode) => LAYOUTS[mode.slug].find((layout) => layout.value === mode.appearance.layout)?.label ?? "Curated";
const cap = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

function summaries(api: EditorApi): Record<Exclude<Section, "home">, string> {
  const { mode, profile } = api;
  const hidden = mode.links.filter((link) => !link.is_visible).length;
  const contextLine = mode.slug === "personal" ? text(mode, "location") : mode.slug === "event" ? text(mode, "eventName") : text(mode, "company");
  return {
    profile: [profile.display_name || "Add your name", contextLine, mode.image_path ? "photo set" : "no photo yet"].filter(Boolean).join(" · "),
    links: [mode.blocks?.length ? `${mode.blocks.length} block${mode.blocks.length === 1 ? "" : "s"}` : "", mode.links.length ? `${mode.links.length} link${mode.links.length === 1 ? "" : "s"}${hidden ? ` · ${hidden} hidden` : ""}` : ""].filter(Boolean).join(" · ") || "Nothing added yet",
    appearance: `${cap(mode.appearance.theme)} · ${layoutLabel(mode)}`,
    settings: `${mode.is_enabled ? "Mode is live" : "Mode is off"} · ${profile.is_published ? "public" : "draft"}`,
    share: api.publicUrl(mode.slug).replace(/^https?:\/\//, ""),
  };
}

// ---------------------------------------------------------------- Home

export function HomeSection({ api }: { api: EditorApi }) {
  const { mode, slug } = api;
  const info = summaries(api);
  const others = MODE_SLUGS.filter((item) => item !== slug);
  return (
    <div>
      <h1 className="font-display text-[3.4rem] font-extrabold leading-[0.92] tracking-[-0.055em] xl:text-[4rem]">{modeMeta[slug].name} Mode</h1>
      <p className="mt-3 max-w-[540px] text-[16px] leading-[1.55] text-black/65">{modeIntro[slug]} It lives at <span className="font-medium text-black">{info.share}</span>.</p>

      <div className="mt-8 grid grid-cols-2 gap-4">
        <button className="group relative row-span-2 flex min-h-[290px] flex-col justify-end overflow-hidden rounded-[22px] bg-[#0D0D0D] p-6 text-left text-[#F5F4EF]" onClick={() => api.go("profile")} type="button">
          {mode.image_url && <>
            {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL */}
            <img alt="" className="absolute inset-0 size-full object-cover opacity-55 transition duration-500 group-hover:scale-[1.03]" src={mode.image_url} />
            <span className="absolute inset-0 bg-gradient-to-t from-[#0D0D0D] via-[#0D0D0D]/50 to-transparent" />
          </>}
          <CardHead index={1} light />
          <p className="relative mt-3 font-display text-[1.75rem] font-bold tracking-[-0.04em]">Profile</p>
          <p className="relative mt-2 text-sm text-white/75">{info.profile}</p>
        </button>
        {(["links", "appearance", "settings", "share"] as const).map((id) => {
          const index = SECTIONS.findIndex((item) => item.id === id) + 1;
          return (
            <button className="flex min-h-[137px] flex-col rounded-[22px] bg-white p-6 text-left shadow-[inset_0_0_0_1px_rgba(13,13,13,.08)] transition hover:shadow-[inset_0_0_0_1.5px_#0D0D0D]" key={id} onClick={() => api.go(id)} type="button">
              <CardHead index={index} />
              <p className="mt-3 font-display text-[1.6rem] font-bold leading-none tracking-[-0.04em]">{SECTIONS[index - 1].title}</p>
              <p className="mt-2.5 truncate text-sm text-black/60">{info[id]}</p>
            </button>
          );
        })}
      </div>

      <p className="mb-3 mt-9 text-[15px] font-semibold">Also in your identity</p>
      <div className="grid grid-cols-2 gap-4">
        {others.map((item) => {
          const other = api.modes.find((entry) => entry.slug === item);
          const meta = modeMeta[item];
          const sub = !other?.is_enabled ? "Mode is off" : item === "event" ? (text(other, "eventName") ? `${text(other, "eventName")}${text(other, "city") ? ` · ${text(other, "city")}` : ""}` : "Set up your next event") : item === "business" ? (text(other, "company") || text(other, "role") || "Add your role and company") : (text(other, "location") || "Your everyday self");
          return (
            <button className="flex min-h-[72px] items-center justify-between gap-3 rounded-[18px] px-5 text-left transition hover:brightness-[.97]" key={item} onClick={() => api.go("home", item)} style={{ background: meta.bg, color: meta.fg, boxShadow: meta.ring }} type="button">
              <span className="min-w-0"><span className="block text-[17px] font-bold">{meta.name}{item === "event" && other && text(other, "eventName") ? ` · ${text(other, "eventName")}` : ""}</span><span className="block truncate text-[13px] opacity-75">{sub}</span></span>
              <span className="shrink-0 text-sm font-semibold">Open →</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CardHead({ index, light = false }: { index: number; light?: boolean }) {
  return <div className="relative flex w-full items-center justify-between"><span className="font-label text-xs text-[#FF5A4F]">0{index}</span><span className={`text-sm font-semibold ${light ? "text-white" : ""}`}>Edit <span aria-hidden="true">→</span></span></div>;
}

export function MobileHome({ api, onPreview }: { api: EditorApi; onPreview: () => void }) {
  const { mode, profile, slug } = api;
  const info = summaries(api);
  const statusText = !profile.is_published ? "Draft · not live yet" : !mode.is_enabled ? "Mode is off" : "Live";
  return (
    <div>
      <div className="flex gap-4 rounded-[24px] bg-white p-3.5 shadow-[inset_0_0_0_1px_rgba(13,13,13,.08)]">
        {/* A div, not a button: the preview inside renders its own (inert) buttons. */}
        <div aria-label="Open full-screen preview" className="relative h-[196px] w-[104px] shrink-0 cursor-pointer overflow-hidden rounded-[18px] bg-[#0D0D0D] p-[3px]" onClick={onPreview} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onPreview(); } }} role="button" tabIndex={0}>
          <div aria-hidden="true" className="pointer-events-none h-full overflow-hidden rounded-[15px]">
            <div className="w-[360px] origin-top-left scale-[0.272] [&>article]:rounded-none" inert>
              <ProfileRenderer mode={mode} profile={profile} selectedRewards={api.selectedRewards} viewerState="owner" />
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

      <nav aria-label="Editor sections" className="mt-4">
        {SECTIONS.map((item, index) => (
          <button className="flex min-h-[74px] w-full items-center gap-4 border-b border-black/10 px-1 text-left" key={item.id} onClick={() => api.go(item.id)} type="button">
            <span className="font-label text-[11px] text-[#FF5A4F]">0{index + 1}</span>
            <span className="min-w-0 flex-1"><span className="block font-display text-[1.45rem] font-bold leading-tight tracking-[-0.04em]">{item.title}</span><span className="block truncate text-[13px] text-black/55">{info[item.id]}</span></span>
            <span aria-hidden="true" className="text-xl text-black/35">›</span>
          </button>
        ))}
      </nav>

      <div className="mt-6 grid gap-2.5">
        {MODE_SLUGS.filter((item) => item !== slug).map((item) => {
          const meta = modeMeta[item];
          return <button className="flex min-h-14 items-center justify-between rounded-[16px] px-4 text-left text-[15px] font-bold" key={item} onClick={() => api.go("home", item)} style={{ background: meta.bg, color: meta.fg, boxShadow: meta.ring }} type="button">{meta.name} Mode<span className="text-sm font-semibold">Open →</span></button>;
        })}
      </div>
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
    <div className="flex items-start gap-5">
      <button aria-label={mode.image_url ? "Crop and position photo" : "Upload a photo"} className="relative h-[150px] w-[120px] shrink-0 overflow-hidden bg-[#E4E2DA] transition hover:brightness-95" onClick={mode.image_url ? api.recropPhoto : api.pickPhoto} style={{ clipPath: cutCorner(34), borderRadius: 18 }} type="button">
        {mode.image_url
          // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL
          ? <img alt={`${profile.display_name} in ${modeMeta[slug].name} Mode`} className="absolute inset-0 size-full object-cover" src={mode.image_url} />
          : <span className="absolute inset-0 grid place-items-center"><span className="text-center"><span className="block font-display text-4xl font-extrabold text-black/25">{(profile.display_name.trim()[0] ?? "S").toUpperCase()}</span><span className="mt-1 block text-xs font-semibold text-black/55">Add photo</span></span></span>}
        {api.busyPhoto && <span className="absolute inset-0 grid place-items-center bg-white/70"><span className="size-6 animate-spin rounded-full border-2 border-black/20 border-t-black" /></span>}
      </button>
      <div className="min-w-0 pt-1">
        <p className="text-sm font-semibold">Photo</p>
        <div className="mt-2.5 flex flex-wrap gap-2">
          {mode.image_url ? <>
            <Pill onClick={api.recropPhoto} variant="ink">Crop & position</Pill>
            <Pill onClick={api.pickPhoto}>Replace</Pill>
            <Pill className="text-black/60" onClick={api.removePhoto} variant="ghost">Remove</Pill>
          </> : <Pill onClick={api.pickPhoto} variant="ink">Upload photo</Pill>}
        </div>
        <p className="mt-2.5 text-[13px] leading-5 text-black/55">JPG, PNG or WebP. This photo belongs to {modeMeta[slug].name} Mode only.</p>
        {canBorrow && <button className="mt-1.5 min-h-9 text-[13px] font-semibold underline underline-offset-4" onClick={() => api.usePhotoFrom("personal")} type="button">Use my Personal photo</button>}
      </div>
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
  const hint = status === "checking" ? "Checking…" : status === "available" ? <span className="font-semibold text-[#1E7B4F]">Available ✓</span> : `setuvara.com/${api.profile.username || "you"}`;
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
        <div className="space-y-6">
          <PhotoBlock api={api} />
          <NameField api={api} big hint="First name or what friends call you" />
          <UsernameField api={api} />
          <Field error={api.fieldErrors.bio} hint={<Counter max={280} value={api.profile.bio} />} htmlFor={bioId} label="Personal line">
            <TextArea aria-invalid={Boolean(api.fieldErrors.bio)} id={bioId} maxLength={280} onChange={(event) => api.updateProfile({ bio: event.target.value })} placeholder="Film photography, late dinners, Sunday swims." value={api.profile.bio} />
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <SettingInput api={api} field="location" label="Location" max={80} placeholder="Lisbon" />
            <SettingInput api={api} field="pronouns" label="Pronouns" max={40} placeholder="she / her" />
          </div>
          <SettingInput api={api} field="note" hint="Optional" label="A little more" max={280} multiline placeholder="What you’re into lately, languages, where you’re from." />
        </div>
      )}
      {slug === "event" && (
        <div className="space-y-6">
          <Card className="p-5 sm:p-6" tone="coral">
            <div className="flex items-baseline justify-between gap-3"><MonoLabel>The event</MonoLabel><span className="text-[13px] font-semibold">Saved on every connection</span></div>
            <label className="sr-only" htmlFor="event-name">Event name</label>
            <TextInput big className="mt-3" id="event-name" maxLength={100} onChange={(event) => api.updateSetting("eventName", event.target.value)} placeholder="Slush" value={text(api.mode, "eventName")} />
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div><label className="mb-2 block text-sm font-semibold" htmlFor="event-city">City</label><TextInput id="event-city" maxLength={80} onChange={(event) => api.updateSetting("city", event.target.value)} placeholder="Helsinki" value={text(api.mode, "city")} /></div>
              <div><label className="mb-2 block text-sm font-semibold" htmlFor="event-dates">Dates</label><TextInput id="event-dates" maxLength={80} onChange={(event) => api.updateSetting("dateLabel", event.target.value)} placeholder="20–21 Nov 2026" value={text(api.mode, "dateLabel")} /></div>
            </div>
          </Card>
          <PhotoBlock api={api} />
          <NameField api={api} label="Name" />
          <SettingInput api={api} field="role" label="Role, project or company" max={80} placeholder="Founder · Northlight" />
          <SettingInput api={api} field="hereToMeet" hint="Shown under your name" label="Here to meet" max={280} multiline placeholder="Product designers and early-stage operators." />
        </div>
      )}
      {slug === "business" && (
        <div className="space-y-6">
          <PhotoBlock api={api} />
          <div className="grid gap-5 sm:grid-cols-2">
            <NameField api={api} hint="Shared" label="Full name" />
            <SettingInput api={api} field="role" label="Role" max={80} placeholder="Partnerships Lead" />
            <SettingInput api={api} field="company" label="Company" max={100} placeholder="Lumen Labs" />
            <SettingInput api={api} field="city" label="City" max={80} placeholder="Lisbon" />
          </div>
          <SettingInput api={api} field="description" hint="Optional" label="Professional description" max={280} multiline placeholder="Add a one-line description" />
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

export function LinkRow({ api, link, editing, onEdit }: { api: EditorApi; link: ProfileLink; editing: boolean; onEdit: (open: boolean) => void }) {
  const provider = providerForLink(link.link_type);
  const resolved = resolveStoredLink(provider.id, link.url);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: link.id });
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
      <div className="flex min-h-[70px] items-center gap-1.5 py-2 pl-1.5 pr-2 sm:gap-2 sm:pr-3">
        <DragHandle {...attributes} {...listeners} />
        <ProviderMark className="size-10 rounded-xl bg-[#F5F4EF]" icon={provider.icon} label={provider.name} url={resolved?.url ?? link.url} />
        <button className={`min-w-0 flex-1 px-1.5 text-left ${link.is_visible ? "" : "opacity-50"}`} onClick={toggleEditing} type="button">
          <span className="flex items-center gap-2"><span className="truncate text-[15px] font-semibold">{editing ? "Editing link" : link.title}</span>{!link.is_visible && <span className="shrink-0 rounded-full px-2 py-0.5 font-label text-[9px] tracking-[0.1em] shadow-[inset_0_0_0_1px_rgba(13,13,13,.35)]">HIDDEN</span>}</span>
          <span className="block truncate text-[13px] text-black/55">{editing ? provider.name : resolved?.displayValue ?? provider.name}</span>
        </button>
        <Toggle label={`${link.is_visible ? "Hide" : "Show"} ${link.title}`} on={link.is_visible} onChange={() => api.toggleLink(link)} />
        <button className="hidden min-h-10 rounded-full px-3 text-sm font-semibold hover:bg-black/[0.05] sm:block" onClick={toggleEditing} type="button">{editing ? "Close" : "Edit"}</button>
        <button aria-label={`Delete ${link.title}`} className="hidden size-10 place-items-center rounded-full text-lg text-black/40 hover:bg-[#B42318]/[0.07] hover:text-[#B42318] sm:grid" onClick={() => api.deleteLink(link)} type="button">×</button>
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

// ---------------------------------------------------------------- Appearance

export function AppearanceSection({ api }: { api: EditorApi }) {
  const { mode, slug } = api;
  const appearance = mode.appearance;
  const custom = !ACCENTS.some((accent) => accent.hex.toLowerCase() === appearance.accent.toLowerCase());
  const rewards = PASSPORT_REWARDS.filter((reward) => ["profile_treatment", "accent", "profile_mark"].includes(reward.category));
  return (
    <div>
      <SectionHeader description={`Curated for ${modeMeta[slug].name} Mode. Every change previews live.`} slug={slug} title="Appearance" />

      <h2 className="mb-3 text-sm font-semibold">Theme</h2>
      <div className="grid grid-cols-3 gap-3">
        {(["light", "dark", "editorial"] as const).map((theme) => {
          const on = appearance.theme === theme;
          const swatch = themeSwatches[theme];
          return (
            <button aria-pressed={on} className="text-left" key={theme} onClick={() => api.updateAppearance({ theme })} type="button">
              <span className="flex h-[58px] items-center rounded-2xl px-4 font-display text-[1.6rem] font-bold tracking-[-0.04em] transition" style={{ background: swatch.bg, color: theme === "editorial" ? appearance.accent : swatch.fg, boxShadow: on ? `0 0 0 3px ${paper}, 0 0 0 5px ${coral}` : "inset 0 0 0 1px rgba(13,13,13,.12)" }}>Aa</span>
              <span className="mt-2 block text-sm font-semibold">{cap(theme)}{on && " ✓"}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-8 flex items-baseline justify-between"><h2 className="text-sm font-semibold">Layout</h2><span className="text-[13px] text-black/50">Curated · each Mode keeps its structure</span></div>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:max-w-[440px]">
        {LAYOUTS[slug].map((layout) => {
          const on = appearance.layout === layout.value;
          return (
            <button aria-pressed={on} className="text-left" key={layout.value} onClick={() => api.updateAppearance({ layout: layout.value })} type="button">
              <span className="block overflow-hidden rounded-[18px] transition" style={{ boxShadow: on ? `0 0 0 3px ${paper}, 0 0 0 5px ${coral}` : "inset 0 0 0 1px rgba(13,13,13,.12)" }}><LayoutSketch accent={appearance.accent} layout={layout.value} theme={appearance.theme} /></span>
              <span className="mt-2 flex items-baseline justify-between gap-2"><span className="text-sm font-semibold">{layout.label}</span>{on && <span className="font-label text-[9px] tracking-[0.12em] text-[#FF5A4F]">CURRENT</span>}</span>
              <span className="block text-[12px] text-black/50">{layout.note}</span>
            </button>
          );
        })}
      </div>

      <h2 className="mb-3 mt-8 text-sm font-semibold">Accent</h2>
      <div className="flex flex-wrap gap-x-4 gap-y-3">
        {ACCENTS.map((accent) => {
          const on = appearance.accent.toLowerCase() === accent.hex.toLowerCase();
          return (
            <button aria-label={`${accent.name} accent`} aria-pressed={on} className="flex w-12 flex-col items-center gap-1.5" key={accent.hex} onClick={() => api.updateAppearance({ accent: accent.hex })} type="button">
              <span className="size-11 rounded-full transition" style={{ background: accent.hex, boxShadow: on ? `0 0 0 3px ${paper}, 0 0 0 5px ${ink}` : "inset 0 0 0 1px rgba(13,13,13,.12)" }} />
              <span className="text-[12px] text-black/70">{accent.name}</span>
            </button>
          );
        })}
        <label className="flex w-12 cursor-pointer flex-col items-center gap-1.5">
          <span className="relative grid size-11 place-items-center rounded-full border-[1.5px] border-dashed border-black/35 text-lg" style={custom ? { background: appearance.accent, border: "none", boxShadow: `0 0 0 3px ${paper}, 0 0 0 5px ${ink}` } : undefined}>
            {!custom && "+"}
            <input aria-label="Custom accent colour" className="absolute inset-0 cursor-pointer opacity-0" onChange={(event) => { if (/^#[\da-f]{6}$/i.test(event.target.value)) api.updateAppearance({ accent: event.target.value.toUpperCase() }); }} type="color" value={appearance.accent.toLowerCase()} />
          </span>
          <span className="text-[12px] text-black/70">Custom</span>
        </label>
      </div>

      <h2 className="mb-3 mt-8 text-sm font-semibold">Image</h2>
      <Segmented label="Image treatment" onChange={(imageTreatment) => api.updateAppearance({ imageTreatment })} options={[{ value: "full-bleed", label: "Full bleed" }, { value: "portrait", label: "Portrait" }, { value: "compact", label: "Compact" }]} value={appearance.imageTreatment} />

      <div className="mt-10 rounded-[22px] bg-white p-5 shadow-[inset_0_0_0_1px_rgba(13,13,13,.08)] sm:p-6">
        <div className="flex items-baseline justify-between gap-3"><h2 className="text-[15px] font-semibold">Earned identity treatments</h2><Link className="text-[13px] font-semibold underline underline-offset-4" href="/app/passport">Passport</Link></div>
        <p className="mt-1 text-[13px] text-black/55">Unlocked through real connections. They apply to every Mode.</p>
        <ul className="mt-4 divide-y divide-black/[0.07]">
          {rewards.map((reward) => {
            const unlocked = api.unlockedRewards.includes(reward.id);
            const equipped = api.selectedRewards[reward.category] === reward.id;
            return (
              <li className="flex items-center justify-between gap-3 py-3" key={reward.id}>
                <div className="min-w-0"><p className="truncate text-sm font-semibold">{reward.name}</p><p className="text-[12px] text-black/50">{unlocked ? reward.description : `Unlocks at ${reward.milestone} connections`}</p></div>
                {equipped ? <span className="inline-flex min-h-9 items-center rounded-full bg-[#C7FF4A] px-3 text-[13px] font-semibold">Equipped</span>
                  : unlocked ? <Pill className="min-h-9 text-[13px]" onClick={() => void api.equipReward(reward.category, reward.id)}>Equip</Pill>
                    : <span className="inline-flex min-h-9 items-center gap-1.5 px-2 text-[13px] text-black/40"><svg aria-hidden="true" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 16 16"><rect height="7" rx="1.5" width="10" x="3" y="7" /><path d="M5 7V5a3 3 0 0 1 6 0v2" /></svg>Locked</span>}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function LayoutSketch({ layout, theme, accent }: { layout: string; theme: ProfileMode["appearance"]["theme"]; accent: string }) {
  const bg = theme === "dark" ? ink : theme === "editorial" ? paper : "#FFFFFF";
  const fg = theme === "dark" ? paper : ink;
  const soft = theme === "dark" ? "rgba(245,244,239,.22)" : "rgba(13,13,13,.12)";
  const photo = theme === "dark" ? "#3A3A3A" : "#D9D6CC";
  const bar = (width: string, height = 6, color = fg) => <span className="block rounded-full" style={{ width, height, background: color }} />;
  return (
    <span className="relative block h-[150px] w-full" style={{ background: bg }}>
      {layout === "full-bleed" && <><span className="absolute inset-x-0 top-0 h-[62%]" style={{ background: photo, clipPath: cutCorner(20) }} /><span className="absolute inset-x-3 bottom-3 grid gap-1.5">{bar("60%", 9)}{bar("80%", 4, soft)}<span className="mt-1 flex gap-1">{bar("34%", 10, accent)}{bar("18%", 10, soft)}</span></span></>}
      {layout === "portrait-editorial" && <><span className="absolute left-3 right-3 top-3 h-[48%] rounded-lg" style={{ background: photo, clipPath: cutCorner(16) }} /><span className="absolute inset-x-3 bottom-3 grid gap-1.5">{bar("70%", 9)}{bar("50%", 4, soft)}<span className="mt-1 flex gap-1">{bar("26%", 8, soft)}{bar("26%", 8, soft)}{bar("20%", 8, soft)}</span></span></>}
      {layout === "event-poster" && <><span className="absolute inset-x-0 top-0 grid h-[46%] content-end gap-1.5 px-3 pb-3" style={{ background: accent, clipPath: cutCorner(16) }}>{bar("70%", 10, ink)}{bar("40%", 4, ink)}</span><span className="absolute left-3 top-[54%] h-7 w-6 rounded" style={{ background: photo }} /><span className="absolute left-11 right-3 top-[57%] grid gap-1">{bar("60%", 6)}{bar("40%", 4, soft)}</span><span className="absolute inset-x-3 bottom-3 grid grid-cols-2 gap-1">{bar("100%", 10, soft)}{bar("100%", 10, soft)}</span></>}
      {layout === "conference-card" && <><span className="absolute inset-x-0 top-0 grid h-[24%] content-center px-3" style={{ background: accent }}>{bar("50%", 7, ink)}</span><span className="absolute left-3 top-[32%] h-9 w-7 rounded" style={{ background: photo }} /><span className="absolute left-12 right-3 top-[36%] grid gap-1">{bar("70%", 7)}{bar("45%", 4, soft)}</span><span className="absolute inset-x-3 bottom-3 grid gap-1">{bar("100%", 9, fg)}<span className="grid grid-cols-2 gap-1">{bar("100%", 8, soft)}{bar("100%", 8, soft)}</span></span></>}
      {layout === "structured" && <><span className="absolute left-3 top-3">{bar("22px", 5)}</span><span className="absolute left-3 top-6 h-9 w-7 rounded" style={{ background: photo }} /><span className="absolute left-12 right-3 top-10">{bar("70%", 9)}</span><span className="absolute inset-x-3 top-[58%] grid grid-cols-3 gap-1 border-y py-1.5" style={{ borderColor: fg }}>{bar("80%", 4, soft)}{bar("80%", 4, soft)}{bar("80%", 4, soft)}</span><span className="absolute inset-x-3 bottom-3 grid grid-cols-2 gap-1">{bar("100%", 9, fg)}{bar("100%", 9, soft)}</span></>}
      {layout === "editorial-business" && <><span className="absolute left-3 top-3">{bar("22px", 5)}</span><span className="absolute inset-x-3 top-8 grid gap-1.5">{bar("85%", 12)}{bar("55%", 12)}</span><span className="absolute inset-x-3 top-[62%] h-px" style={{ background: fg }} /><span className="absolute inset-x-3 bottom-3 grid gap-1">{bar("100%", 6, soft)}{bar("100%", 6, soft)}{bar("100%", 6, soft)}</span></>}
    </span>
  );
}

// ---------------------------------------------------------------- Mode Settings

export function SettingsSection({ api }: { api: EditorApi }) {
  const { mode, slug, profile } = api;
  const contacts = mode.links.filter((link) => CONTACT_PROVIDERS.includes(providerForLink(link.link_type).id));
  const description = { personal: "Who sees what in Personal Mode.", event: "What this Event Mode shows, and what it remembers.", business: "Contact rules and what Business Mode shows." }[slug];
  return (
    <div>
      <SectionHeader description={description} slug={slug} title="Mode Settings" />

      <Card className="divide-y divide-black/[0.07] px-5 sm:px-6">
        <SettingRow description={slug === "personal" ? "Personal is always on. It’s where people land by default." : mode.is_enabled ? "Its link and QR code open for anyone you share them with." : "Its link and QR code don’t open. Nothing is deleted."} title={`${modeMeta[slug].name} Mode is ${mode.is_enabled ? "on" : "off"}`}>
          <Toggle disabled={slug === "personal"} label={`${modeMeta[slug].name} Mode on`} on={mode.is_enabled} onChange={(next) => void api.setModeEnabled(next)} />
        </SettingRow>
        <SettingRow description={profile.is_published ? "Anyone with your link or QR can open your enabled Modes." : "Draft. Nobody can open your Setuvara until you publish."} title={profile.is_published ? "Your Setuvara is public" : "Your Setuvara is private"}>
          <Toggle label="Setuvara public" on={profile.is_published} onChange={(next) => void api.setPublished(next)} />
        </SettingRow>
      </Card>

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

function SettingRow({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return <div className="flex items-center justify-between gap-4 py-4"><div className="min-w-0"><p className="text-[15px] font-semibold">{title}</p><p className="mt-0.5 text-[13px] leading-5 text-black/55">{description}</p></div>{children}</div>;
}

function AppearsIn({ api }: { api: EditorApi }) {
  const rows = useMemo(() => {
    const bySlug = Object.fromEntries(api.modes.map((mode) => [mode.slug, mode])) as Record<ModeSlug, ProfileMode | undefined>;
    const has = (slug: ModeSlug, test: (mode: ProfileMode) => boolean) => Boolean(bySlug[slug] && test(bySlug[slug]!));
    const list: { label: string; cells: Record<ModeSlug, boolean> }[] = [
      { label: "Photo", cells: { personal: has("personal", (m) => Boolean(m.image_path)), event: has("event", (m) => Boolean(m.image_path)), business: has("business", (m) => Boolean(m.image_path)) } },
      { label: "Personal line", cells: { personal: Boolean(api.profile.bio.trim()), event: false, business: false } },
      { label: "Location or city", cells: { personal: has("personal", (m) => Boolean(text(m, "location").trim())), event: has("event", (m) => Boolean(text(m, "city").trim())), business: has("business", (m) => Boolean(text(m, "city").trim())) } },
      { label: "Role & company", cells: { personal: false, event: has("event", (m) => Boolean(text(m, "role").trim())), business: has("business", (m) => Boolean(text(m, "role").trim() || text(m, "company").trim())) } },
      { label: "Here to meet", cells: { personal: false, event: has("event", (m) => Boolean(text(m, "hereToMeet").trim())), business: false } },
    ];
    const names = new Map<string, Record<ModeSlug, boolean>>();
    for (const mode of api.modes) for (const link of mode.links) {
      const name = providerForLink(link.link_type).name;
      const cells = names.get(name) ?? { personal: false, event: false, business: false };
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
  const qrId = useId().replace(/:/g, "");
  const linkUrl = api.publicUrl(slug, "link");
  const qrUrl = api.publicUrl(slug, "qr");
  const displayUrl = api.publicUrl(slug).replace(/^https?:\/\//, "");
  const offline = !profile.is_published || !mode.is_enabled;
  const darkShare = api.selectedRewards.share_treatment === "signal_share" || api.selectedRewards.share_treatment === "network_share";
  const coralFrame = api.selectedRewards.qr_frame === "coral_qr_frame";
  const eventName = text(mode, "eventName");

  async function copy() {
    const ok = await copyText(linkUrl);
    setCopied(ok);
    api.toast(ok ? "Link copied" : "Copy didn’t work. Select the link instead.");
    if (ok) window.setTimeout(() => setCopied(false), 2000);
  }

  async function share() {
    const url = api.publicUrl(slug, "native_share");
    if (navigator.share) {
      try { await navigator.share({ title: `${profile.display_name} · ${modeMeta[slug].name} Mode`, url }); } catch { /* dismissed */ }
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

      <div className="grid grid-cols-1 gap-5 md:grid-cols-[minmax(0,300px)_minmax(0,1fr)]">
        <div className={`rounded-[24px] p-6 ${darkShare ? "bg-[#0D0D0D]" : "bg-[#0D0D0D]"} text-[#F5F4EF]`}>
          <MonoLabel color={coral}>Sharing now · {modeMeta[slug].name}{eventName && slug === "event" ? ` · ${eventName}` : ""}</MonoLabel>
          <button aria-label="Show QR code full screen" className={`mt-4 block w-full rounded-[20px] bg-white p-5 ${coralFrame ? "outline outline-4 outline-offset-2 outline-[#FF5A4F]" : ""}`} onClick={() => setFull(true)} type="button">
            <QRCodeSVG bgColor="#FFFFFF" className="h-auto w-full" fgColor={ink} id={qrId} imageSettings={{ src: markDataUri, height: 48, width: 48, excavate: true }} level="H" marginSize={1} size={256} title={`${modeMeta[slug].name} Mode QR code`} value={qrUrl} />
          </button>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[13px] text-white/70">
            <span>Download QR</span>
            <button className="min-h-9 font-semibold text-white underline underline-offset-4" onClick={() => void downloadQr(qrId, "png", `setuvara-${profile.username}-${slug}`)} type="button">PNG</button>
            <button className="min-h-9 font-semibold text-white underline underline-offset-4" onClick={() => void downloadQr(qrId, "svg", `setuvara-${profile.username}-${slug}`)} type="button">SVG</button>
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <div>
            <p className="mb-2 text-sm font-semibold">Public link</p>
            <div className="flex min-h-[56px] items-center gap-2 rounded-2xl bg-white py-1.5 pl-4 pr-1.5 shadow-[inset_0_0_0_1px_rgba(13,13,13,.1)]">
              <span className="min-w-0 flex-1 truncate font-label text-[13px]">{displayUrl}</span>
              <Pill className="shrink-0" onClick={() => void copy()} variant="ink">{copied ? "Copied ✓" : "Copy link"}</Pill>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 max-[380px]:grid-cols-1">
            <Pill onClick={() => void share()} variant="coral">Share…</Pill>
            <Pill onClick={() => setFull(true)}>Full-screen QR</Pill>
          </div>
          <div>
            <p className="mb-2 text-sm font-semibold">Share a different Mode instead</p>
            <Segmented full label="Mode to share" onChange={(next) => api.go("share", next)} options={MODE_SLUGS.map((item) => ({ value: item, label: modeMeta[item].name }))} value={slug} />
          </div>
          <div className="grid gap-3">
            {(["qr_frame", "share_treatment"] as const).map((category) => <RewardSelect api={api} category={category} key={category} />)}
          </div>
        </div>
      </div>

      {full && <FullscreenQr dark={darkShare} name={profile.display_name} onClose={() => setFull(false)} onCopy={() => void copy()} subtitle={`${modeMeta[slug].name}${eventName && slug === "event" ? ` · ${eventName}` : ""}`} url={displayUrl} value={qrUrl} />}
    </div>
  );
}

function RewardSelect({ api, category }: { api: EditorApi; category: RewardCategory }) {
  const options = PASSPORT_REWARDS.filter((reward) => reward.category === category);
  const id = useId();
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-2xl bg-white px-4 py-2.5 shadow-[inset_0_0_0_1px_rgba(13,13,13,.08)]">
      <label className="text-sm font-semibold" htmlFor={id}>{category === "qr_frame" ? "QR frame" : "Share treatment"}</label>
      <select className="min-h-10 min-w-0 max-w-full flex-1 rounded-full bg-[#F5F4EF] px-3 text-sm font-medium sm:max-w-[200px]" id={id} onChange={(event) => { if (event.target.value) void api.equipReward(category, event.target.value); }} value={api.selectedRewards[category] ?? ""}>
        <option value="">Setuvara default</option>
        {options.map((reward) => <option disabled={!api.unlockedRewards.includes(reward.id)} key={reward.id} value={reward.id}>{reward.name}{api.unlockedRewards.includes(reward.id) ? "" : ` · at ${reward.milestone}`}</option>)}
      </select>
    </div>
  );
}

function FullscreenQr({ value, url, name, subtitle, dark, onClose, onCopy }: { value: string; url: string; name: string; subtitle: string; dark: boolean; onClose: () => void; onCopy: () => void }) {
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
      <div className="mt-7 w-full max-w-[320px] rounded-[28px] bg-white p-5 shadow-[0_30px_80px_-40px_rgba(13,13,13,.6)]">
        <QRCodeSVG bgColor="#FFFFFF" className="h-auto w-full" fgColor={ink} imageSettings={{ src: markDataUri, height: 56, width: 56, excavate: true }} level="H" marginSize={1} size={300} value={value} />
      </div>
      <p className="mt-6 text-[15px] font-semibold">Scan to open my Setuvara</p>
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
