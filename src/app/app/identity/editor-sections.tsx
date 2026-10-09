"use client";

import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Cropper from "react-easy-crop";
import { QRCodeSVG } from "qrcode.react";
import Link from "next/link";
import NextImage from "next/image";
import { useState, type FormEvent, type ReactNode } from "react";
import { useForm } from "react-hook-form";

import type { ModeSlug, ProfileIdentity, ProfileLink, ProfileMode } from "@/components/profile/types";
import { PASSPORT_REWARDS, type RewardCategory } from "@/lib/passport/rewards";
import { normalizeLinkPayload, providerForLink, resolveStoredLink, type LinkMode, type LinkProvider } from "@/lib/links/providers";
import { ProviderPicker } from "@/components/links/provider-picker";
import { ProviderMark } from "@/components/links/provider-mark";

const coral = "#FF5A4F";
const accentOptions = [coral, "#C7FF4A", "#AFCBFF", "#E8A6FF", "#F5C66E"];
const modeLayouts: Record<ModeSlug, { value: string; label: string }[]> = {
  personal: [{ value: "full-bleed", label: "Full Bleed" }, { value: "portrait-editorial", label: "Portrait Editorial" }],
  event: [{ value: "event-poster", label: "Event Poster" }, { value: "conference-card", label: "Conference Card" }],
  business: [{ value: "structured", label: "Structured" }, { value: "editorial-business", label: "Editorial Business" }],
};
type ProfileFormValues = { username: string; display_name: string; bio: string };
type SettingsFormValues = Record<string, string | boolean>;
export function SectionButton({ active, children, onClick }: { active: boolean; children: ReactNode; onClick: () => void }) {
  return <button className={`flex min-h-12 w-full items-center rounded-xl px-4 text-left text-sm font-semibold ${active ? "bg-[#0d0d0d] text-white" : "text-black/65 hover:bg-black/5"}`} onClick={onClick} type="button">{children}</button>;
}

export function ProfileSection({ profile, form, mode, onDraftChange, onPhoto, onRemovePhoto, onSave }: { profile: ProfileIdentity; form: ReturnType<typeof useForm<ProfileFormValues>>; mode: ProfileMode; onDraftChange: () => void; onPhoto: () => void; onRemovePhoto: () => void; onSave: () => void }) {
  const { register, formState: { errors } } = form;
  return <div onChange={onDraftChange}><SectionHeading eyebrow="01 · PROFILE" title="Start with you." description="One person, at the center of every Mode." />
    <div className="mt-6 flex flex-wrap items-center gap-4"><div className="relative grid size-20 place-items-center overflow-hidden rounded-[1.5rem] bg-[#f5f4ef] text-2xl font-semibold">{mode.image_url ? <NextImage alt={`${profile.display_name} profile`} className="object-cover" fill sizes="80px" src={mode.image_url} unoptimized /> : profile.display_name.slice(0, 1).toUpperCase()}</div><div><p className="font-semibold">A photo that feels like you</p><p className="mt-1 text-xs text-black/50">JPEG, PNG, or WebP · up to 5 MB</p><div className="mt-2 flex gap-2"><button className="min-h-11 rounded-full border border-black/15 px-4 text-xs font-semibold" onClick={onPhoto} type="button">{mode.image_path ? "Replace photo" : "Add a photo"}</button>{mode.image_path && <button className="min-h-11 px-3 text-xs font-semibold text-black/55 underline underline-offset-4" onClick={onRemovePhoto} type="button">Remove</button>}</div></div></div>
    <div className="mt-7 space-y-5"><Field label="Username" error={errors.username?.message}><div className="flex items-center rounded-2xl border border-black/15 px-4 focus-within:border-black"><span className="text-black/40">@</span><input className="min-h-12 w-full px-2 text-base outline-none" {...register("username")} /></div></Field><Field label="Display name" error={errors.display_name?.message}><input className="min-h-12 w-full rounded-2xl border border-black/15 px-4 text-base outline-none focus:border-black" maxLength={80} {...register("display_name")} /></Field><Field label="Personal bio" error={errors.bio?.message}><textarea className="min-h-28 w-full resize-y rounded-2xl border border-black/15 px-4 py-3 text-base outline-none focus:border-black" maxLength={280} placeholder="A few honest words about you" {...register("bio")} /></Field></div>
    <button className="mt-5 min-h-11 text-xs font-semibold underline underline-offset-4" onClick={onSave} type="button">Save identity details</button>
  </div>;
}

export function LinksSection({ mode, links, newTitle, newValue, newProvider, setNewTitle, setNewValue, setNewProvider, addLink, toggleLink, removeLink, editLink, reorder }: { mode: LinkMode; links: ProfileLink[]; newTitle: string; newValue: string; newProvider: LinkProvider | null; setNewTitle: (value: string) => void; setNewValue: (value: string) => void; setNewProvider: (provider: LinkProvider | null) => void; addLink: (event: FormEvent<HTMLFormElement>) => void; toggleLink: (link: ProfileLink) => void; removeLink: (link: ProfileLink) => void; editLink: (link: ProfileLink, title: string, value: string) => void; reorder: (links: ProfileLink[]) => void }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const normalizedValue = newProvider && newValue ? normalizeLinkPayload({ providerId: newProvider.id, value: newValue }) : null;
  const valueLabel = newProvider?.inputKind === "email" ? "Email address" : newProvider?.inputKind === "phone" ? "Phone number" : newProvider?.inputKind === "handle" || newProvider?.inputKind === "username" ? "Username or profile link" : "Link or URL";
  return <div><SectionHeading eyebrow="02 · LINKS" title="Give people a next step." description="Keep each Mode focused on what matters in that moment." />
    {!links.length && <div className="mt-6 rounded-2xl bg-[#f5f4ef] p-5"><p className="font-semibold">No links yet</p><p className="mt-1 text-sm text-black/55">Add the first way people can reach you.</p></div>}
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={({ active, over }) => { if (!over || active.id === over.id) return; const from = links.findIndex((item) => item.id === active.id); const to = links.findIndex((item) => item.id === over.id); reorder(arrayMove(links, from, to)); }}>
      <SortableContext items={links.map((link) => link.id)} strategy={verticalListSortingStrategy}><div className="mt-5 space-y-2">{links.map((link, index) => <SortableLink key={link.id} link={link} onToggle={() => toggleLink(link)} onRemove={() => removeLink(link)} onEdit={(title, url) => editLink(link, title, url)} onMove={(direction) => { const destination = index + direction; if (destination < 0 || destination >= links.length) return; reorder(arrayMove(links, index, destination)); }} canMoveUp={index > 0} canMoveDown={index < links.length - 1} />)}</div></SortableContext>
    </DndContext>
    <form className="mt-6 rounded-2xl border border-dashed border-black/20 bg-[#fcfbf8] p-4 sm:p-5" onSubmit={addLink}>
      <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-semibold">Add a link</p><p className="mt-1 text-xs text-black/50">Pick a place people can find or reach you.</p></div><ProviderPicker mode={mode} onSelect={(provider) => { setNewProvider(provider); setNewTitle(provider.defaultLabel); setNewValue(""); }} selectedProviderId={newProvider?.id} /></div>
      {newProvider && <>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1.5 text-xs font-semibold">Link label <input aria-label="Link label" className="min-h-12 rounded-xl border border-black/15 bg-white px-3 text-base font-normal outline-none focus:border-black" maxLength={60} onChange={(event) => setNewTitle(event.target.value)} value={newTitle} /></label>
          <label className="grid gap-1.5 text-xs font-semibold">{valueLabel}<input aria-describedby={normalizedValue && !normalizedValue.ok && newValue ? "new-link-error" : undefined} aria-label="Link value" autoComplete="url" className="min-h-12 rounded-xl border border-black/15 bg-white px-3 text-base font-normal outline-none focus:border-black" maxLength={2048} onChange={(event) => setNewValue(event.target.value)} placeholder={newProvider.placeholder} type="text" value={newValue} /></label>
        </div>
        {newProvider.instructions && <p className="mt-2 text-xs leading-5 text-black/55">{newProvider.instructions}</p>}
        {normalizedValue?.ok && newValue.trim() && <p className="mt-2 text-xs text-black/55">Preview <span aria-hidden="true">→</span> <span className="font-medium text-black/75">{normalizedValue.data.displayValue}</span></p>}
        {normalizedValue && !normalizedValue.ok && newValue.trim() && <p className="mt-2 text-xs text-[#a5231e]" id="new-link-error" role="alert">{normalizedValue.message}</p>}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><p className="text-[11px] text-black/45">Visible on your public profile</p><button className="min-h-12 rounded-full px-6 text-sm font-semibold" disabled={Boolean(newValue.trim() && normalizedValue && !normalizedValue.ok)} style={{ backgroundColor: coral }} type="submit">Add {newProvider.name}</button></div>
      </>}
    </form>
    <p className="mt-3 text-[11px] text-black/45">Drag to reorder · Hidden links stay available here</p>
  </div>;
}

function SortableLink({ link, onToggle, onRemove, onEdit, onMove, canMoveUp, canMoveDown }: { link: ProfileLink; onToggle: () => void; onRemove: () => void; onEdit: (title: string, url: string) => void; onMove: (direction: -1 | 1) => void; canMoveUp: boolean; canMoveDown: boolean }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(link.title);
  const provider = providerForLink(link.link_type);
  const normalized = resolveStoredLink(provider.id, link.url);
  const [value, setValue] = useState(normalized?.canonicalValue ?? link.url);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: link.id });
  return <div className={`flex flex-wrap items-center gap-2 rounded-2xl border border-black/10 bg-white p-2 ${isDragging ? "opacity-60" : ""}`} ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }}>
    <button aria-label={`Drag ${link.title}`} className="min-h-11 min-w-11 rounded-xl text-lg text-black/45 focus-visible:outline-2" type="button" {...attributes} {...listeners}>⠿</button>
    <ProviderMark className="size-8 rounded-lg" icon={provider.icon} label={provider.name} />
    {editing ? <div className="grid min-w-[180px] flex-1 gap-2 sm:grid-cols-2"><label className="grid gap-1 text-[10px] font-semibold text-black/55">Label<input aria-label="Edit link label" className="min-h-11 rounded-lg border border-black/15 px-3 text-base text-black" maxLength={60} onChange={(event) => setTitle(event.target.value)} value={title} /></label><label className="grid gap-1 text-[10px] font-semibold text-black/55">{provider.inputKind === "email" ? "Email address" : provider.inputKind === "phone" ? "Phone number" : provider.inputKind === "handle" || provider.inputKind === "username" ? "Username or profile link" : "Link or URL"}<input aria-label="Edit link value" className="min-h-11 rounded-lg border border-black/15 px-3 text-base text-black" maxLength={2048} onChange={(event) => setValue(event.target.value)} placeholder={provider.placeholder} value={value} /></label></div> : <div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-black/45">{provider.name}</p><p className="truncate text-sm font-semibold">{link.title}</p><p className="truncate text-xs text-black/45">{normalized?.displayValue ?? "Saved link"}</p></div>}
    <span className={`hidden text-[10px] font-semibold sm:inline ${link.is_visible ? "text-emerald-800" : "text-black/40"}`}>{link.is_visible ? "VISIBLE" : "HIDDEN"}</span>
    <button aria-label={`Move ${link.title} up`} className="min-h-11 rounded-xl px-2 text-xs font-semibold disabled:text-black/20" disabled={!canMoveUp} onClick={() => onMove(-1)} type="button">↑</button>
    <button aria-label={`Move ${link.title} down`} className="min-h-11 rounded-xl px-2 text-xs font-semibold disabled:text-black/20" disabled={!canMoveDown} onClick={() => onMove(1)} type="button">↓</button>
    {editing ? <button className="min-h-11 rounded-xl px-3 text-xs font-semibold" onClick={() => { onEdit(title, value); setEditing(false); }} type="button">Save</button> : <button aria-label={`Edit ${link.title}`} className="min-h-11 rounded-xl px-3 text-xs font-semibold underline underline-offset-4" onClick={() => setEditing(true)} type="button">Edit</button>}
    <button aria-label={`${link.is_visible ? "Hide" : "Show"} ${link.title}`} aria-pressed={link.is_visible} className="min-h-11 rounded-xl px-3 text-xs font-semibold underline underline-offset-4" onClick={onToggle} type="button">{link.is_visible ? "Hide" : "Show"}</button>
    <button aria-label={`Delete ${link.title}`} className="min-h-11 rounded-xl px-2 text-xs font-semibold text-black/45 hover:text-red-700" onClick={onRemove} type="button">Delete</button>
  </div>;
}

export function AppearanceSection({ mode, onChange, unlockedRewards, selectedRewards, onEquip }: { mode: ProfileMode; onChange: (updates: Partial<ProfileMode>) => void; unlockedRewards: string[]; selectedRewards: Partial<Record<RewardCategory, string>>; onEquip: (category: RewardCategory, rewardId: string) => void }) {
  return <div><SectionHeading eyebrow="03 · APPEARANCE" title="Set the feeling." description="A few expressive choices, curated for Setuvara." />
    <fieldset className="mt-7"><legend className="text-sm font-semibold">Theme</legend><div className="mt-2 grid grid-cols-3 gap-2">{(["light", "dark", "editorial"] as const).map((theme) => <button aria-pressed={mode.appearance.theme === theme} className={`min-h-12 rounded-xl border text-sm font-semibold capitalize ${mode.appearance.theme === theme ? "border-black bg-[#0d0d0d] text-white" : "border-black/15"}`} key={theme} onClick={() => onChange({ appearance: { ...mode.appearance, theme } })} type="button">{theme}</button>)}</div></fieldset>
    <fieldset className="mt-7"><legend className="text-sm font-semibold">Accent</legend><div className="mt-3 flex flex-wrap gap-3">{accentOptions.map((color) => <button aria-label={`Accent ${color}`} aria-pressed={mode.appearance.accent.toLowerCase() === color.toLowerCase()} className={`size-11 rounded-full border-2 ${mode.appearance.accent.toLowerCase() === color.toLowerCase() ? "border-black ring-2 ring-black/10" : "border-white shadow-sm"}`} key={color} onClick={() => onChange({ appearance: { ...mode.appearance, accent: color } })} style={{ backgroundColor: color }} type="button" />)}</div><label className="mt-3 block text-xs font-medium text-black/55">Custom hex<input aria-label="Custom accent color" className="ml-3 min-h-10 w-32 rounded-lg border border-black/15 px-2 text-sm" onChange={(event) => { if (/^#[0-9a-f]{6}$/i.test(event.target.value)) onChange({ appearance: { ...mode.appearance, accent: event.target.value } }); }} placeholder="#FF5A4F" /></label></fieldset>
    <fieldset className="mt-7"><legend className="text-sm font-semibold">Layout</legend><div className="mt-2 grid gap-2 sm:grid-cols-2">{modeLayouts[mode.slug].map((layout) => <button aria-pressed={mode.appearance.layout === layout.value} className={`min-h-12 rounded-xl border px-3 text-sm font-semibold ${mode.appearance.layout === layout.value ? "border-black bg-[#f5f4ef]" : "border-black/15"}`} key={layout.value} onClick={() => onChange({ appearance: { ...mode.appearance, layout: layout.value } })} type="button">{layout.label}</button>)}</div></fieldset>
    <fieldset className="mt-7"><legend className="text-sm font-semibold">Image treatment</legend><div className="mt-2 grid grid-cols-3 gap-2">{(["full-bleed", "portrait", "compact"] as const).map((treatment) => <button aria-pressed={mode.appearance.imageTreatment === treatment} className={`min-h-12 rounded-xl border px-2 text-xs font-semibold capitalize ${mode.appearance.imageTreatment === treatment ? "border-black bg-[#f5f4ef]" : "border-black/15"}`} key={treatment} onClick={() => onChange({ appearance: { ...mode.appearance, imageTreatment: treatment } })} type="button">{treatment.replace("-", " ")}</button>)}</div></fieldset>
    <fieldset className="mt-7"><legend className="text-sm font-semibold">Earned identity treatments</legend><p className="mt-1 text-xs leading-5 text-black/50">Rewards unlock through real connections and stay with your identity.</p><div className="mt-3 grid gap-2">{PASSPORT_REWARDS.filter((reward) => ["profile_treatment", "accent", "profile_mark"].includes(reward.category)).map((reward) => { const unlocked = unlockedRewards.includes(reward.id); const selected = selectedRewards[reward.category] === reward.id; return <div className="flex items-center justify-between gap-3 rounded-xl border border-black/10 px-3 py-3" key={reward.id}><div><p className="text-sm font-semibold">{reward.name}</p><p className="text-xs text-black/50">{unlocked ? "Unlocked" : `Reach ${reward.milestone} Connections`}</p></div><button aria-pressed={selected} className="min-h-10 rounded-full border border-black/15 px-3 text-xs font-semibold disabled:opacity-45" disabled={!unlocked || selected} onClick={() => onEquip(reward.category, reward.id)} type="button">{selected ? "Equipped" : unlocked ? "Equip" : "Locked"}</button></div>; })}</div><Link className="mt-3 inline-flex min-h-11 items-center text-xs font-semibold underline underline-offset-4" href="/app/passport">View all Passport rewards</Link></fieldset>
  </div>;
}

export function SettingsSection({ mode, form, onDraftChange }: { mode: ProfileMode; form: ReturnType<typeof useForm<SettingsFormValues>>; onDraftChange: () => void }) {
  const fields: Record<ModeSlug, { key: string; label: string; placeholder: string; multiline?: boolean }[]> = {
    personal: [{ key: "note", label: "A little more about you", placeholder: "What are you into lately?", multiline: true }, { key: "location", label: "Location", placeholder: "Berlin" }, { key: "pronouns", label: "Pronouns", placeholder: "they / them" }],
    event: [{ key: "eventName", label: "Event name", placeholder: "Slush" }, { key: "city", label: "City", placeholder: "Helsinki" }, { key: "countryCode", label: "Country code (ISO 2-letter)", placeholder: "FI" }, { key: "dateLabel", label: "Dates", placeholder: "20–21 Nov 2026" }, { key: "role", label: "Your role / project", placeholder: "Founder · Northlight" }, { key: "hereToMeet", label: "Here to meet", placeholder: "Product designers and early-stage operators", multiline: true }],
    business: [{ key: "role", label: "Role", placeholder: "Head of Sales" }, { key: "company", label: "Company", placeholder: "Lumen Labs" }, { key: "city", label: "City", placeholder: "Berlin" }, { key: "description", label: "What you do", placeholder: "A short business introduction", multiline: true }],
  };
  return <div onChange={onDraftChange}><SectionHeading eyebrow="04 · MODE SETTINGS" title={mode.slug === "event" ? "Put the moment in context." : mode.slug === "business" ? "Show how you work." : "Share a little more."} description={mode.slug === "personal" ? "These details belong to Personal Mode only." : "Each Mode keeps its own details and privacy."} />
    <div className="mt-6 space-y-4">{fields[mode.slug].map((field) => <label className="block space-y-2 text-sm font-medium" key={field.key}>{field.label}{field.multiline ? <textarea className="min-h-24 w-full rounded-2xl border border-black/15 px-4 py-3 text-base font-normal outline-none focus:border-black" maxLength={280} placeholder={field.placeholder} {...form.register(field.key)} /> : <input className="min-h-12 w-full rounded-2xl border border-black/15 px-4 text-base font-normal outline-none focus:border-black" autoCapitalize={field.key === "countryCode" ? "characters" : undefined} maxLength={field.key === "countryCode" ? 2 : field.key === "contactEmail" ? 254 : 100} placeholder={field.placeholder} {...form.register(field.key, field.key === "countryCode" ? { onChange: (event) => form.setValue(field.key, event.target.value.toUpperCase(), { shouldDirty: true }) } : undefined)} />}</label>)}
      {mode.slug === "business" && <p className="rounded-xl bg-[#f5f4ef] px-4 py-3 text-xs leading-5 text-black/60">Keep contact details in Links. You can hide any email or booking link without exposing it in your public Mode settings.</p>}
    </div>
  </div>;
}

export function ShareSection({ profile, mode, url, unlockedRewards, selectedRewards, onEquip }: { profile: ProfileIdentity; mode: ProfileMode; url: string; unlockedRewards: string[]; selectedRewards: Partial<Record<RewardCategory, string>>; onEquip: (category: RewardCategory, rewardId: string) => void }) {
  const [copied, setCopied] = useState(false);
  const [full, setFull] = useState(false);
  const linkUrl = `${url}&source=link`;
  const qrUrl = `${url}&source=qr`;
  const nativeShareUrl = `${url}&source=share`;
  async function share() {
    try {
      if (navigator.share) await navigator.share({ title: `${profile.display_name} · ${mode.label} Mode`, url: nativeShareUrl });
      else { await copyToClipboard(linkUrl); setCopied(true); }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) setCopied(false);
    }
  }
  return <div><SectionHeading eyebrow="05 · SHARE" title="Meet them where you are." description="Your Mode has its own link and QR. Pick the right one for this moment." />
    <div className="mt-6 flex items-center gap-3"><div className="grid size-12 place-items-center rounded-2xl bg-[#0d0d0d] text-sm font-bold text-white">{profile.display_name.slice(0, 1).toUpperCase()}</div><div><p className="font-semibold">{profile.display_name}</p><p className="text-xs text-black/55">{mode.label} Mode{mode.slug === "event" && mode.settings.eventName ? ` · ${mode.settings.eventName}` : ""}</p></div></div>
    <div className={`mt-6 grid justify-center rounded-[1.7rem] p-6 ${selectedRewards.share_treatment === "signal_share" || selectedRewards.share_treatment === "network_share" ? "bg-[#0d0d0d] text-white" : "bg-[#f5f4ef]"}`}><div className={`rounded-2xl bg-white p-4 ${selectedRewards.qr_frame === "coral_qr_frame" ? "outline outline-4 outline-[#ff5a4f] outline-offset-2" : ""}`}><QRCodeSVG aria-label={`${mode.label} Mode QR code`} bgColor="#ffffff" fgColor="#0d0d0d" level="Q" marginSize={4} size={220} value={qrUrl} /></div></div>
    <div className="mt-4 space-y-2">{(["share_treatment", "qr_frame"] as const).map((category) => <label className="block text-xs font-semibold" key={category}>{category === "qr_frame" ? "QR frame" : "Share treatment"}<select className="mt-1 min-h-11 w-full rounded-xl border border-black/15 bg-white px-3 text-sm" onChange={(event) => { if (event.target.value) onEquip(category, event.target.value); }} value={selectedRewards[category] ?? ""}><option value="">Setuvara default</option>{PASSPORT_REWARDS.filter((reward) => reward.category === category).map((reward) => <option disabled={!unlockedRewards.includes(reward.id)} key={reward.id} value={reward.id}>{reward.name}{unlockedRewards.includes(reward.id) ? " · Unlocked" : ` · Reach ${reward.milestone}`}</option>)}</select></label>)}</div>
    <p className="mt-4 break-all rounded-xl bg-black/[0.03] px-4 py-3 text-center text-xs font-medium">{linkUrl.replace(/^https?:\/\//, "")}</p>
    <div className="mt-4 grid grid-cols-2 gap-2"><button className="min-h-12 rounded-full bg-[#0d0d0d] text-sm font-semibold text-white" onClick={async () => { const result = await copyToClipboard(linkUrl); setCopied(result); }} type="button">{copied ? "Copied" : "Copy link"}</button><button className="min-h-12 rounded-full px-4 text-sm font-semibold" onClick={() => void share()} style={{ backgroundColor: coral }} type="button">Share</button></div>
    <button className="mt-3 min-h-11 w-full rounded-full border border-black/15 text-sm font-semibold" onClick={() => setFull(true)} type="button">Full-screen QR</button>
    {full && <div className={`fixed inset-0 z-[60] flex flex-col items-center justify-center px-6 text-center ${selectedRewards.share_treatment === "signal_share" || selectedRewards.share_treatment === "network_share" ? "bg-[#0d0d0d] text-white" : "bg-[#f5f4ef] text-[#0d0d0d]"}`}><div className="mb-5 text-xs font-bold tracking-[0.2em]">{profile.display_name.toUpperCase()}<br /><span className={`mt-2 inline-block ${selectedRewards.share_treatment === "signal_share" || selectedRewards.share_treatment === "network_share" ? "text-white/55" : "text-black/55"}`}>{mode.label.toUpperCase()}{mode.slug === "event" && mode.settings.eventName ? ` · ${String(mode.settings.eventName).toUpperCase()}` : ""}</span></div><div className={`rounded-[2rem] bg-white p-5 shadow-[0_25px_70px_-40px_rgba(13,13,13,.5)] ${selectedRewards.qr_frame === "coral_qr_frame" ? "outline outline-4 outline-[#ff5a4f] outline-offset-2" : ""}`}><QRCodeSVG aria-label={`${mode.label} Mode share code`} bgColor="#ffffff" fgColor="#0d0d0d" level="Q" marginSize={4} size={Math.min(320, typeof window === "undefined" ? 320 : window.innerWidth - 80)} value={qrUrl} /></div><p className="mt-6 text-sm font-medium">Scan to open my Setuvara</p><p className={`mt-2 text-xs ${selectedRewards.share_treatment === "signal_share" || selectedRewards.share_treatment === "network_share" ? "text-white/50" : "text-black/50"}`}>setuvara.com/{profile.username}</p><div className="mt-5 flex gap-3"><button className="min-h-12 rounded-full border border-current/20 px-5 text-sm font-semibold" onClick={async () => { setCopied(await copyToClipboard(linkUrl)); }} type="button">Copy link</button><button className="min-h-12 rounded-full px-5 text-sm font-semibold text-[#0d0d0d]" onClick={() => setFull(false)} style={{ backgroundColor: coral }} type="button">Done</button></div></div>}
  </div>;
}

export function CropDialog({ source, crop, setCrop, zoom, setZoom, onCropComplete, onCancel, onApply }: { source: string; crop: { x: number; y: number }; setCrop: (crop: { x: number; y: number }) => void; zoom: number; setZoom: (value: number) => void; onCropComplete: (area: unknown, pixels: { x: number; y: number; width: number; height: number }) => void; onCancel: () => void; onApply: () => void }) {
  return <div aria-label="Crop profile image" aria-modal="true" className="fixed inset-0 z-[70] grid place-items-center bg-black/70 p-4" role="dialog"><div className="w-full max-w-xl rounded-3xl bg-[#f5f4ef] p-4 sm:p-6"><h2 className="mb-3 text-lg font-semibold">Crop your photo</h2><div className="relative h-[min(60vh,420px)] overflow-hidden rounded-2xl bg-black"><Cropper image={source} crop={crop} zoom={zoom} aspect={4 / 5} onCropChange={setCrop} onZoomChange={setZoom} onCropComplete={onCropComplete} /></div><label className="mt-4 block text-xs font-semibold">Zoom<input aria-label="Photo zoom" className="mt-2 block w-full accent-[#ff5a4f]" max="3" min="1" onChange={(event) => setZoom(Number(event.target.value))} step="0.05" type="range" value={zoom} /></label><div className="mt-4 flex justify-end gap-2"><button className="min-h-11 rounded-full px-4 text-sm font-semibold" onClick={onCancel} type="button">Cancel</button><button className="min-h-11 rounded-full px-5 text-sm font-semibold" onClick={onApply} style={{ backgroundColor: coral }} type="button">Use photo</button></div></div></div>;
}

function SectionHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return <header><p className="text-[10px] font-bold tracking-[0.2em] text-black/45">{eyebrow}</p><h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em]">{title}</h2><p className="mt-2 max-w-lg text-sm leading-6 text-black/55">{description}</p></header>;
}

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return <label className="block space-y-2 text-sm font-medium">{label}{children}{error && <span className="block text-xs text-red-800">{error}</span>}</label>;
}

export function dataUrlToBlob(dataUrl: string) {
  const [metadata, data] = dataUrl.split(",");
  const mime = metadata.match(/:(.*?);/)?.[1] ?? "image/webp";
  const binary = atob(data);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new Blob([bytes], { type: mime });
}

async function copyToClipboard(value: string) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
    const input = document.createElement("textarea");
    input.value = value;
    input.setAttribute("readonly", "");
    input.style.position = "fixed";
    input.style.opacity = "0";
    document.body.append(input);
    input.select();
    const copied = document.execCommand("copy");
    input.remove();
    return copied;
  } catch {
    return false;
  }
}

export async function cropImage(source: string, crop: { x: number; y: number; width: number; height: number }) {
  const image = new window.Image();
  image.src = source;
  await image.decode();
  const canvas = document.createElement("canvas");
  canvas.width = crop.width; canvas.height = crop.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not prepare image crop");
  context.drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, crop.width, crop.height);
  return canvas.toDataURL("image/webp", 0.88);
}
