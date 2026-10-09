"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Cropper from "react-easy-crop";
import { QRCodeSVG } from "qrcode.react";
import Link from "next/link";
import NextImage from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import { ProfileRenderer } from "@/components/profile/profile-renderer";
import type { ModeAppearance, ModeSlug, ProfileIdentity, ProfileLink, ProfileMode } from "@/components/profile/types";
import { createClient } from "@/lib/supabase/client";

const coral = "#FF5A4F";
const accentOptions = [coral, "#C7FF4A", "#AFCBFF", "#E8A6FF", "#F5C66E"];
const modeLayouts: Record<ModeSlug, { value: string; label: string }[]> = {
  personal: [{ value: "full-bleed", label: "Full Bleed" }, { value: "portrait-editorial", label: "Portrait Editorial" }],
  event: [{ value: "event-poster", label: "Event Poster" }, { value: "conference-card", label: "Conference Card" }],
  business: [{ value: "structured", label: "Structured" }, { value: "editorial-business", label: "Editorial Business" }],
};
const profileSchema = z.object({
  username: z.string().trim().regex(/^[a-z0-9_]{3,24}$/, "Use 3–24 lowercase letters, numbers, or underscores."),
  display_name: z.string().trim().min(1).max(80),
  bio: z.string().max(280),
});
const settingsSchema = z.record(z.string(), z.union([z.string().max(280), z.boolean()]));
const modeSettingsSchemas: Record<ModeSlug, z.ZodType<Record<string, string | boolean>>> = {
  personal: z.object({ note: z.string().max(280).optional(), location: z.string().max(80).optional(), pronouns: z.string().max(40).optional() }).strict(),
  event: z.object({ eventName: z.string().max(100).optional(), city: z.string().max(80).optional(), dateLabel: z.string().max(80).optional(), role: z.string().max(80).optional(), hereToMeet: z.string().max(280).optional() }).strict(),
  business: z.object({ role: z.string().max(80).optional(), company: z.string().max(100).optional(), city: z.string().max(80).optional(), description: z.string().max(280).optional() }).strict(),
};
type ProfileFormValues = z.infer<typeof profileSchema>;
type SettingsFormValues = z.infer<typeof settingsSchema>;

type EditorProps = {
  initialProfile: ProfileIdentity;
  initialModes: ProfileMode[];
  initialMode: ModeSlug;
  initialSection: string;
  publicOrigin: string;
  error?: string;
  saved?: string;
  signOut: () => Promise<void>;
};

const sections = [
  { id: "profile", title: "Profile", detail: "Your identity, everywhere" },
  { id: "links", title: "Links", detail: "The ways people reach you" },
  { id: "appearance", title: "Appearance", detail: "Make this Mode feel right" },
  { id: "settings", title: "Mode settings", detail: "Context for this version" },
  { id: "share", title: "Share", detail: "Ready for the moment" },
] as const;

const errorCopy: Record<string, string> = {
  invalid_username: "That username cannot be used. Choose 3–24 lowercase letters, numbers, or underscores.",
  username_taken: "That username is already in use.",
  save_failed: "Your profile could not be saved. Please try again.",
  invalid_identity: "Check the name and bio and try again.",
  invalid_link: "Add a link title and a safe HTTP or HTTPS address.",
  link_failed: "That link change could not be saved.",
  mode_failed: "Some Mode details are invalid. Review them and try again.",
  publish_failed: "Your publishing status could not be changed.",
};

export function IdentityEditor({ initialProfile, initialModes, initialMode, initialSection, publicOrigin, error, saved, signOut }: EditorProps) {
  const router = useRouter();
  const [profile, setProfile] = useState(initialProfile);
  const [modes, setModes] = useState(initialModes);
  const [activeSlug, setActiveSlug] = useState<ModeSlug>(initialMode);
  const [section, setSection] = useState(sections.some((item) => item.id === initialSection) ? initialSection : "profile");
  const [previewVisitor, setPreviewVisitor] = useState(true);
  const [fullPreview, setFullPreview] = useState(false);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [appearanceDirty, setAppearanceDirty] = useState(false);
  const [message, setMessage] = useState(saved ? savedMessage(saved) : "");
  const [newTitle, setNewTitle] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newType, setNewType] = useState("url");
  const [cropSource, setCropSource] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedPixels, setCroppedPixels] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const activeMode = useMemo(() => modes.find((mode) => mode.slug === activeSlug) ?? modes[0], [activeSlug, modes]);
  const profileForm = useForm<ProfileFormValues>({ resolver: zodResolver(profileSchema), values: profile });
  const settingsForm = useForm<SettingsFormValues>({ resolver: zodResolver(settingsSchema), values: activeMode?.settings ?? {} });
  const settingsWatch = useWatch({ control: settingsForm.control });
  const profileWatch = useWatch({ control: profileForm.control });
  const previewProfile = { ...profile, ...profileWatch };
  const previewSettings = Object.fromEntries(Object.entries(settingsWatch).filter((entry): entry is [string, string | boolean] => entry[1] !== undefined));
  const previewMode = activeMode ? { ...activeMode, settings: previewSettings } : activeMode;
  const hasUnsavedChanges = appearanceDirty || profileForm.formState.isDirty || settingsForm.formState.isDirty;

  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const warnBeforeExit = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warnBeforeExit);
    return () => window.removeEventListener("beforeunload", warnBeforeExit);
  }, [hasUnsavedChanges]);

  function navigateTo(nextMode = activeSlug, nextSection = section) {
    if (activeMode && nextMode !== activeSlug) {
      const currentSettings = Object.fromEntries(Object.entries(settingsForm.getValues()).filter((entry): entry is [string, string | boolean] => entry[1] !== undefined));
      setModes((current) => current.map((mode) => mode.id === activeMode.id ? { ...mode, settings: currentSettings } : mode));
    }
    setActiveSlug(nextMode);
    setSection(nextSection);
    const query = new URLSearchParams({ mode: nextMode, section: nextSection });
    router.replace(`/app/identity?${query.toString()}`, { scroll: false });
    setMessage("");
    setStatus("idle");
  }

  function updateMode(updates: Partial<ProfileMode>) {
    if (!activeMode) return;
    setModes((current) => current.map((mode) => mode.id === activeMode.id ? { ...mode, ...updates } : mode));
    setStatus("idle");
  }

  async function saveProfile(values = profileForm.getValues()) {
    const parsed = profileSchema.safeParse(values);
    if (!parsed.success) {
      setMessage(parsed.error.issues[0]?.message ?? "Check your profile details.");
      setStatus("error");
      return false;
    }
    const supabase = createClient();
    setStatus("saving");
    const { data: existing, error: readError } = await supabase.from("profiles").select("username").eq("id", profile.id).single();
    if (readError) return fail("Your profile could not be loaded.");
    if (existing.username !== parsed.data.username) {
      const { data: available, error: availabilityError } = await supabase.rpc("is_username_available", { candidate_username: parsed.data.username });
      if (availabilityError || !available) return fail(availabilityError ? "Username availability could not be checked." : "That username is already in use.");
    }
    const { error: updateError } = await supabase.from("profiles").update(parsed.data).eq("id", profile.id);
    if (updateError) return fail("Your profile could not be saved.");
    setProfile((current) => ({ ...current, ...parsed.data }));
    profileForm.reset(parsed.data);
    setStatus("saved");
    setMessage("Saved");
    router.refresh();
    return true;
  }

  async function saveMode() {
    if (!activeMode) return false;
    const mode = modes.find((item) => item.id === activeMode.id) ?? activeMode;
    const parsed = modeSettingsSchemas[mode.slug].safeParse(settingsForm.getValues());
    if (!parsed.success || !validAppearance(mode.slug, mode.appearance)) return fail("Review this Mode’s settings and appearance.");
    setStatus("saving");
    const supabase = createClient();
    const { error: updateError } = await supabase.from("profile_modes").update({ settings: parsed.data, appearance: mode.appearance }).eq("id", mode.id).eq("profile_id", profile.id);
    if (updateError) return fail("This Mode could not be saved.");
    updateMode({ settings: parsed.data });
    settingsForm.reset(parsed.data);
    setAppearanceDirty(false);
    setStatus("saved");
    setMessage("Saved");
    router.refresh();
    return true;
  }

  function fail(text: string) {
    setStatus("error");
    setMessage(text);
    return false;
  }

  async function saveCurrent() {
    if (section === "profile") await saveProfile();
    else if (["appearance", "settings"].includes(section)) await saveMode();
    else {
      setStatus("saved");
      setMessage("Saved");
    }
  }

  async function addLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeMode || !newTitle.trim()) return fail("Add a link name first.");
    let linkUrl: string;
    if (newType === "email") {
      const email = newUrl.trim().replace(/^mailto:/i, "");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail("Enter a valid email address.");
      linkUrl = `mailto:${email}`;
    } else {
      let url: URL;
      try { url = new URL(newUrl); } catch { return fail("Enter a full link beginning with https://."); }
      if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return fail("Use a safe HTTP or HTTPS link.");
      linkUrl = url.toString();
    }
    const next = [...activeMode.links, { id: crypto.randomUUID(), title: newTitle.trim(), url: linkUrl, link_type: newType, is_visible: true, sort_order: activeMode.links.length }];
    const { error: insertError } = await createClient().from("profile_links").insert({ profile_id: profile.id, mode_id: activeMode.id, title: newTitle.trim(), url: linkUrl, link_type: newType, is_visible: true, sort_order: activeMode.links.length });
    if (insertError) return fail("The link could not be added.");
    const { data, error: selectError } = await createClient().from("profile_links").select("id, title, url, link_type, is_visible, sort_order").eq("profile_id", profile.id).eq("mode_id", activeMode.id).order("sort_order");
    if (selectError) return fail("The link was added but could not be reloaded.");
    updateMode({ links: data ?? next });
    setNewTitle(""); setNewUrl(""); setMessage("Link added"); setStatus("saved");
  }

  async function toggleLink(link: ProfileLink) {
    const visible = !link.is_visible;
    const { error: updateError } = await createClient().from("profile_links").update({ is_visible: visible }).eq("id", link.id).eq("profile_id", profile.id);
    if (updateError) return fail("Link visibility could not be updated.");
    updateMode({ links: activeMode.links.map((item) => item.id === link.id ? { ...item, is_visible: visible } : item) });
    setMessage(visible ? "Link visible" : "Link hidden"); setStatus("saved");
    router.refresh();
  }

  async function removeLink(link: ProfileLink) {
    const { error: deleteError } = await createClient().from("profile_links").delete().eq("id", link.id).eq("profile_id", profile.id);
    if (deleteError) return fail("The link could not be removed.");
    updateMode({ links: activeMode.links.filter((item) => item.id !== link.id) });
    setMessage("Link removed"); setStatus("saved");
  }

  async function editLink(link: ProfileLink, title: string, value: string) {
    if (!title.trim() || title.trim().length > 60) return fail("Link labels must be 1–60 characters.");
    let linkUrl = value.trim();
    if (link.link_type === "email") {
      const email = linkUrl.replace(/^mailto:/i, "");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail("Enter a valid email address.");
      linkUrl = `mailto:${email}`;
    } else {
      let url: URL;
      try { url = new URL(linkUrl); } catch { return fail("Enter a full link beginning with https://."); }
      if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return fail("Use a safe HTTP or HTTPS link.");
      linkUrl = url.toString();
    }
    const { error: updateError } = await createClient().from("profile_links").update({ title: title.trim(), url: linkUrl }).eq("id", link.id).eq("profile_id", profile.id);
    if (updateError) return fail("This link could not be saved.");
    updateMode({ links: activeMode.links.map((item) => item.id === link.id ? { ...item, title: title.trim(), url: linkUrl } : item) });
    setMessage("Link updated"); setStatus("saved"); router.refresh();
  }

  async function reorder(ordered: ProfileLink[]) {
    if (!activeMode) return;
    const client = createClient();
    setStatus("saving");
    for (const [index, link] of ordered.entries()) {
      const { error: orderError } = await client.from("profile_links").update({ sort_order: index }).eq("id", link.id).eq("profile_id", profile.id).eq("mode_id", activeMode.id);
      if (orderError) return fail("The new link order could not be saved.");
    }
    updateMode({ links: ordered.map((link, index) => ({ ...link, sort_order: index })) });
    setStatus("saved"); setMessage("Order saved");
  }

  async function publish(next: boolean) {
    const { error: publishError } = await createClient().from("profiles").update({ is_published: next }).eq("id", profile.id);
    if (publishError) return fail("Publishing status could not be changed.");
    setProfile((current) => ({ ...current, is_published: next }));
    setMessage(next ? "Your profile is live" : "Your profile is private"); setStatus("saved"); router.refresh();
  }

  function applyCrop(croppedImage: string) {
    const blob = dataUrlToBlob(croppedImage);
    void uploadImage(blob);
    setCropSource(null);
  }

  async function uploadImage(blob: Blob) {
    if (!activeMode) return;
    setUploading(true);
    const supabase = createClient();
    const extension = "webp";
    const path = `${profile.id}/${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await supabase.storage.from("profile-media").upload(path, blob, { contentType: "image/webp", upsert: false });
    if (uploadError) { setUploading(false); return fail("This image could not be uploaded. Use a JPEG, PNG, or WebP under 5 MB."); }
    const { error: updateError } = await supabase.from("profile_modes").update({ image_path: path }).eq("id", activeMode.id).eq("profile_id", profile.id);
    if (updateError) {
      await supabase.storage.from("profile-media").remove([path]);
      setUploading(false);
      return fail("The image uploaded but could not be attached to this Mode.");
    }
    const { data: signed } = await supabase.storage.from("profile-media").createSignedUrl(path, 3600);
    if (activeMode.image_path) await supabase.storage.from("profile-media").remove([activeMode.image_path]);
    updateMode({ image_path: path, image_url: signed?.signedUrl ?? null });
    setUploading(false); setStatus("saved"); setMessage("Photo saved"); router.refresh();
  }

  async function removeImage() {
    if (!activeMode?.image_path) return;
    const supabase = createClient();
    const oldPath = activeMode.image_path;
    const { error: updateError } = await supabase.from("profile_modes").update({ image_path: null }).eq("id", activeMode.id).eq("profile_id", profile.id);
    if (updateError) return fail("The photo could not be removed.");
    await supabase.storage.from("profile-media").remove([oldPath]);
    updateMode({ image_path: null, image_url: null }); setMessage("Photo removed"); setStatus("saved"); router.refresh();
  }

  if (!activeMode) return <main className="p-8">Your Modes are being prepared.</main>;
  const publicUrl = `${publicOrigin}/${profile.username}?mode=${activeSlug}`;
  const renderProfile = (owner: boolean) => previewMode ? <ProfileRenderer profile={previewProfile} mode={previewMode} viewerState={owner ? "owner" : "visitor_unconnected"} onShare={() => navigateTo(activeSlug, "share")} onEditMode={() => navigateTo(activeSlug, "settings")} /> : null;

  return (
    <main className="min-h-screen bg-[#f5f4ef] text-[#0d0d0d]">
      <header className="sticky top-0 z-30 border-b border-black/10 bg-[#f5f4ef]/95 backdrop-blur-sm">
        <div className="mx-auto flex min-h-16 max-w-[1500px] items-center justify-between gap-3 px-4 sm:px-6">
          <Link className="shrink-0 text-sm font-bold lowercase tracking-[0.22em]" href="/">setuvara</Link>
          <nav aria-label="Setuvara app" className="hidden items-center gap-1 sm:flex"><Link aria-current="page" className="min-h-11 rounded-full bg-black/5 px-3 py-3 text-xs font-semibold" href="/app/identity">Identity</Link><Link className="min-h-11 rounded-full px-3 py-3 text-xs font-semibold text-black/60 hover:bg-black/5" href="/app/connections">Connections</Link></nav>
          <div className="flex min-w-0 items-center gap-2 sm:gap-4">
            <span className="hidden text-xs text-black/45 sm:inline">{activeMode.label} Mode</span>
            <span aria-live="polite" className="hidden text-xs font-medium text-black/55 sm:inline">{status === "saving" ? "Saving…" : status === "error" ? "Not saved" : hasUnsavedChanges ? "Unsaved changes" : message || (profile.is_published ? "Published" : "Draft")}</span>
            <button className="min-h-11 rounded-full border border-black/15 px-3 text-xs font-semibold sm:px-4" onClick={() => { setPreviewVisitor(true); setFullPreview(true); }} type="button">Preview as visitor</button>
            <button className="min-h-11 rounded-full px-4 text-xs font-semibold text-[#0d0d0d]" onClick={() => void publish(!profile.is_published)} style={{ backgroundColor: coral }} type="button">{profile.is_published ? "Unpublish" : "Publish"}</button>
          </div>
        </div>
      </header>

      {(error || message) && <div aria-live="polite" className={`mx-auto mt-4 max-w-[1500px] px-4 text-sm sm:px-6 ${error || status === "error" ? "text-red-800" : "text-black/65"}`}>{errorCopy[error ?? ""] ?? message}</div>}

      <div className="mx-auto grid max-w-[1500px] gap-6 px-4 py-5 sm:px-6 lg:grid-cols-[180px_minmax(320px,1fr)_minmax(300px,420px)] lg:gap-8 lg:py-8">
        <aside className="hidden lg:block">
          <p className="mb-3 text-[10px] font-bold tracking-[0.2em] text-black/45">YOUR IDENTITY</p>
          <nav aria-label="Editor sections" className="space-y-1">
            {sections.map((item) => <SectionButton active={section === item.id} key={item.id} onClick={() => navigateTo(activeSlug, item.id)}>{item.title}</SectionButton>)}
          </nav>
          <button className="mt-8 min-h-11 rounded-full border border-black/15 px-4 text-xs font-semibold" onClick={() => setFullPreview(true)} type="button">Full-screen preview</button>
          <form action={signOut} className="mt-10"><button className="min-h-11 text-xs font-semibold text-black/55 underline underline-offset-4" type="submit">Sign out</button></form>
        </aside>

        <section className="min-w-0">
          <div className="mb-5 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <div><p className="text-[10px] font-bold tracking-[0.2em] text-black/45">ONE IDENTITY · THREE VERSIONS</p><h1 className="mt-2 text-2xl font-semibold tracking-[-0.04em]">Make this one yours.</h1></div>
            <div className="flex rounded-full border border-black/10 bg-white/70 p-1" role="tablist" aria-label="Profile Mode">
              {(["personal", "event", "business"] as const).map((slug) => <button aria-selected={slug === activeSlug} className={`min-h-10 rounded-full px-3 text-xs font-semibold capitalize ${slug === activeSlug ? "bg-[#0d0d0d] text-white" : "text-black/60"}`} key={slug} onClick={() => navigateTo(slug, section)} role="tab" type="button">{slug}</button>)}
            </div>
          </div>

          <div className="mb-5 flex gap-2 overflow-x-auto pb-1 lg:hidden">
            <Link className="inline-flex min-h-11 shrink-0 items-center rounded-full border border-black/10 bg-white/60 px-4 text-xs font-semibold" href="/app/connections">Connections</Link>
            {sections.map((item) => <button className={`min-h-11 shrink-0 rounded-full px-4 text-xs font-semibold ${section === item.id ? "bg-[#0d0d0d] text-white" : "border border-black/10 bg-white/60"}`} key={item.id} onClick={() => navigateTo(activeSlug, item.id)} type="button">{item.title}</button>)}
          </div>

          <div className="rounded-[1.7rem] border border-black/10 bg-white p-5 sm:p-7">
            {section === "profile" && <ProfileSection profile={profile} form={profileForm} mode={activeMode} onPhoto={() => fileRef.current?.click()} onRemovePhoto={() => void removeImage()} onSave={() => void saveProfile()} />}
            {section === "links" && <LinksSection links={activeMode.links} newTitle={newTitle} newUrl={newUrl} newType={newType} setNewTitle={setNewTitle} setNewUrl={setNewUrl} setNewType={setNewType} addLink={addLink} toggleLink={toggleLink} removeLink={removeLink} editLink={editLink} reorder={reorder} />}
            {section === "appearance" && <AppearanceSection mode={activeMode} onChange={(updates) => { updateMode(updates); setAppearanceDirty(true); }} />}
            {section === "settings" && <SettingsSection mode={activeMode} form={settingsForm} />}
            {section === "share" && <ShareSection profile={profile} mode={activeMode} url={publicUrl} />}
            {section !== "links" && section !== "share" && <button className="mt-7 min-h-12 rounded-full px-6 text-sm font-semibold" onClick={() => void saveCurrent()} style={{ backgroundColor: coral }} type="button">{status === "saving" ? "Saving…" : "Save changes"}</button>}
          </div>
          <p className="mt-4 text-center text-[11px] text-black/40 lg:hidden">{status === "saving" ? "Saving…" : message || "Your changes are saved when you choose Save changes."}</p>
        </section>

        <aside className="hidden lg:block">
          <div className="mb-3 flex items-center justify-between"><p className="text-[10px] font-bold tracking-[0.2em] text-black/45">LIVE PREVIEW</p><button className="min-h-10 rounded-full px-3 text-[11px] font-semibold" onClick={() => setPreviewVisitor((value) => !value)} type="button">{previewVisitor ? "Visitor view" : "Owner view"}</button></div>
          <div className="mx-auto max-w-[340px] rounded-[2.5rem] border-[7px] border-[#0d0d0d] bg-[#0d0d0d] p-1 shadow-[0_30px_90px_-40px_rgba(13,13,13,.6)]"><div className="max-h-[calc(100vh-150px)] overflow-y-auto rounded-[2rem] bg-white p-3">{renderProfile(!previewVisitor)}</div></div>
        </aside>
      </div>

      <footer className="mx-auto flex max-w-[1500px] items-center justify-between px-4 pb-6 text-[11px] text-black/40 sm:px-6"><span>{activeMode.label} · {profile.is_published ? "Live" : "Draft"}</span><div className="flex items-center gap-4"><a className="min-h-11 py-3 font-semibold underline underline-offset-4" href={`/${profile.username}?mode=${activeSlug}`} target="_blank">Open public URL</a><form action={signOut}><button className="min-h-11 py-3 text-xs font-semibold underline underline-offset-4 lg:hidden" type="submit">Sign out</button></form></div></footer>

      <input accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; if (!file) return; if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) { fail("Choose a JPEG, PNG, or WebP image."); return; } if (file.size > 5 * 1024 * 1024) { fail("Images must be smaller than 5 MB."); return; } setCropSource(URL.createObjectURL(file)); }} ref={fileRef} type="file" />
      {cropSource && <CropDialog source={cropSource} crop={crop} setCrop={setCrop} zoom={zoom} setZoom={setZoom} onCropComplete={(_, pixels) => setCroppedPixels(pixels)} onCancel={() => { URL.revokeObjectURL(cropSource); setCropSource(null); }} onApply={async () => { if (!croppedPixels) return; const cropped = await cropImage(cropSource, croppedPixels); applyCrop(cropped); URL.revokeObjectURL(cropSource); }} />}
      {uploading && <div aria-live="polite" className="fixed inset-0 z-50 grid place-items-center bg-black/35"><p className="rounded-full bg-white px-6 py-4 text-sm font-semibold">Saving photo…</p></div>}
      {fullPreview && <div className="fixed inset-0 z-50 flex flex-col bg-[#f5f4ef] px-4 py-5 sm:px-8"><div className="mb-3 flex justify-between"><span className="text-xs font-bold tracking-[0.2em]">PREVIEW · {previewVisitor ? "VISITOR" : "OWNER"}</span><button className="min-h-11 rounded-full border border-black/20 px-4 text-xs font-semibold" onClick={() => setFullPreview(false)} type="button">Close preview</button></div><div className="mx-auto flex w-full max-w-sm flex-1 items-center overflow-y-auto py-2">{renderProfile(!previewVisitor)}</div><div className="mx-auto mt-3 flex w-full max-w-sm justify-center gap-2"><button className="min-h-11 rounded-full border border-black/20 px-4 text-xs font-semibold" onClick={() => setPreviewVisitor((value) => !value)} type="button">{previewVisitor ? "Switch to owner" : "Preview as visitor"}</button><a className="inline-flex min-h-11 items-center rounded-full px-4 text-xs font-semibold" href={`/${profile.username}?mode=${activeSlug}`} target="_blank" style={{ backgroundColor: coral }}>Open profile</a></div></div>}
    </main>
  );
}

function savedMessage(saved: string) {
  const messages: Record<string, string> = { identity: "Identity saved", link: "Link added", link_removed: "Link removed", link_visibility: "Link visibility updated", published: "Your profile is live", unpublished: "Your profile is private", mode: "Mode saved", links_ordered: "Link order saved" };
  return messages[saved] ?? "";
}

function validAppearance(slug: ModeSlug, appearance: ModeAppearance) {
  return ["light", "dark", "editorial"].includes(appearance.theme) && /^#[\da-f]{6}$/i.test(appearance.accent) && modeLayouts[slug].some((layout) => layout.value === appearance.layout) && ["full-bleed", "portrait", "compact"].includes(appearance.imageTreatment);
}

function SectionButton({ active, children, onClick }: { active: boolean; children: ReactNode; onClick: () => void }) {
  return <button className={`flex min-h-12 w-full items-center rounded-xl px-4 text-left text-sm font-semibold ${active ? "bg-[#0d0d0d] text-white" : "text-black/65 hover:bg-black/5"}`} onClick={onClick} type="button">{children}</button>;
}

function ProfileSection({ profile, form, mode, onPhoto, onRemovePhoto, onSave }: { profile: ProfileIdentity; form: ReturnType<typeof useForm<ProfileFormValues>>; mode: ProfileMode; onPhoto: () => void; onRemovePhoto: () => void; onSave: () => void }) {
  const { register, formState: { errors } } = form;
  return <div><SectionHeading eyebrow="01 · PROFILE" title="Start with you." description="One person, at the center of every Mode." />
    <div className="mt-6 flex flex-wrap items-center gap-4"><div className="relative grid size-20 place-items-center overflow-hidden rounded-[1.5rem] bg-[#f5f4ef] text-2xl font-semibold">{mode.image_url ? <NextImage alt={`${profile.display_name} profile`} className="object-cover" fill sizes="80px" src={mode.image_url} unoptimized /> : profile.display_name.slice(0, 1).toUpperCase()}</div><div><p className="font-semibold">A photo that feels like you</p><p className="mt-1 text-xs text-black/50">JPEG, PNG, or WebP · up to 5 MB</p><div className="mt-2 flex gap-2"><button className="min-h-11 rounded-full border border-black/15 px-4 text-xs font-semibold" onClick={onPhoto} type="button">{mode.image_path ? "Replace photo" : "Add a photo"}</button>{mode.image_path && <button className="min-h-11 px-3 text-xs font-semibold text-black/55 underline underline-offset-4" onClick={onRemovePhoto} type="button">Remove</button>}</div></div></div>
    <div className="mt-7 space-y-5"><Field label="Username" error={errors.username?.message}><div className="flex items-center rounded-2xl border border-black/15 px-4 focus-within:border-black"><span className="text-black/40">@</span><input className="min-h-12 w-full px-2 text-base outline-none" {...register("username")} /></div></Field><Field label="Display name" error={errors.display_name?.message}><input className="min-h-12 w-full rounded-2xl border border-black/15 px-4 text-base outline-none focus:border-black" maxLength={80} {...register("display_name")} /></Field><Field label="Personal bio" error={errors.bio?.message}><textarea className="min-h-28 w-full resize-y rounded-2xl border border-black/15 px-4 py-3 text-base outline-none focus:border-black" maxLength={280} placeholder="A few honest words about you" {...register("bio")} /></Field></div>
    <button className="mt-5 min-h-11 text-xs font-semibold underline underline-offset-4" onClick={onSave} type="button">Save identity details</button>
  </div>;
}

function LinksSection({ links, newTitle, newUrl, newType, setNewTitle, setNewUrl, setNewType, addLink, toggleLink, removeLink, editLink, reorder }: { links: ProfileLink[]; newTitle: string; newUrl: string; newType: string; setNewTitle: (value: string) => void; setNewUrl: (value: string) => void; setNewType: (value: string) => void; addLink: (event: FormEvent<HTMLFormElement>) => void; toggleLink: (link: ProfileLink) => void; removeLink: (link: ProfileLink) => void; editLink: (link: ProfileLink, title: string, url: string) => void; reorder: (links: ProfileLink[]) => void }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  return <div><SectionHeading eyebrow="02 · LINKS" title="Give people a next step." description="Keep each Mode focused on what matters in that moment." />
    {!links.length && <div className="mt-6 rounded-2xl bg-[#f5f4ef] p-5"><p className="font-semibold">No links yet</p><p className="mt-1 text-sm text-black/55">Add the first way people can reach you.</p></div>}
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={({ active, over }) => { if (!over || active.id === over.id) return; const from = links.findIndex((item) => item.id === active.id); const to = links.findIndex((item) => item.id === over.id); reorder(arrayMove(links, from, to)); }}>
      <SortableContext items={links.map((link) => link.id)} strategy={verticalListSortingStrategy}><div className="mt-5 space-y-2">{links.map((link, index) => <SortableLink key={link.id} link={link} onToggle={() => toggleLink(link)} onRemove={() => removeLink(link)} onEdit={(title, url) => editLink(link, title, url)} onMove={(direction) => { const destination = index + direction; if (destination < 0 || destination >= links.length) return; reorder(arrayMove(links, index, destination)); }} canMoveUp={index > 0} canMoveDown={index < links.length - 1} />)}</div></SortableContext>
    </DndContext>
    <form className="mt-6 rounded-2xl border border-dashed border-black/20 p-4" onSubmit={addLink}><p className="mb-3 text-sm font-semibold">Add a link</p><div className="grid gap-3 sm:grid-cols-2"><input aria-label="Link label" className="min-h-12 rounded-xl border border-black/15 px-3 text-base" maxLength={60} onChange={(event) => setNewTitle(event.target.value)} placeholder="Label · LinkedIn" value={newTitle} /><input aria-label="Link URL" className="min-h-12 rounded-xl border border-black/15 px-3 text-base" onChange={(event) => setNewUrl(event.target.value)} placeholder={newType === "email" ? "hello@example.com" : "https://…"} type={newType === "email" ? "text" : "url"} value={newUrl} /></div><div className="mt-3 flex flex-wrap items-center justify-between gap-3"><select aria-label="Link type" className="min-h-11 rounded-xl border border-black/15 px-3 text-sm" onChange={(event) => setNewType(event.target.value)} value={newType}>{[["url", "Website"], ["instagram", "Instagram"], ["linkedin", "LinkedIn"], ["spotify", "Spotify"], ["whatsapp", "WhatsApp"], ["email", "Email"], ["calendar", "Calendar"], ["document", "Document / company"]].map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><button className="min-h-11 rounded-full px-5 text-xs font-semibold" style={{ backgroundColor: coral }} type="submit">Add link</button></div></form>
    <p className="mt-3 text-[11px] text-black/45">Drag to reorder · Hidden links stay available here</p>
  </div>;
}

function SortableLink({ link, onToggle, onRemove, onEdit, onMove, canMoveUp, canMoveDown }: { link: ProfileLink; onToggle: () => void; onRemove: () => void; onEdit: (title: string, url: string) => void; onMove: (direction: -1 | 1) => void; canMoveUp: boolean; canMoveDown: boolean }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(link.title);
  const [url, setUrl] = useState(link.url);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: link.id });
  return <div className={`flex flex-wrap items-center gap-2 rounded-2xl border border-black/10 bg-white p-2 ${isDragging ? "opacity-60" : ""}`} ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }}><button aria-label={`Drag ${link.title}`} className="min-h-11 min-w-11 rounded-xl text-lg text-black/45 focus-visible:outline-2" type="button" {...attributes} {...listeners}>⠿</button>{editing ? <div className="grid min-w-[180px] flex-1 gap-2 sm:grid-cols-2"><input aria-label="Edit link label" className="min-h-11 rounded-lg border border-black/15 px-3 text-base" onChange={(event) => setTitle(event.target.value)} value={title} /><input aria-label="Edit link URL" className="min-h-11 rounded-lg border border-black/15 px-3 text-base" onChange={(event) => setUrl(event.target.value)} value={url} /></div> : <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{link.title}</p><p className="truncate text-xs text-black/45">{link.url}</p></div>}<span className={`hidden text-[10px] font-semibold sm:inline ${link.is_visible ? "text-emerald-800" : "text-black/40"}`}>{link.is_visible ? "VISIBLE" : "HIDDEN"}</span><button aria-label={`Move ${link.title} up`} className="min-h-11 rounded-xl px-2 text-xs font-semibold disabled:text-black/20" disabled={!canMoveUp} onClick={() => onMove(-1)} type="button">↑</button><button aria-label={`Move ${link.title} down`} className="min-h-11 rounded-xl px-2 text-xs font-semibold disabled:text-black/20" disabled={!canMoveDown} onClick={() => onMove(1)} type="button">↓</button>{editing ? <button className="min-h-11 rounded-xl px-3 text-xs font-semibold" onClick={() => { onEdit(title, url); setEditing(false); }} type="button">Save</button> : <button aria-label={`Edit ${link.title}`} className="min-h-11 rounded-xl px-3 text-xs font-semibold underline underline-offset-4" onClick={() => setEditing(true)} type="button">Edit</button>}<button aria-label={`${link.is_visible ? "Hide" : "Show"} ${link.title}`} className="min-h-11 rounded-xl px-3 text-xs font-semibold underline underline-offset-4" onClick={onToggle} type="button">{link.is_visible ? "Hide" : "Show"}</button><button aria-label={`Delete ${link.title}`} className="min-h-11 rounded-xl px-2 text-xs font-semibold text-black/45 hover:text-red-700" onClick={onRemove} type="button">Delete</button></div>;
}

function AppearanceSection({ mode, onChange }: { mode: ProfileMode; onChange: (updates: Partial<ProfileMode>) => void }) {
  return <div><SectionHeading eyebrow="03 · APPEARANCE" title="Set the feeling." description="A few expressive choices, curated for Setuvara." />
    <fieldset className="mt-7"><legend className="text-sm font-semibold">Theme</legend><div className="mt-2 grid grid-cols-3 gap-2">{(["light", "dark", "editorial"] as const).map((theme) => <button aria-pressed={mode.appearance.theme === theme} className={`min-h-12 rounded-xl border text-sm font-semibold capitalize ${mode.appearance.theme === theme ? "border-black bg-[#0d0d0d] text-white" : "border-black/15"}`} key={theme} onClick={() => onChange({ appearance: { ...mode.appearance, theme } })} type="button">{theme}</button>)}</div></fieldset>
    <fieldset className="mt-7"><legend className="text-sm font-semibold">Accent</legend><div className="mt-3 flex flex-wrap gap-3">{accentOptions.map((color) => <button aria-label={`Accent ${color}`} aria-pressed={mode.appearance.accent.toLowerCase() === color.toLowerCase()} className={`size-11 rounded-full border-2 ${mode.appearance.accent.toLowerCase() === color.toLowerCase() ? "border-black ring-2 ring-black/10" : "border-white shadow-sm"}`} key={color} onClick={() => onChange({ appearance: { ...mode.appearance, accent: color } })} style={{ backgroundColor: color }} type="button" />)}</div><label className="mt-3 block text-xs font-medium text-black/55">Custom hex<input aria-label="Custom accent color" className="ml-3 min-h-10 w-32 rounded-lg border border-black/15 px-2 text-sm" onChange={(event) => { if (/^#[0-9a-f]{6}$/i.test(event.target.value)) onChange({ appearance: { ...mode.appearance, accent: event.target.value } }); }} placeholder="#FF5A4F" /></label></fieldset>
    <fieldset className="mt-7"><legend className="text-sm font-semibold">Layout</legend><div className="mt-2 grid gap-2 sm:grid-cols-2">{modeLayouts[mode.slug].map((layout) => <button aria-pressed={mode.appearance.layout === layout.value} className={`min-h-12 rounded-xl border px-3 text-sm font-semibold ${mode.appearance.layout === layout.value ? "border-black bg-[#f5f4ef]" : "border-black/15"}`} key={layout.value} onClick={() => onChange({ appearance: { ...mode.appearance, layout: layout.value } })} type="button">{layout.label}</button>)}</div></fieldset>
    <fieldset className="mt-7"><legend className="text-sm font-semibold">Image treatment</legend><div className="mt-2 grid grid-cols-3 gap-2">{(["full-bleed", "portrait", "compact"] as const).map((treatment) => <button aria-pressed={mode.appearance.imageTreatment === treatment} className={`min-h-12 rounded-xl border px-2 text-xs font-semibold capitalize ${mode.appearance.imageTreatment === treatment ? "border-black bg-[#f5f4ef]" : "border-black/15"}`} key={treatment} onClick={() => onChange({ appearance: { ...mode.appearance, imageTreatment: treatment } })} type="button">{treatment.replace("-", " ")}</button>)}</div></fieldset>
  </div>;
}

function SettingsSection({ mode, form }: { mode: ProfileMode; form: ReturnType<typeof useForm<SettingsFormValues>> }) {
  const fields: Record<ModeSlug, { key: string; label: string; placeholder: string; multiline?: boolean }[]> = {
    personal: [{ key: "note", label: "A little more about you", placeholder: "What are you into lately?", multiline: true }, { key: "location", label: "Location", placeholder: "Berlin" }, { key: "pronouns", label: "Pronouns", placeholder: "they / them" }],
    event: [{ key: "eventName", label: "Event name", placeholder: "Slush" }, { key: "city", label: "City", placeholder: "Helsinki" }, { key: "dateLabel", label: "Dates", placeholder: "20–21 Nov 2026" }, { key: "role", label: "Your role / project", placeholder: "Founder · Northlight" }, { key: "hereToMeet", label: "Here to meet", placeholder: "Product designers and early-stage operators", multiline: true }],
    business: [{ key: "role", label: "Role", placeholder: "Head of Sales" }, { key: "company", label: "Company", placeholder: "Lumen Labs" }, { key: "city", label: "City", placeholder: "Berlin" }, { key: "description", label: "What you do", placeholder: "A short business introduction", multiline: true }],
  };
  return <div><SectionHeading eyebrow="04 · MODE SETTINGS" title={mode.slug === "event" ? "Put the moment in context." : mode.slug === "business" ? "Show how you work." : "Share a little more."} description={mode.slug === "personal" ? "These details belong to Personal Mode only." : "Each Mode keeps its own details and privacy."} />
    <div className="mt-6 space-y-4">{fields[mode.slug].map((field) => <label className="block space-y-2 text-sm font-medium" key={field.key}>{field.label}{field.multiline ? <textarea className="min-h-24 w-full rounded-2xl border border-black/15 px-4 py-3 text-base font-normal outline-none focus:border-black" maxLength={280} placeholder={field.placeholder} {...form.register(field.key)} /> : <input className="min-h-12 w-full rounded-2xl border border-black/15 px-4 text-base font-normal outline-none focus:border-black" maxLength={field.key === "contactEmail" ? 254 : 100} placeholder={field.placeholder} {...form.register(field.key)} />}</label>)}
      {mode.slug === "business" && <p className="rounded-xl bg-[#f5f4ef] px-4 py-3 text-xs leading-5 text-black/60">Keep contact details in Links. You can hide any email or booking link without exposing it in your public Mode settings.</p>}
    </div>
  </div>;
}

function ShareSection({ profile, mode, url }: { profile: ProfileIdentity; mode: ProfileMode; url: string }) {
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
    <div className="mt-6 grid justify-center rounded-[1.7rem] bg-[#f5f4ef] p-6"><div className="rounded-2xl bg-white p-4"><QRCodeSVG aria-label={`${mode.label} Mode QR code`} bgColor="#ffffff" fgColor="#0d0d0d" level="Q" marginSize={4} size={220} value={qrUrl} /></div></div>
    <p className="mt-4 break-all rounded-xl bg-black/[0.03] px-4 py-3 text-center text-xs font-medium">{linkUrl.replace(/^https?:\/\//, "")}</p>
    <div className="mt-4 grid grid-cols-2 gap-2"><button className="min-h-12 rounded-full bg-[#0d0d0d] text-sm font-semibold text-white" onClick={async () => { const result = await copyToClipboard(linkUrl); setCopied(result); }} type="button">{copied ? "Copied" : "Copy link"}</button><button className="min-h-12 rounded-full px-4 text-sm font-semibold" onClick={() => void share()} style={{ backgroundColor: coral }} type="button">Share</button></div>
    <button className="mt-3 min-h-11 w-full rounded-full border border-black/15 text-sm font-semibold" onClick={() => setFull(true)} type="button">Full-screen QR</button>
    {full && <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-[#f5f4ef] px-6 text-center"><div className="mb-5 text-xs font-bold tracking-[0.2em]">{profile.display_name.toUpperCase()}<br /><span className="mt-2 inline-block text-black/55">{mode.label.toUpperCase()}{mode.slug === "event" && mode.settings.eventName ? ` · ${String(mode.settings.eventName).toUpperCase()}` : ""}</span></div><div className="rounded-[2rem] bg-white p-5 shadow-[0_25px_70px_-40px_rgba(13,13,13,.5)]"><QRCodeSVG aria-label={`${mode.label} Mode share code`} bgColor="#ffffff" fgColor="#0d0d0d" level="Q" marginSize={4} size={Math.min(320, typeof window === "undefined" ? 320 : window.innerWidth - 80)} value={qrUrl} /></div><p className="mt-6 text-sm font-medium">Scan to open my Setuvara</p><p className="mt-2 text-xs text-black/50">setuvara.com/{profile.username}</p><div className="mt-5 flex gap-3"><button className="min-h-12 rounded-full border border-black/20 px-5 text-sm font-semibold" onClick={async () => { setCopied(await copyToClipboard(linkUrl)); }} type="button">Copy link</button><button className="min-h-12 rounded-full px-5 text-sm font-semibold" onClick={() => setFull(false)} style={{ backgroundColor: coral }} type="button">Done</button></div></div>}
  </div>;
}

function CropDialog({ source, crop, setCrop, zoom, setZoom, onCropComplete, onCancel, onApply }: { source: string; crop: { x: number; y: number }; setCrop: (crop: { x: number; y: number }) => void; zoom: number; setZoom: (value: number) => void; onCropComplete: (area: unknown, pixels: { x: number; y: number; width: number; height: number }) => void; onCancel: () => void; onApply: () => void }) {
  return <div aria-label="Crop profile image" aria-modal="true" className="fixed inset-0 z-[70] grid place-items-center bg-black/70 p-4" role="dialog"><div className="w-full max-w-xl rounded-3xl bg-[#f5f4ef] p-4 sm:p-6"><h2 className="mb-3 text-lg font-semibold">Crop your photo</h2><div className="relative h-[min(60vh,420px)] overflow-hidden rounded-2xl bg-black"><Cropper image={source} crop={crop} zoom={zoom} aspect={4 / 5} onCropChange={setCrop} onZoomChange={setZoom} onCropComplete={onCropComplete} /></div><label className="mt-4 block text-xs font-semibold">Zoom<input aria-label="Photo zoom" className="mt-2 block w-full accent-[#ff5a4f]" max="3" min="1" onChange={(event) => setZoom(Number(event.target.value))} step="0.05" type="range" value={zoom} /></label><div className="mt-4 flex justify-end gap-2"><button className="min-h-11 rounded-full px-4 text-sm font-semibold" onClick={onCancel} type="button">Cancel</button><button className="min-h-11 rounded-full px-5 text-sm font-semibold" onClick={onApply} style={{ backgroundColor: coral }} type="button">Use photo</button></div></div></div>;
}

function SectionHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return <header><p className="text-[10px] font-bold tracking-[0.2em] text-black/45">{eyebrow}</p><h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em]">{title}</h2><p className="mt-2 max-w-lg text-sm leading-6 text-black/55">{description}</p></header>;
}

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return <label className="block space-y-2 text-sm font-medium">{label}{children}{error && <span className="block text-xs text-red-800">{error}</span>}</label>;
}

function dataUrlToBlob(dataUrl: string) {
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

async function cropImage(source: string, crop: { x: number; y: number; width: number; height: number }) {
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
