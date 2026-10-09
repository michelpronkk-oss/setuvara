"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import { ProfileRenderer } from "@/components/profile/profile-renderer";
import type { ModeAppearance, ModeSlug, ProfileIdentity, ProfileLink, ProfileMode } from "@/components/profile/types";
import { createClient } from "@/lib/supabase/client";
import { PASSPORT_REWARDS, type RewardCategory } from "@/lib/passport/rewards";
import { CelebrationClient } from "../passport/passport-dashboard";
import { createProviderLink, updateProviderLink } from "./actions";
import { normalizeLinkPayload, providerForLink, type LinkProvider } from "@/lib/links/providers";
import { isEditorSection, useIdentityEditorStore, type EditorSnapshot } from "./editor-store";
import { AppearanceSection, CropDialog, dataUrlToBlob, LinksSection, ProfileSection, SectionButton, SettingsSection, ShareSection, cropImage } from "./editor-sections";

const coral = "#FF5A4F";
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
  event: z.object({ eventName: z.string().max(100).optional(), city: z.string().max(80).optional(), countryCode: z.string().regex(/^$|^[A-Z]{2}$/).optional(), dateLabel: z.string().max(80).optional(), role: z.string().max(80).optional(), hereToMeet: z.string().max(280).optional() }).strict(),
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
  unlockedRewards: string[];
  selectedRewards: Partial<Record<RewardCategory, string>>;
  celebrationThreshold: number | null;
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

export function IdentityEditor({ initialProfile, initialModes, initialMode, initialSection, publicOrigin, error, saved, signOut, unlockedRewards, selectedRewards: initialSelectedRewards, celebrationThreshold }: EditorProps) {
  const router = useRouter();
  const [profile, setProfile] = useState(initialProfile);
  const [modes, setModes] = useState(initialModes);
  const [selectedRewards, setSelectedRewards] = useState(initialSelectedRewards);
  const activeSlug = useIdentityEditorStore((state) => state.activeSlug);
  const section = useIdentityEditorStore((state) => state.section);
  const setNavigation = useIdentityEditorStore((state) => state.setNavigation);
  const initializeOwner = useIdentityEditorStore((state) => state.initializeOwner);
  const pushUndo = useIdentityEditorStore((state) => state.pushUndo);
  const undo = useIdentityEditorStore((state) => state.undo);
  const redo = useIdentityEditorStore((state) => state.redo);
  const clearHistory = useIdentityEditorStore((state) => state.clearHistory);
  const canUndo = useIdentityEditorStore((state) => state.undoStack.length > 0);
  const canRedo = useIdentityEditorStore((state) => state.redoStack.length > 0);
  const [previewVisitor, setPreviewVisitor] = useState(true);
  const [fullPreview, setFullPreview] = useState(false);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [appearanceDirty, setAppearanceDirty] = useState(false);
  const [message, setMessage] = useState(saved ? savedMessage(saved) : "");
  const [newTitle, setNewTitle] = useState("");
  const [newValue, setNewValue] = useState("");
  const [newProvider, setNewProvider] = useState<LinkProvider | null>(null);
  const [cropSource, setCropSource] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedPixels, setCroppedPixels] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const activeMode = useMemo(() => modes.find((mode) => mode.slug === activeSlug) ?? modes[0], [activeSlug, modes]);
  const profileForm = useForm<ProfileFormValues>({ resolver: zodResolver(profileSchema), defaultValues: initialProfile });
  const settingsForm = useForm<SettingsFormValues>({ resolver: zodResolver(settingsSchema), values: activeMode?.settings ?? {} });
  const settingsWatch = useWatch({ control: settingsForm.control });
  const profileWatch = useWatch({ control: profileForm.control });
  const previewProfile = { ...profile, ...profileWatch };
  const previewSettings = Object.fromEntries(Object.entries(settingsWatch).filter((entry): entry is [string, string | boolean] => entry[1] !== undefined));
  const previewMode = activeMode ? { ...activeMode, settings: previewSettings } : activeMode;
  const hasUnsavedChanges = appearanceDirty || profileForm.formState.isDirty || settingsForm.formState.isDirty;
  const draftSnapshot = useMemo<EditorSnapshot>(() => ({
    profileId: profile.id,
    profile: {
      username: String(profileWatch.username ?? profile.username),
      display_name: String(profileWatch.display_name ?? profile.display_name),
      bio: String(profileWatch.bio ?? profile.bio),
    },
    modes: modes.map((mode) => ({
      id: mode.id,
      settings: mode.id === activeMode?.id ? previewSettings : mode.settings,
      appearance: mode.appearance,
      links: mode.links.map(({ id, title, url, is_visible, sort_order }) => ({ id, title, url, is_visible, sort_order })),
    })),
  }), [activeMode?.id, modes, previewSettings, profile, profileWatch]);
  const previousSnapshot = useRef(draftSnapshot);
  const saveProfileRef = useRef<((values?: ProfileFormValues) => Promise<boolean>) | null>(null);
  const saveModeRef = useRef<(() => Promise<boolean>) | null>(null);
  const restoreHistoryRef = useRef<((forward: boolean) => Promise<boolean | undefined>) | null>(null);
  const profileDraftKey = JSON.stringify(profileWatch);
  const settingsDraftKey = JSON.stringify(settingsWatch);

  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const warnBeforeExit = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warnBeforeExit);
    return () => window.removeEventListener("beforeunload", warnBeforeExit);
  }, [hasUnsavedChanges]);

  useEffect(() => {
    initializeOwner(profile.id);
  }, [initializeOwner, profile.id]);

  useEffect(() => {
    setNavigation(initialMode, isEditorSection(initialSection) ? initialSection : "profile");
  }, [initialMode, initialSection, setNavigation]);

  useEffect(() => {
    previousSnapshot.current = draftSnapshot;
  }, [draftSnapshot]);

  useEffect(() => {
    if (!profileForm.formState.isDirty || !profileSchema.safeParse(profileForm.getValues()).success) return;
    const timer = window.setTimeout(() => { if (saveProfileRef.current) void saveProfileRef.current(profileForm.getValues()); }, 800);
    return () => window.clearTimeout(timer);
  }, [profileDraftKey, profileForm, profileForm.formState.isDirty]);

  useEffect(() => {
    if ((!settingsForm.formState.isDirty && !appearanceDirty) || !activeMode) return;
    const timer = window.setTimeout(() => { if (saveModeRef.current) void saveModeRef.current(); }, 800);
    return () => window.clearTimeout(timer);
  }, [activeMode, appearanceDirty, settingsDraftKey, settingsForm, settingsForm.formState.isDirty]);

  function recordEdit() {
    pushUndo(previousSnapshot.current);
  }

  async function restoreHistory(forward: boolean) {
    const snapshot = forward ? redo(draftSnapshot) : undo(draftSnapshot);
    if (!snapshot || snapshot.profileId !== profile.id) return;
    const supabase = createClient();
    setStatus("saving");
    const profileUpdate = await supabase.from("profiles").update(snapshot.profile).eq("id", profile.id);
    if (profileUpdate.error) return fail("That edit could not be restored. Your saved version is still safe.");
    for (const modeSnapshot of snapshot.modes) {
      const modeUpdate = await supabase.from("profile_modes").update({ settings: modeSnapshot.settings, appearance: modeSnapshot.appearance }).eq("id", modeSnapshot.id).eq("profile_id", profile.id);
      if (modeUpdate.error) return fail("That edit could not be restored. Your saved version is still safe.");
      for (const link of modeSnapshot.links) {
        const linkUpdate = await supabase.from("profile_links").update({ title: link.title, url: link.url, is_visible: link.is_visible, sort_order: link.sort_order }).eq("id", link.id).eq("profile_id", profile.id).eq("mode_id", modeSnapshot.id);
        if (linkUpdate.error) return fail("That edit could not be restored. Your saved version is still safe.");
      }
    }
    setProfile((current) => ({ ...current, ...snapshot.profile }));
    profileForm.reset(snapshot.profile);
    setModes((current) => current.map((mode) => {
      const restored = snapshot.modes.find((item) => item.id === mode.id);
      if (!restored) return mode;
      return { ...mode, settings: restored.settings, appearance: restored.appearance, links: mode.links.map((link) => {
        const restoredLink = restored.links.find((item) => item.id === link.id);
        return restoredLink ? { ...link, ...restoredLink } : link;
      }) };
    }));
    const activeSettings = snapshot.modes.find((mode) => mode.id === activeMode?.id)?.settings;
    if (activeSettings) settingsForm.reset(activeSettings);
    setAppearanceDirty(false);
    setStatus("saved"); setMessage(forward ? "Edit restored" : "Change undone"); router.refresh();
  }

  useEffect(() => {
    saveProfileRef.current = saveProfile;
    saveModeRef.current = saveMode;
    restoreHistoryRef.current = restoreHistory;
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "z") return;
      event.preventDefault();
      if (event.shiftKey && restoreHistoryRef.current) void restoreHistoryRef.current(true);
      else if (restoreHistoryRef.current) void restoreHistoryRef.current(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function navigateTo(nextMode = activeSlug, nextSection = section) {
    if (profileForm.formState.isDirty) void saveProfile(profileForm.getValues());
    if (settingsForm.formState.isDirty || appearanceDirty) void saveMode();
    if (activeMode && nextMode !== activeSlug) {
      const currentSettings = Object.fromEntries(Object.entries(settingsForm.getValues()).filter((entry): entry is [string, string | boolean] => entry[1] !== undefined));
      setModes((current) => current.map((mode) => mode.id === activeMode.id ? { ...mode, settings: currentSettings } : mode));
    }
    setNavigation(nextMode, isEditorSection(nextSection) ? nextSection : "profile");
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

  async function equipReward(category: RewardCategory, rewardId: string) {
    const { error: selectError } = await createClient().rpc("set_passport_reward", { p_category: category, p_reward_id: rewardId });
    if (selectError) return fail("That reward is locked or could not be equipped.");
    setSelectedRewards((current) => ({ ...current, [category]: rewardId }));
    setMessage("Reward equipped"); setStatus("saved"); router.refresh();
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
    if (!activeMode || !newProvider) return fail("Choose a link provider first.");
    const normalized = normalizeLinkPayload({ providerId: newProvider.id, value: newValue });
    if (!normalized.ok) return fail(normalized.message);
    const title = newTitle.trim() || newProvider.defaultLabel;
    if (title.length > 60) return fail("Link labels must be 1–60 characters.");
    setStatus("saving");
    const result = await createProviderLink({ modeId: activeMode.id, slug: activeSlug, providerId: newProvider.id, title, value: newValue });
    if (!result.ok) return fail(result.message);
    clearHistory();
    updateMode({ links: [...activeMode.links, result.link as ProfileLink] });
    setNewProvider(null); setNewTitle(""); setNewValue(""); setMessage("Link added"); setStatus("saved"); router.refresh();
  }

  async function toggleLink(link: ProfileLink) {
    const visible = !link.is_visible;
    recordEdit();
    const { error: updateError } = await createClient().from("profile_links").update({ is_visible: visible }).eq("id", link.id).eq("profile_id", profile.id);
    if (updateError) return fail("Link visibility could not be updated.");
    updateMode({ links: activeMode.links.map((item) => item.id === link.id ? { ...item, is_visible: visible } : item) });
    setMessage(visible ? "Link visible" : "Link hidden"); setStatus("saved");
    router.refresh();
  }

  async function removeLink(link: ProfileLink) {
    clearHistory();
    const { error: deleteError } = await createClient().from("profile_links").delete().eq("id", link.id).eq("profile_id", profile.id);
    if (deleteError) return fail("The link could not be removed.");
    updateMode({ links: activeMode.links.filter((item) => item.id !== link.id) });
    setMessage("Link removed"); setStatus("saved");
  }

  async function editLink(link: ProfileLink, title: string, value: string) {
    if (!activeMode || !title.trim() || title.trim().length > 60) return fail("Link labels must be 1–60 characters.");
    const provider = providerForLink(link.link_type);
    const normalized = normalizeLinkPayload({ providerId: provider.id, value });
    if (!normalized.ok) return fail(normalized.message);
    recordEdit();
    setStatus("saving");
    const result = await updateProviderLink({ linkId: link.id, modeId: activeMode.id, slug: activeSlug, providerId: provider.id, title: title.trim(), value });
    if (!result.ok) return fail(result.message);
    updateMode({ links: activeMode.links.map((item) => item.id === link.id ? result.link as ProfileLink : item) });
    setMessage("Link updated"); setStatus("saved"); router.refresh();
  }

  async function reorder(ordered: ProfileLink[]) {
    if (!activeMode) return;
    recordEdit();
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
    clearHistory();
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
    clearHistory();
    const supabase = createClient();
    const oldPath = activeMode.image_path;
    const { error: updateError } = await supabase.from("profile_modes").update({ image_path: null }).eq("id", activeMode.id).eq("profile_id", profile.id);
    if (updateError) return fail("The photo could not be removed.");
    await supabase.storage.from("profile-media").remove([oldPath]);
    updateMode({ image_path: null, image_url: null }); setMessage("Photo removed"); setStatus("saved"); router.refresh();
  }

  if (!activeMode) return <main className="p-8">Your Modes are being prepared.</main>;
  const publicUrl = `${publicOrigin}/${profile.username}?mode=${activeSlug}`;
  const renderProfile = (owner: boolean) => previewMode ? <ProfileRenderer profile={previewProfile} mode={previewMode} viewerState={owner ? "owner" : "visitor_unconnected"} selectedRewards={selectedRewards} onShare={() => navigateTo(activeSlug, "share")} onEditMode={() => navigateTo(activeSlug, "settings")} /> : null;

  return (
    <main className="min-h-screen bg-[#f5f4ef] text-[#0d0d0d]">
      <header className="border-b border-black/10 bg-[#f5f4ef]/70">
        <div className="mx-auto flex min-h-16 max-w-[1500px] items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-2 sm:gap-4">
            <span className="hidden text-xs text-black/45 sm:inline">{activeMode.label} Mode</span>
            <span aria-live="polite" className="hidden text-xs font-medium text-black/55 sm:inline">{status === "saving" ? "Saving…" : status === "error" ? "Not saved" : hasUnsavedChanges ? "Unsaved changes" : message || (profile.is_published ? "Published" : "Draft")}</span>
            <div className="hidden items-center gap-1 sm:flex" aria-label="Edit history">
              <button aria-label="Undo last edit" className="min-h-10 min-w-10 rounded-full border border-black/10 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-35" disabled={!canUndo || status === "saving"} onClick={() => void restoreHistory(false)} title="Undo (Ctrl/⌘ Z)" type="button">↶</button>
              <button aria-label="Redo last edit" className="min-h-10 min-w-10 rounded-full border border-black/10 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-35" disabled={!canRedo || status === "saving"} onClick={() => void restoreHistory(true)} title="Redo (Ctrl/⌘ Shift Z)" type="button">↷</button>
            </div>
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
            {sections.map((item) => <button className={`min-h-11 shrink-0 rounded-full px-4 text-xs font-semibold ${section === item.id ? "bg-[#0d0d0d] text-white" : "border border-black/10 bg-white/60"}`} key={item.id} onClick={() => navigateTo(activeSlug, item.id)} type="button">{item.title}</button>)}
          </div>

          <div className="rounded-[1.7rem] border border-black/10 bg-white p-5 sm:p-7">
            {section === "profile" && <ProfileSection profile={profile} form={profileForm} mode={activeMode} onDraftChange={recordEdit} onPhoto={() => fileRef.current?.click()} onRemovePhoto={() => void removeImage()} onSave={() => void saveProfile()} />}
            {section === "links" && <LinksSection mode={activeSlug} links={activeMode.links} newTitle={newTitle} newValue={newValue} newProvider={newProvider} setNewTitle={setNewTitle} setNewValue={setNewValue} setNewProvider={setNewProvider} addLink={addLink} toggleLink={toggleLink} removeLink={removeLink} editLink={editLink} reorder={reorder} />}
            {section === "appearance" && <AppearanceSection mode={activeMode} unlockedRewards={unlockedRewards} selectedRewards={selectedRewards} onEquip={equipReward} onChange={(updates) => { recordEdit(); updateMode(updates); setAppearanceDirty(true); }} />}
            {section === "settings" && <SettingsSection mode={activeMode} form={settingsForm} onDraftChange={recordEdit} />}
            {section === "share" && <ShareSection profile={profile} mode={activeMode} url={publicUrl} unlockedRewards={unlockedRewards} selectedRewards={selectedRewards} onEquip={equipReward} />}
            {section !== "links" && section !== "share" && <button className="mt-7 min-h-12 rounded-full px-6 text-sm font-semibold" onClick={() => void saveCurrent()} style={{ backgroundColor: coral }} type="button">{status === "saving" ? "Saving…" : "Save changes"}</button>}
          </div>
          <p className="mt-4 text-center text-[11px] text-black/40 lg:hidden">{status === "saving" ? "Saving…" : status === "error" ? "Your draft is here. Retry when you’re ready." : message || "Changes save as you go."}</p>
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
      <CelebrationClient threshold={celebrationThreshold} name={PASSPORT_REWARDS.find((reward) => reward.milestone === celebrationThreshold)?.name ?? (celebrationThreshold ? `${celebrationThreshold} Connections` : null)} />
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
