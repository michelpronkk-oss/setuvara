"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import { z } from "zod";

import { marketingFontClasses } from "@/app/(marketing)/fonts";
import type { BlockKind, ModeAppearance, ModeSlug, PhotoCropValue, ProfileBlock, ProfileIdentity, ProfileLink, ProfileMode } from "@/components/profile/types";
import { NAME_FONT_NAMES } from "@/components/profile/name-type";
import { APPEARANCE_NAMES, extraSlideLimit, introducedLockedFields, isModeLayout, isValidAppearance, lockedFields, resetAppearance as resetVisualAppearance, resolveAppearance, storedAppearance } from "@/components/profile/appearance";
import { modeFocus, readCrop, type PhotoFocus } from "@/components/profile/photo-focus";
import { BLOCK_LIMIT, BLOCKS, validateBlock } from "@/lib/blocks/registry";
import { removeContentImageIfUnused, removeContentMediaIfUnused } from "@/lib/blocks/storage";
import { createClient } from "@/lib/supabase/client";
import { isModeHandleSlug, type ModeHandleSlug, type ModeHandleState } from "@/lib/handles/mode-handle";
import type { ConnectPolicy } from "@/lib/connections/access";
import { resolveStoredLink, providerForLink, type LinkProvider } from "@/lib/links/providers";
import { PASSPORT_REWARDS, type RewardCategory } from "@/lib/passport/rewards";
import type { MemberTier } from "@/lib/billing/member-badge";
import type { PlanCode } from "@/lib/billing/catalog";
import type { CapabilityKey } from "@/lib/billing/capabilities";
import { isAllowedUsername } from "@/lib/usernames";
import { publicModeUrl } from "@/lib/share/public-mode-url";
import { useI18n } from "@/lib/i18n/provider";
import { FeaturePaywall } from "@/components/app/feature-paywall";
import { CelebrationClient } from "../passport/passport-dashboard";
import { createProviderLink, updateProviderLink } from "./actions";
import { CropDialog, cropToBlob, originalToBlob } from "./editor-crop";
import { FullPreview, PeekPreview, PreviewPane, type SoundIntro } from "./editor-preview";
import { ContentSection } from "./editor-content";
import { HomeSection, MobileHome, ProfileSection, SettingsSection, ShareSection } from "./editor-sections";
import { AppearancePlusSheet, AppearanceSection, pendingAppearanceKey, PhotoPreviews } from "./editor-appearance";
import { SECTIONS, SETTING_KEYS, type EditableProfile, type EditorApi, type PlusTrigger, type PreviewState, type Section, type UsernameStatus } from "./editor-types";
import { modeMeta } from "./editor-ui";
import { MobileModeHeader, MobileTabBar, sectionPlace } from "@/components/app/mobile-nav";
import { EditorSidebar } from "./editor-sidebar";

// Same Mode colours as the app sidebar.
const MODE_DOT: Record<ModeSlug, string> = { personal: "#FF5A4F", event: "#C7FF4A", business: "#AFCBFF", creator: "#E8A6FF" };

type EditorProps = {
  /** Whether Actions show to visitors on this site yet. */
  actionsLive?: boolean;
  initialProfile: ProfileIdentity;
  initialModes: ProfileMode[];
  initialMode: ModeSlug;
  initialSection: string;
  initialShareIntent: "profile" | "in_person";
  publicOrigin: string;
  /** Opaque share URLs for non-default Modes (`/s/<token>`); null when unavailable. */
  modeShareUrls: Partial<Record<ModeSlug, string | null>>;
  /** Business and Creator handles the owner claimed (live or not). */
  modeHandles: Partial<Record<ModeHandleSlug, ModeHandleState>>;
  error?: string;
  saved?: string;
  signOut: () => Promise<void>;
  unlockedRewards: string[];
  selectedRewards: Partial<Record<RewardCategory, string>>;
  celebrationThreshold: number | null;
  memberTier: MemberTier | null;
  plan: PlanCode;
};

type SaveStatus = "saved" | "pending" | "saving" | "error";
type Task = () => Promise<string | null>;

const profileSchema = z.object({
  username: z.string().trim().regex(/^[a-z0-9_]{3,24}$/, "Use 3–24 lowercase letters, numbers or underscores."),
  display_name: z.string().trim().min(1, "Add the name people know you by.").max(80, "Keep your name under 80 characters."),
  bio: z.string().max(280, "Keep this under 280 characters."),
});
const SAVE_DELAY = 650;
const MEDIA = "profile-media";

function logProfileBlockFailure(operation: string, error: { code?: string; message?: string }) {
  const constraint = error.message?.match(/constraint "([a-zA-Z0-9_]+)"/)?.[1] ?? null;
  console.error("[Setuvara] profile_blocks persistence failed", {
    operation,
    code: error.code ?? "unknown",
    constraint,
  });
}

function isSection(value: string): value is Section {
  return value === "home" || SECTIONS.some((section) => section.id === value);
}

export function IdentityEditor({ actionsLive = false, initialProfile, initialModes, initialMode, initialSection, initialShareIntent, publicOrigin, modeShareUrls: initialModeShareUrls, modeHandles: initialModeHandles, error, signOut, unlockedRewards, selectedRewards: initialSelectedRewards, celebrationThreshold, memberTier, plan }: EditorProps) {
  const [profile, setProfile] = useState(initialProfile);
  const [modes, setModes] = useState(initialModes);
  const [slug, setSlug] = useState<ModeSlug>(initialMode);
  const [section, setSection] = useState<Section>(isSection(initialSection) ? initialSection : "home");
  const [selectedRewards, setSelectedRewards] = useState(initialSelectedRewards);
  const [previewState, setPreviewState] = useState<PreviewState>("visitor");
  const [fullPreview, setFullPreview] = useState(false);
  // Phones: the live preview docks over the tab bar as one slim bar; opened, it stays open (remembered).
  const dockOpen = useSyncExternalStore(peekStore.subscribe, peekStore.read, () => false);
  // Only where edits change the profile itself; Appearance has its own full-screen preview.
  const peekable = section === "profile" || section === "links";
  const peekOpen = dockOpen && peekable;
  const [soundIntroOn, setSoundIntroOn] = useState(false);
  const soundIntro = useMemo<SoundIntro>(() => ({ on: soundIntroOn, set: setSoundIntroOn }), [soundIntroOn]);
  const [status, setStatus] = useState<SaveStatus>("saved");
  const [statusMessage, setStatusMessage] = useState(error ? "Something didn’t save last time. Check your details." : "");
  const [justPublished, setJustPublished] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [savedUsername, setSavedUsername] = useState(initialProfile.username);
  const [usernameCheck, setUsernameCheck] = useState<{ candidate: string; result: UsernameStatus } | null>(null);
  const [toastState, setToastState] = useState<{ id: number; text: string; action?: { label: string; run: () => void } } | null>(null);
  const [paywallCapability, setPaywallCapability] = useState<CapabilityKey | null>(null);
  // Unsaved premium looks the owner is previewing, per Mode. Never written to the database.
  const [appearancePreviews, setAppearancePreviews] = useState<Record<string, ModeAppearance>>({});
  const [plusSheet, setPlusSheet] = useState<PlusTrigger | null>(null);
  // A crop session: a new file (its object URL), or a re-crop of the kept original (or, for photos
  // saved before originals were kept, of the saved photo itself, which then becomes the original).
  const [crop, setCrop] = useState<{ source: string; modeId: string; revoke: boolean; focus?: PhotoFocus; slide?: boolean; initialCrop?: PhotoCropValue | null; keepOriginal?: string; savedOnly?: boolean } | null>(null);
  const [busyPhoto, setBusyPhoto] = useState(false);

  const { messages } = useI18n();
  const supabase = useMemo(() => createClient(), []);
  const profileRef = useRef(profile);
  const modesRef = useRef(modes);
  const savedUsernameRef = useRef(initialProfile.username);
  const pending = useRef(new Map<string, Task>());
  const failed = useRef(new Map<string, Task>());
  const timer = useRef<number | null>(null);
  const flushing = useRef(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const photoTarget = useRef<string | null>(null);
  /** The next picked file becomes a slideshow photo rather than the main photo. */
  const slideTarget = useRef(false);
  const toastTimer = useRef<number | null>(null);

  useEffect(() => { profileRef.current = profile; }, [profile]);
  useEffect(() => { modesRef.current = modes; }, [modes]);

  const mode = modes.find((item) => item.slug === slug) ?? modes[0];

  const toast = useCallback((text: string, action?: { label: string; run: () => void }) => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    setToastState({ id: Date.now(), text, action });
    toastTimer.current = window.setTimeout(() => setToastState(null), action ? 6000 : 2400);
  }, []);

  // ---------- Autosave engine ----------
  const flush = useCallback(async () => {
    if (timer.current) { window.clearTimeout(timer.current); timer.current = null; }
    // A flush already running picks up anything queued meanwhile.
    if (flushing.current || !pending.current.size) return;
    flushing.current = true;
    let firstError: string | null = null;
    while (pending.current.size) {
      setStatus("saving");
      const tasks = [...pending.current.entries()];
      pending.current.clear();
      for (const [key, task] of tasks) {
        let result: string | null;
        try { result = await task(); } catch { result = "Your connection dropped. Your edits are still here."; }
        if (result) { failed.current.set(key, task); firstError ??= result; }
        else failed.current.delete(key);
      }
    }
    flushing.current = false;
    if (firstError || failed.current.size) { setStatus("error"); setStatusMessage(firstError ?? "Some changes didn’t save."); }
    else { setStatus("saved"); setStatusMessage(""); }
  }, []);

  const schedule = useCallback((key: string, task: Task) => {
    pending.current.set(key, task);
    failed.current.delete(key);
    setStatus("pending");
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => { void flush(); }, SAVE_DELAY);
  }, [flush]);

  const retry = useCallback(() => {
    for (const [key, task] of failed.current) pending.current.set(key, task);
    failed.current.clear();
    void flush();
  }, [flush]);

  /** Immediate writes (links, photos, publishing) share the same status chip. */
  const runNow = useCallback(async (work: () => Promise<string | null>) => {
    setStatus("saving");
    let result: string | null;
    try { result = await work(); } catch { result = "Your connection dropped. Try again."; }
    if (result) { setStatus("error"); setStatusMessage(result); toast(result); }
    else { setStatus(pending.current.size ? "pending" : failed.current.size ? "error" : "saved"); }
    return result;
  }, [toast]);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (!pending.current.size && !flushing.current && !failed.current.size) return;
      void flush();
      event.preventDefault();
      event.returnValue = "";
    };
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") { event.preventDefault(); void flush(); }
      if (event.key === "Escape") setFullPreview(false);
    };
    window.addEventListener("beforeunload", warn);
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("beforeunload", warn); window.removeEventListener("keydown", onKey); };
  }, [flush]);

  // ---------- Profile ----------
  const saveProfileTask: Task = useCallback(async () => {
    const draft = profileRef.current;
    const parsed = profileSchema.safeParse({ username: draft.username, display_name: draft.display_name, bio: draft.bio });
    const errors: Record<string, string> = {};
    if (!parsed.success) for (const issue of parsed.error.issues) errors[String(issue.path[0])] ??= issue.message;
    if (errors.display_name || errors.bio) {
      setFieldErrors((current) => ({ ...current, ...errors }));
      return "Fix the highlighted field to save.";
    }
    // A username that can't be used never blocks the rest of the profile from saving.
    const username = draft.username.trim();
    let usernameError: string | null = null;
    let includeUsername = username !== savedUsernameRef.current;
    if (includeUsername) {
      if (errors.username) usernameError = errors.username;
      else if (!isAllowedUsername(username)) usernameError = "That username is reserved.";
      else {
        const { data: available, error: availabilityError } = await supabase.rpc("is_username_available", { candidate_username: username });
        if (availabilityError) usernameError = "We couldn’t check that username. Try again.";
        else if (!available) { usernameError = "That username is taken."; setUsernameCheck({ candidate: username, result: "taken" }); }
      }
      if (usernameError) includeUsername = false;
    }
    const values = { display_name: draft.display_name.trim(), bio: draft.bio, ...(includeUsername ? { username } : {}) };
    let { error: updateError } = await supabase.from("profiles").update(values).eq("id", initialProfile.id);
    const limit = updateError?.message?.includes("username_change_limit") ? "You can change your username 3 times in 30 days." : updateError?.message?.includes("username_history_limit") ? "You've used 20 usernames. Take back an old one, or write to us." : null;
    if (updateError && includeUsername && limit) {
      // The rest of the profile still saves; only the new username waits.
      usernameError = limit;
      includeUsername = false;
      ({ error: updateError } = await supabase.from("profiles").update({ display_name: values.display_name, bio: values.bio }).eq("id", initialProfile.id));
    }
    if (updateError) {
      if (updateError.code === "23505") { setFieldErrors((current) => ({ ...current, username: "That username is taken." })); return "That username is taken."; }
      return "Your profile couldn’t be saved. Try again.";
    }
    if (includeUsername) { savedUsernameRef.current = username; setSavedUsername(username); }
    setFieldErrors((current) => { const next = { ...current }; delete next.display_name; delete next.bio; if (usernameError) next.username = usernameError; else delete next.username; return next; });
    return usernameError;
  }, [initialProfile.id, supabase]);

  const updateProfile = useCallback((patch: Partial<EditableProfile>) => {
    const next = { ...profileRef.current, ...patch };
    if (patch.username !== undefined) next.username = patch.username.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 24);
    profileRef.current = next;
    setProfile(next);
    setFieldErrors((current) => { const copy = { ...current }; for (const key of Object.keys(patch)) delete copy[key]; return copy; });
    schedule("profile", saveProfileTask);
  }, [saveProfileTask, schedule]);

  // Debounced username availability, so people know before the save runs.
  const usernameValid = /^[a-z0-9_]{3,24}$/.test(profile.username) && isAllowedUsername(profile.username);
  const usernameStatus: UsernameStatus = profile.username === savedUsername ? "idle" : !usernameValid ? "invalid" : usernameCheck?.candidate === profile.username ? usernameCheck.result : "checking";
  useEffect(() => {
    const candidate = profile.username;
    if (candidate === savedUsername || !usernameValid) return;
    const handle = window.setTimeout(async () => {
      const { data, error: checkError } = await supabase.rpc("is_username_available", { candidate_username: candidate });
      setUsernameCheck({ candidate, result: checkError ? "idle" : data ? "available" : "taken" });
    }, 350);
    return () => window.clearTimeout(handle);
  }, [profile.username, savedUsername, supabase, usernameValid]);

  // ---------- Modes ----------
  const patchMode = useCallback((modeId: string, patch: Partial<ProfileMode>) => {
    const next = modesRef.current.map((item) => item.id === modeId ? { ...item, ...patch } : item);
    modesRef.current = next;
    setModes(next);
  }, []);

  const saveModeTask = useCallback((modeId: string): Task => async () => {
    const current = modesRef.current.find((item) => item.id === modeId);
    if (!current) return null;
    const limits = SETTING_KEYS[current.slug];
    // Creator keeps the studio's own settings (sections) that this editor doesn't show.
    const settings: Record<string, string | boolean> = current.slug === "creator"
      ? Object.fromEntries(Object.entries(current.settings).filter(([key]) => !(key in limits)))
      : {};
    for (const [key, max] of Object.entries(limits)) {
      const value = current.settings[key];
      if (typeof value !== "string") continue;
      if (value.length > max) return `Keep that under ${max} characters.`;
      settings[key] = value.trim();
    }
    const appearance = current.appearance;
    if (!isValidAppearance(current.slug, appearance)) return "That look isn’t available for this Mode.";
    const { error: updateError } = await supabase.from("profile_modes").update({ settings, appearance }).eq("id", modeId).eq("profile_id", initialProfile.id);
    return updateError ? `${modeMeta[current.slug].name} Mode couldn’t be saved. Try again.` : null;
  }, [initialProfile.id, supabase]);

  const updateSetting = useCallback((key: string, value: string) => {
    const current = modesRef.current.find((item) => item.slug === slug);
    if (!current) return;
    patchMode(current.id, { settings: { ...current.settings, [key]: value } });
    schedule(`mode:${current.id}`, saveModeTask(current.id));
  }, [patchMode, saveModeTask, schedule, slug]);

  const saveAppearanceFor = useCallback((modeId: string, patch: Partial<ModeAppearance>) => {
    const current = modesRef.current.find((item) => item.id === modeId);
    // A layout only ever applies to the Mode it belongs to.
    if (!current || (patch.layout !== undefined && !isModeLayout(current.slug, patch.layout))) return;
    const next = { ...current.appearance, ...patch };
    for (const key of Object.keys(next) as (keyof ModeAppearance)[]) if (next[key] === undefined) delete next[key];
    patchMode(current.id, { appearance: next });
    schedule(`mode:${current.id}`, saveModeTask(current.id));
  }, [patchMode, saveModeTask, schedule]);

  const updateAppearance = useCallback((patch: Partial<ModeAppearance>) => {
    const current = modesRef.current.find((item) => item.slug === slug);
    if (current) saveAppearanceFor(current.id, patch);
  }, [saveAppearanceFor, slug]);

  // Preview before upgrade: a choice that needs Plus renders for the owner only; a free
  // choice saves straight away. Once a preview is open, later picks join it so the whole
  // look is applied (or dropped) together.
  const chooseAppearance = useCallback((patch: Partial<ModeAppearance>) => {
    const current = modesRef.current.find((item) => item.slug === slug);
    if (!current) return;
    const base = appearancePreviews[current.id] ?? current.appearance;
    const next = { ...base, ...patch };
    for (const key of Object.keys(next) as (keyof ModeAppearance)[]) if (next[key] === undefined) delete next[key];
    if (introducedLockedFields(current.appearance, next, plan).length || lockedFields(patch, plan).length) {
      setAppearancePreviews((previews) => ({ ...previews, [current.id]: next }));
      return;
    }
    setAppearancePreviews((previews) => { const rest = { ...previews }; delete rest[current.id]; return rest; });
    saveAppearanceFor(current.id, { ...Object.fromEntries(Object.keys(current.appearance).map((key) => [key, undefined])), ...next });
  }, [appearancePreviews, plan, saveAppearanceFor, slug]);

  const clearAppearancePreview = useCallback(() => {
    const current = modesRef.current.find((item) => item.slug === slug);
    if (current) setAppearancePreviews((previews) => { const rest = { ...previews }; delete rest[current.id]; return rest; });
  }, [slug]);

  const applyAppearancePreview = useCallback(() => {
    const current = modesRef.current.find((item) => item.slug === slug);
    const preview = current ? appearancePreviews[current.id] : null;
    if (!current || !preview) return;
    const locked = lockedFields(preview, plan);
    if (!locked.length) { chooseAppearance({}); return; }
    // Remember the previewed look so it applies when the member returns with Plus.
    try { window.localStorage.setItem(pendingAppearanceKey(current.id), JSON.stringify(preview)); } catch { /* private mode: the preview simply isn't remembered */ }
    const field = locked[0];
    const appearance = storedAppearance(preview, current.slug);
    setPlusSheet(field === "theme" || field === "layout" || field === "imageTreatment" ? { kind: "appearance", appearance }
      : field === "soundStyle" || field === "soundtrackPresentation" ? { kind: "soundtrack", appearance }
        : field === "qrStyle" ? { kind: "qr", name: preview.qrStyle, appearance }
          : field === "nameFont" && preview.nameFont ? { kind: "type", name: NAME_FONT_NAMES[preview.nameFont], appearance } : { kind: "advanced", appearance });
  }, [appearancePreviews, chooseAppearance, plan, slug]);

  // Reset Appearance: only this Mode's visual config returns to its Free default (accent and QR
  // frame kept). Photo, bio, links, blocks, soundtrack, connections and Live Context live in other
  // columns and tables and are never touched here.
  const resetAppearance = useCallback(() => {
    const current = modesRef.current.find((item) => item.slug === slug);
    if (!current) return;
    setAppearancePreviews((previews) => { const rest = { ...previews }; delete rest[current.id]; return rest; });
    const next = resetVisualAppearance(current.slug, current.appearance);
    saveAppearanceFor(current.id, { ...Object.fromEntries(Object.keys(current.appearance).map((key) => [key, undefined])), ...next });
  }, [saveAppearanceFor, slug]);

  // Back from checkout with Plus: a look previewed before upgrading applies once.
  useEffect(() => {
    for (const item of modesRef.current) {
      let saved: unknown = null;
      try { saved = JSON.parse(window.localStorage.getItem(pendingAppearanceKey(item.id)) ?? "null"); } catch { saved = null; }
      if (!saved || typeof saved !== "object") continue;
      const next = saved as ModeAppearance;
      if (!isValidAppearance(item.slug, next) || introducedLockedFields(item.appearance, next, plan).length) continue;
      try { window.localStorage.removeItem(pendingAppearanceKey(item.id)); } catch { /* ignore */ }
      saveAppearanceFor(item.id, { ...Object.fromEntries(Object.keys(item.appearance).map((key) => [key, undefined])), ...next });
      toast(messages.appearance.pendingApplied);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once with the server-resolved plan
  }, []);

  const setModeEnabled = useCallback(async (enabled: boolean) => {
    const current = modesRef.current.find((item) => item.slug === slug);
    if (!current || current.slug === "personal") return;
    patchMode(current.id, { is_enabled: enabled });
    const failure = await runNow(async () => {
      const { error: updateError } = await supabase.from("profile_modes").update({ is_enabled: enabled }).eq("id", current.id).eq("profile_id", initialProfile.id);
      return updateError ? "That Mode couldn’t be switched. Try again." : null;
    });
    if (failure) patchMode(current.id, { is_enabled: !enabled });
    else toast(enabled ? `${modeMeta[current.slug].name} Mode is live` : `${modeMeta[current.slug].name} Mode is off. Its link stops working.`);
  }, [initialProfile.id, patchMode, runNow, slug, supabase, toast]);

  const setConnectPolicy = useCallback(async (policy: ConnectPolicy) => {
    const current = modesRef.current.find((item) => item.slug === slug);
    if (!current) return;
    const previous = current.connect_policy ?? "anyone";
    if (previous === policy) return;
    patchMode(current.id, { connect_policy: policy });
    const failure = await runNow(async () => {
      const { error: updateError } = await supabase.from("profile_modes").update({ connect_policy: policy }).eq("id", current.id).eq("profile_id", initialProfile.id);
      return updateError ? "Connection access couldn’t be saved. Try again." : null;
    });
    if (failure) patchMode(current.id, { connect_policy: previous });
    else toast(policy === "anyone" ? `Anyone viewing ${modeMeta[current.slug].name} can connect` : policy === "direct_only" ? `${modeMeta[current.slug].name} is view-only until you share directly` : `${modeMeta[current.slug].name} is view-only`);
  }, [initialProfile.id, patchMode, runNow, slug, supabase, toast]);

  const setPublished = useCallback(async (published: boolean) => {
    await flush();
    const failure = await runNow(async () => {
      const { error: publishError } = await supabase.from("profiles").update({ is_published: published }).eq("id", initialProfile.id);
      return publishError ? "Publishing didn’t go through. Try again." : null;
    });
    if (failure) return;
    setProfile((current) => ({ ...current, is_published: published }));
    if (published) { setJustPublished(true); window.setTimeout(() => setJustPublished(false), 5000); toast("Published. Every share surface is up to date."); }
    else toast("Your Setuvara is private. Links and QR codes stop working.");
  }, [flush, initialProfile.id, runNow, supabase, toast]);

  // ---------- Links ----------
  const setLinks = useCallback((modeId: string, links: ProfileLink[]) => patchMode(modeId, { links }), [patchMode]);

  const addLinkTo = useCallback(async (target: ProfileMode, provider: LinkProvider, title: string, value: string) => {
    const result = await createProviderLink({ modeId: target.id, slug: target.slug, providerId: provider.id, title: title.trim() || provider.defaultLabel, value });
    if (!result.ok) return { error: result.message, link: null };
    const latest = modesRef.current.find((item) => item.id === target.id) ?? target;
    const link = result.link as ProfileLink;
    setLinks(target.id, [...latest.links, link]);
    return { error: null, link };
  }, [setLinks]);

  const addLink = useCallback(async (provider: LinkProvider, title: string, value: string) => {
    let message: string | null = null;
    await runNow(async () => { const result = await addLinkTo(mode, provider, title, value); message = result.error; return null; });
    if (message) { setStatus("saved"); return message; }
    toast(`Link added to ${modeMeta[mode.slug].name} Mode`);
    return null;
  }, [addLinkTo, mode, runNow, toast]);

  const editLink = useCallback(async (link: ProfileLink, title: string, value: string) => {
    const provider = providerForLink(link.link_type);
    let message: string | null = null;
    await runNow(async () => {
      const result = await updateProviderLink({ linkId: link.id, modeId: mode.id, slug: mode.slug, providerId: provider.id, title: title.trim(), value });
      if (!result.ok) { message = result.message; return null; }
      const latest = modesRef.current.find((item) => item.id === mode.id) ?? mode;
      setLinks(mode.id, latest.links.map((item) => item.id === link.id ? { ...item, ...(result.link as ProfileLink) } : item));
      return null;
    });
    return message;
  }, [mode, runNow, setLinks]);

  const toggleLink = useCallback((link: ProfileLink) => {
    const target = mode;
    const visible = !link.is_visible;
    setLinks(target.id, target.links.map((item) => item.id === link.id ? { ...item, is_visible: visible } : item));
    void runNow(async () => {
      const { error: updateError } = await supabase.from("profile_links").update({ is_visible: visible }).eq("id", link.id).eq("profile_id", initialProfile.id);
      if (updateError) {
        const latest = modesRef.current.find((item) => item.id === target.id) ?? target;
        setLinks(target.id, latest.links.map((item) => item.id === link.id ? { ...item, is_visible: !visible } : item));
        return "That link couldn’t be updated.";
      }
      return null;
    });
  }, [initialProfile.id, mode, runNow, setLinks, supabase]);

  const reorderLinks = useCallback((ordered: ProfileLink[]) => {
    const target = mode;
    const before = target.links;
    setLinks(target.id, ordered.map((link, index) => ({ ...link, sort_order: index })));
    void runNow(async () => {
      const results = await Promise.all(ordered.map((link, index) => supabase.from("profile_links").update({ sort_order: index }).eq("id", link.id).eq("profile_id", initialProfile.id).eq("mode_id", target.id)));
      if (results.some((result) => result.error)) { setLinks(target.id, before); return "The new order couldn’t be saved."; }
      return null;
    });
  }, [initialProfile.id, mode, runNow, setLinks, supabase]);

  const deleteLink = useCallback((link: ProfileLink) => {
    const target = mode;
    const index = target.links.findIndex((item) => item.id === link.id);
    setLinks(target.id, target.links.filter((item) => item.id !== link.id));
    void runNow(async () => {
      const { error: deleteError } = await supabase.from("profile_links").delete().eq("id", link.id).eq("profile_id", initialProfile.id);
      if (deleteError) {
        const latest = modesRef.current.find((item) => item.id === target.id) ?? target;
        const restored = [...latest.links]; restored.splice(index, 0, link); setLinks(target.id, restored);
        return "That link couldn’t be deleted.";
      }
      return null;
    }).then((failure) => {
      if (failure) return;
      toast("Link deleted", { label: "Undo", run: () => {
        const provider = providerForLink(link.link_type);
        const value = resolveStoredLink(provider.id, link.url)?.canonicalValue ?? link.url;
        void runNow(async () => {
          const result = await addLinkTo(target, provider, link.title, value);
          if (result.error || !result.link) return result.error ?? "That link couldn’t be restored.";
          const latest = modesRef.current.find((item) => item.id === target.id) ?? target;
          const others = latest.links.filter((item) => item.id !== result.link!.id);
          const restored = { ...result.link, is_visible: link.is_visible };
          others.splice(Math.min(index, others.length), 0, restored);
          setLinks(target.id, others.map((item, order) => ({ ...item, sort_order: order })));
          await Promise.all(others.map((item, order) => supabase.from("profile_links").update({ sort_order: order, ...(item.id === restored.id ? { is_visible: link.is_visible } : {}) }).eq("id", item.id).eq("profile_id", initialProfile.id)));
          return null;
        });
      } });
    });
  }, [addLinkTo, initialProfile.id, mode, runNow, setLinks, supabase, toast]);

  const copyLinksFrom = useCallback(async (source: ModeSlug) => {
    const from = modesRef.current.find((item) => item.slug === source);
    if (!from?.links.length) return;
    const target = mode;
    let copied = 0;
    await runNow(async () => {
      for (const link of from.links) {
        const provider = providerForLink(link.link_type);
        const value = resolveStoredLink(provider.id, link.url)?.canonicalValue ?? link.url;
        const result = await addLinkTo(target, provider, link.title, value);
        if (result.error) return result.error;
        copied += 1;
      }
      return null;
    });
    if (copied) toast(`${copied} link${copied === 1 ? "" : "s"} copied from ${modeMeta[source].name}`);
  }, [addLinkTo, mode, runNow, toast]);

  // ---------- Blocks ----------
  const setBlocks = useCallback((modeId: string, blocks: ProfileBlock[]) => patchMode(modeId, { blocks }), [patchMode]);
  const blocksOf = (modeId: string) => modesRef.current.find((item) => item.id === modeId)?.blocks ?? [];
  const signedBlockMedia = useCallback(async (data: Record<string, unknown>) => {
    const imagePath = typeof data.image_path === "string" ? data.image_path : null;
    const videoPath = typeof data.video_path === "string" ? data.video_path : null;
    const [image, video] = await Promise.all([
      imagePath ? supabase.storage.from(MEDIA).createSignedUrl(imagePath, 3600) : Promise.resolve({ data: null }),
      videoPath ? supabase.storage.from(MEDIA).createSignedUrl(videoPath, 3600) : Promise.resolve({ data: null }),
    ]);
    return {
      ...(image.data?.signedUrl ? { image_url: image.data.signedUrl } : {}),
      ...(video.data?.signedUrl ? { video_url: video.data.signedUrl } : {}),
    };
  }, [supabase]);

  /** Mirrors the database rule: one soundtrack per Mode, and making one clears the last. */
  const withSoundtrack = (blocks: ProfileBlock[], id: string, on: boolean) => blocks.map((item) => item.id === id ? { ...item, is_soundtrack: on } : on ? { ...item, is_soundtrack: false } : item);

  const insertBlock = useCallback(async (target: ProfileMode, kind: BlockKind, data: Record<string, unknown>, isVisible = true, isSoundtrack = false) => {
    const check = validateBlock(kind, data);
    if (!check.ok) return { error: check.message, block: null };
    const existing = modesRef.current.find((item) => item.id === target.id)?.blocks ?? [];
    if (existing.length >= BLOCK_LIMIT) return { error: `A Mode can hold ${BLOCK_LIMIT} blocks. Remove one first.`, block: null };
    const sortOrder = existing.reduce((max, block) => Math.max(max, block.sort_order), -1) + 1;
    const { data: row, error: insertError } = await supabase.from("profile_blocks")
      .insert({ profile_id: initialProfile.id, mode_id: target.id, kind, data: check.data, sort_order: sortOrder, is_visible: isVisible, ...(isSoundtrack ? { is_soundtrack: true } : {}) })
      .select("id, kind, data, is_visible, sort_order").single();
    if (insertError || !row) {
      if (insertError) logProfileBlockFailure("insert", insertError);
      return { error: "That block couldn’t be added. Try again.", block: null };
    }
    const signedMedia = await signedBlockMedia(row.data);
    const block = { ...row, data: { ...row.data, ...signedMedia }, is_soundtrack: isSoundtrack && kind === "music" && isVisible } as ProfileBlock;
    const current = [...(modesRef.current.find((item) => item.id === target.id)?.blocks ?? []), block];
    setBlocks(target.id, block.is_soundtrack ? withSoundtrack(current, block.id, true) : current);
    return { error: null, block };
  }, [initialProfile.id, setBlocks, signedBlockMedia, supabase]);

  const addBlock = useCallback(async (kind: BlockKind, data: Record<string, unknown>, options: { soundtrack?: boolean } = {}) => {
    let message: string | null = null;
    await runNow(async () => { message = (await insertBlock(mode, kind, data, true, Boolean(options.soundtrack))).error; return null; });
    if (message) {
      setStatus("saved");
      await Promise.all([data.image_path, data.video_path].filter((path): path is string => typeof path === "string").map((path) => removeContentMediaIfUnused(supabase, initialProfile.id, path)));
      return message;
    }
    toast(options.soundtrack ? `Soundtrack set for ${modeMeta[mode.slug].name} Mode` : `${BLOCKS[kind].name} added to ${modeMeta[mode.slug].name} Mode`);
    return null;
  }, [initialProfile.id, insertBlock, mode, runNow, supabase, toast]);

  const updateBlock = useCallback(async (block: ProfileBlock, data: Record<string, unknown>, options: { soundtrack?: boolean } = {}) => {
    const check = validateBlock(block.kind, data);
    if (!check.ok) return check.message;
    const target = mode;
    const soundtrack = options.soundtrack !== undefined && options.soundtrack !== Boolean(block.is_soundtrack) ? options.soundtrack && block.is_visible : undefined;
    let message: string | null = null;
    await runNow(async () => {
      const { error: updateError } = await supabase.from("profile_blocks").update({ data: check.data, ...(soundtrack !== undefined ? { is_soundtrack: soundtrack } : {}) }).eq("id", block.id).eq("profile_id", initialProfile.id);
      if (updateError) { logProfileBlockFailure("update", updateError); message = "That block couldn’t be saved. Try again."; return null; }
      const signedMedia = await signedBlockMedia(check.data);
      const updatedData = { ...check.data, ...signedMedia };
      const updated = blocksOf(target.id).map((item) => item.id === block.id ? { ...item, data: updatedData } : item);
      setBlocks(target.id, soundtrack !== undefined ? withSoundtrack(updated, block.id, soundtrack) : updated);
      const previousPaths = [block.data.image_path, block.data.video_path].filter((path): path is string => typeof path === "string");
      const nextPaths = new Set([check.data.image_path, check.data.video_path].filter((path): path is string => typeof path === "string"));
      await Promise.all(previousPaths.filter((path) => !nextPaths.has(path)).map((path) => removeContentMediaIfUnused(supabase, initialProfile.id, path)));
      return null;
    });
    if (!message && soundtrack !== undefined) toast(soundtrack ? `Soundtrack set for ${modeMeta[target.slug].name} Mode` : `${modeMeta[target.slug].name} Mode has no soundtrack now`);
    return message;
  }, [initialProfile.id, mode, runNow, setBlocks, signedBlockMedia, supabase, toast]);

  const setSoundtrack = useCallback((block: ProfileBlock, on: boolean) => {
    const target = mode;
    const before = blocksOf(target.id);
    setBlocks(target.id, withSoundtrack(before, block.id, on));
    void runNow(async () => {
      const { error: updateError } = await supabase.from("profile_blocks").update({ is_soundtrack: on }).eq("id", block.id).eq("profile_id", initialProfile.id);
      if (updateError) { setBlocks(target.id, before); return "The soundtrack couldn’t be saved."; }
      return null;
    }).then((failure) => { if (!failure) toast(on ? `Soundtrack set for ${modeMeta[target.slug].name} Mode` : `${modeMeta[target.slug].name} Mode has no soundtrack now`); });
  }, [initialProfile.id, mode, runNow, setBlocks, supabase, toast]);

  const toggleBlock = useCallback((block: ProfileBlock) => {
    const target = mode;
    const visible = !block.is_visible;
    // A hidden block can't be the soundtrack: the database clears it too.
    const wasSoundtrack = Boolean(block.is_soundtrack);
    setBlocks(target.id, blocksOf(target.id).map((item) => item.id === block.id ? { ...item, is_visible: visible, is_soundtrack: visible ? item.is_soundtrack : false } : item));
    void runNow(async () => {
      const { error: updateError } = await supabase.from("profile_blocks").update({ is_visible: visible }).eq("id", block.id).eq("profile_id", initialProfile.id);
      if (updateError) { setBlocks(target.id, blocksOf(target.id).map((item) => item.id === block.id ? { ...item, is_visible: !visible, is_soundtrack: wasSoundtrack } : item)); return "That block couldn’t be updated."; }
      return null;
    }).then((failure) => { if (!failure && wasSoundtrack && !visible) toast(`Music hidden. ${modeMeta[target.slug].name} Mode has no soundtrack now`); });
  }, [initialProfile.id, mode, runNow, setBlocks, supabase, toast]);

  const reorderBlocks = useCallback((ordered: ProfileBlock[]) => {
    const target = mode;
    const before = blocksOf(target.id);
    setBlocks(target.id, ordered.map((block, index) => ({ ...block, sort_order: index })));
    void runNow(async () => {
      const results = await Promise.all(ordered.map((block, index) => supabase.from("profile_blocks").update({ sort_order: index }).eq("id", block.id).eq("profile_id", initialProfile.id)));
      if (results.some((result) => result.error)) { setBlocks(target.id, before); return "The new order couldn’t be saved."; }
      return null;
    });
  }, [initialProfile.id, mode, runNow, setBlocks, supabase]);

  const deleteBlock = useCallback((block: ProfileBlock) => {
    const target = mode;
    const index = blocksOf(target.id).findIndex((item) => item.id === block.id);
    setBlocks(target.id, blocksOf(target.id).filter((item) => item.id !== block.id));
    void runNow(async () => {
      const { error: deleteError } = await supabase.from("profile_blocks").delete().eq("id", block.id).eq("profile_id", initialProfile.id);
      if (deleteError) {
        const restored = [...blocksOf(target.id)]; restored.splice(index, 0, block); setBlocks(target.id, restored);
        return "That block couldn’t be deleted.";
      }
      return null;
    }).then(async (failure) => {
      if (failure) return;
      const mediaPath = typeof block.data.image_path === "string" ? block.data.image_path : typeof block.data.video_path === "string" ? block.data.video_path : null;
      if (mediaPath) {
        await removeContentMediaIfUnused(supabase, initialProfile.id, mediaPath);
        toast(`${BLOCKS[block.kind].name} deleted`);
        return;
      }
      toast(`${block.is_soundtrack ? "Soundtrack" : BLOCKS[block.kind].name} deleted`, { label: "Undo", run: () => {
        void runNow(async () => {
          const result = await insertBlock(target, block.kind, block.data, block.is_visible, Boolean(block.is_soundtrack));
          if (result.error || !result.block) return result.error ?? "That block couldn’t be restored.";
          const others = blocksOf(target.id).filter((item) => item.id !== result.block!.id);
          others.splice(Math.min(index, others.length), 0, result.block);
          setBlocks(target.id, others.map((item, order) => ({ ...item, sort_order: order })));
          await Promise.all(others.map((item, order) => supabase.from("profile_blocks").update({ sort_order: order }).eq("id", item.id).eq("profile_id", initialProfile.id)));
          return null;
        });
      } });
    });
  }, [initialProfile.id, insertBlock, mode, runNow, setBlocks, supabase, toast]);

  // ---------- Photos ----------
  const removeIfUnused = useCallback(async (path: string | null) => {
    await removeContentImageIfUnused(supabase, initialProfile.id, path);
  }, [initialProfile.id, supabase]);

  const pickPhoto = useCallback(() => { photoTarget.current = mode.id; slideTarget.current = false; fileRef.current?.click(); }, [mode.id]);
  const recropPhoto = useCallback(() => {
    if (!mode.image_url || !mode.image_path) return;
    const kept = readCrop(mode.image_crop);
    if (mode.image_original_url && mode.image_original_path && kept) {
      setCrop({ source: mode.image_original_url, modeId: mode.id, revoke: false, focus: modeFocus(mode), initialCrop: kept, keepOriginal: mode.image_original_path });
      return;
    }
    // Saved before originals were kept: the saved photo is all there is, and becomes the original.
    setCrop({ source: mode.image_url, modeId: mode.id, revoke: false, focus: modeFocus(mode), keepOriginal: mode.image_path, savedOnly: true });
  }, [mode]);

  /**
   * Saves a Mode photo: the 4:5 crop as image_path (avatars, share cards and older surfaces use it),
   * and the original it was cut from with the crop as metadata, which every profile surface frames
   * from. `original` is a new upload, or the path of the original already in Storage (re-crop).
   */
  const savePhoto = useCallback(async (modeId: string, blob: Blob, focus: PhotoFocus, original: { blob: Blob; crop: PhotoCropValue } | { path: string; crop: PhotoCropValue }) => {
    setBusyPhoto(true);
    const target = modesRef.current.find((item) => item.id === modeId);
    const failure = await runNow(async () => {
      if (!target) return "That Mode couldn’t be found.";
      const path = `${initialProfile.id}/${crypto.randomUUID()}.webp`;
      const originalPath = "path" in original ? original.path : `${initialProfile.id}/${crypto.randomUUID()}.webp`;
      const uploads = [supabase.storage.from(MEDIA).upload(path, blob, { contentType: "image/webp", upsert: false })];
      if ("blob" in original) uploads.push(supabase.storage.from(MEDIA).upload(originalPath, original.blob, { contentType: "image/webp", upsert: false }));
      const uploaded = await Promise.all(uploads);
      const fresh = "blob" in original ? [path, originalPath] : [path];
      if (uploaded.some((result) => result.error)) { await supabase.storage.from(MEDIA).remove(fresh); return "The photo couldn’t be uploaded. Use a JPEG, PNG or WebP under 15 MB."; }
      const row = { image_path: path, image_original_path: originalPath, image_crop: original.crop, image_focus_x: focus.x, image_focus_y: focus.y };
      const { error: updateError } = await supabase.from("profile_modes").update(row).eq("id", modeId).eq("profile_id", initialProfile.id);
      if (updateError) { await supabase.storage.from(MEDIA).remove(fresh); return "The photo uploaded but couldn’t be attached."; }
      const { data: signed } = await supabase.storage.from(MEDIA).createSignedUrls([path, originalPath], 3600);
      const previous = [target.image_path, target.image_original_path];
      patchMode(modeId, {
        ...row,
        image_url: signed?.[0]?.signedUrl ?? URL.createObjectURL(blob),
        image_original_url: signed?.[1]?.signedUrl ?? ("blob" in original ? URL.createObjectURL(original.blob) : target.image_original_url ?? target.image_url ?? null),
      });
      for (const old of previous) if (old && old !== path && old !== originalPath) await removeIfUnused(old);
      return null;
    });
    setBusyPhoto(false);
    if (!failure) toast(`Photo updated in ${modeMeta[target?.slug ?? "personal"].name} Mode`);
  }, [initialProfile.id, patchMode, removeIfUnused, runNow, supabase, toast]);

  const removePhoto = useCallback(() => {
    const target = mode;
    if (!target.image_path) return;
    const previous = photoFields(target);
    patchMode(target.id, { image_path: null, image_url: null, image_original_path: null, image_original_url: null, image_crop: null, image_focus_x: null, image_focus_y: null });
    void runNow(async () => {
      const { error: updateError } = await supabase.from("profile_modes").update({ image_path: null, image_original_path: null, image_crop: null, image_focus_x: null, image_focus_y: null }).eq("id", target.id).eq("profile_id", initialProfile.id);
      if (updateError) { patchMode(target.id, previous); return "The photo couldn’t be removed."; }
      await removeIfUnused(previous.image_path);
      await removeIfUnused(previous.image_original_path);
      return null;
    });
  }, [initialProfile.id, mode, patchMode, removeIfUnused, runNow, supabase]);

  // Extra slideshow photos after the main one: Plus adds one, Pro three. The database enforces it too.
  const pickSlide = useCallback(() => {
    if (!extraSlideLimit(plan)) { setPlusSheet({ kind: "advanced" }); return; }
    photoTarget.current = mode.id;
    slideTarget.current = true;
    fileRef.current?.click();
  }, [mode.id, plan]);

  const saveSlide = useCallback(async (modeId: string, blob: Blob, focus: PhotoFocus) => {
    setBusyPhoto(true);
    const target = modesRef.current.find((item) => item.id === modeId);
    const failure = await runNow(async () => {
      if (!target) return "That Mode couldn’t be found.";
      const current = target.slide_photos ?? [];
      if (current.length >= extraSlideLimit(plan)) return plan === "pro" ? "Your slideshow is full. Remove a photo first." : "Pro slideshows hold up to four photos.";
      const path = `${initialProfile.id}/${crypto.randomUUID()}.webp`;
      const { error: uploadError } = await supabase.storage.from(MEDIA).upload(path, blob, { contentType: "image/webp", upsert: false });
      if (uploadError) return "The photo couldn’t be uploaded. Use a JPEG, PNG or WebP under 5 MB.";
      const next = [...current, { path, x: focus.x, y: focus.y }];
      const { error: updateError } = await supabase.from("profile_modes").update({ slide_photos: next }).eq("id", modeId).eq("profile_id", initialProfile.id);
      if (updateError) {
        await supabase.storage.from(MEDIA).remove([path]);
        return updateError.message.includes("slideshow_requires_plan") ? "Slideshows need Plus. Pro holds up to four photos." : "The photo uploaded but couldn’t be added to the slideshow.";
      }
      const { data: signed } = await supabase.storage.from(MEDIA).createSignedUrl(path, 3600);
      patchMode(modeId, { slide_photos: next, slide_urls: [...(target.slide_urls ?? []), { url: signed?.signedUrl ?? URL.createObjectURL(blob), x: focus.x, y: focus.y }] });
      return null;
    });
    setBusyPhoto(false);
    if (!failure) toast("Added to your slideshow");
  }, [initialProfile.id, patchMode, plan, runNow, supabase, toast]);

  const removeSlide = useCallback((index: number) => {
    const target = mode;
    const photos = target.slide_photos ?? [];
    const removed = photos[index];
    if (!removed) return;
    const previous = { slide_photos: photos, slide_urls: target.slide_urls ?? [] };
    const next = photos.filter((_, at) => at !== index);
    patchMode(target.id, { slide_photos: next, slide_urls: previous.slide_urls.filter((_, at) => at !== index) });
    void runNow(async () => {
      const { error: updateError } = await supabase.from("profile_modes").update({ slide_photos: next }).eq("id", target.id).eq("profile_id", initialProfile.id);
      if (updateError) { patchMode(target.id, previous); return "That photo couldn’t be removed from the slideshow."; }
      await removeIfUnused(removed.path);
      return null;
    });
  }, [initialProfile.id, mode, patchMode, removeIfUnused, runNow, supabase]);

  const usePhotoFrom = useCallback((source: ModeSlug) => {
    const from = modesRef.current.find((item) => item.slug === source);
    const target = mode;
    if (!from?.image_path || from.id === target.id) return;
    const previous = photoFields(target);
    // The photo's original, crop and face point travel with it, so it frames the same way in this Mode.
    const row = { image_path: from.image_path, image_original_path: from.image_original_path ?? null, image_crop: from.image_crop ?? null, image_focus_x: from.image_focus_x ?? null, image_focus_y: from.image_focus_y ?? null };
    patchMode(target.id, { ...row, image_url: from.image_url, image_original_url: from.image_original_url ?? null });
    void runNow(async () => {
      const { error: updateError } = await supabase.from("profile_modes").update(row).eq("id", target.id).eq("profile_id", initialProfile.id);
      if (updateError) { patchMode(target.id, previous); return "That photo couldn’t be used here."; }
      await removeIfUnused(previous.image_path);
      await removeIfUnused(previous.image_original_path);
      return null;
    }).then((failure) => { if (!failure) toast(`Using your ${modeMeta[source].name} photo`); });
  }, [initialProfile.id, mode, patchMode, removeIfUnused, runNow, supabase, toast]);

  // ---------- Rewards ----------
  const equipReward = useCallback(async (category: RewardCategory, rewardId: string) => {
    const failure = await runNow(async () => {
      const { error: selectError } = await supabase.rpc("set_passport_reward", { p_category: category, p_reward_id: rewardId });
      return selectError ? "That reward is locked or couldn’t be equipped." : null;
    });
    if (!failure) { setSelectedRewards((current) => ({ ...current, [category]: rewardId })); toast(`${PASSPORT_REWARDS.find((reward) => reward.id === rewardId)?.name ?? "Reward"} equipped`); }
  }, [runNow, supabase, toast]);

  // ---------- Navigation ----------
  const go = useCallback((nextSection: Section, nextSlug?: ModeSlug) => {
    if (pending.current.size) void flush();
    const targetSlug = nextSlug ?? slug;
    setSection(nextSection);
    setSlug(targetSlug);
    const query = new URLSearchParams({ mode: targetSlug });
    if (nextSection !== "home") query.set("section", nextSection);
    // Let Next's native-history integration update the canonical URL as well.
    // Passing its internal history state bypasses that integration, so a
    // Server Action revalidation can restore the previously opened section.
    window.history.replaceState(null, "", `/app/identity?${query.toString()}`);
    document.getElementById("editor-scroll")?.scrollTo({ top: 0 });
    window.scrollTo({ top: 0 });
  }, [flush, slug]);

  const [modeShareUrls, setModeShareUrls] = useState(initialModeShareUrls);
  // Regenerates one Mode's link; every older link to that Mode stops opening.
  const regenerateShareLink = useCallback(async (target: ModeSlug) => {
    const current = modeShareUrls[target]?.match(/\/s\/([0-9A-Za-z]{8})$/)?.[1];
    if (target === "personal" || !current) return false;
    try {
      const response = await fetch("/api/share/mode-link", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode: target, current }),
      });
      const payload = await response.json().catch(() => null) as { path?: unknown } | null;
      if (!response.ok || typeof payload?.path !== "string" || !/^\/s\/[0-9A-Za-z]{8}$/.test(payload.path)) return false;
      const path = payload.path;
      setModeShareUrls((urls) => ({ ...urls, [target]: `${publicOrigin}${path}` }));
      return true;
    } catch {
      return false;
    }
  }, [modeShareUrls, publicOrigin]);
  const [modeHandles, setModeHandles] = useState(initialModeHandles);
  const setModeHandle = useCallback((target: ModeHandleSlug, state: ModeHandleState | null) => {
    setModeHandles((current) => {
      const next = { ...current };
      if (state) next[target] = state; else delete next[target];
      return next;
    });
  }, []);
  // A live handle is the Mode's public link; the /s/ link keeps working behind it.
  const publicUrl = useCallback((target: ModeSlug, source?: string) => {
    const live = isModeHandleSlug(target) && modeHandles[target]?.is_live ? `${publicOrigin}/${modeHandles[target].handle}` : null;
    return publicModeUrl({ origin: publicOrigin, username: savedUsername, shareUrls: live ? { [target]: live } : modeShareUrls, mode: target, source });
  }, [publicOrigin, savedUsername, modeShareUrls, modeHandles]);
  const shortUrl = useCallback((target: ModeSlug) => modeShareUrls[target] ?? null, [modeShareUrls]);

  const requestCapability = useCallback((capability: CapabilityKey) => {
    setPaywallCapability(capability);
  }, []);
  const closePaywall = useCallback(() => setPaywallCapability(null), []);

  const api: EditorApi = {
    actionsLive, profile, modes, mode, slug, section, publicOrigin, fieldErrors, usernameStatus, unlockedRewards, selectedRewards, busyPhoto, memberTier, plan,
    updateProfile, updateSetting, updateAppearance, requestCapability,
    appearancePreview: appearancePreviews[mode?.id ?? ""] ?? null, chooseAppearance, clearAppearancePreview, applyAppearancePreview, resetAppearance, openPlusSheet: setPlusSheet, setModeEnabled, setConnectPolicy, initialShareIntent, setPublished,
    addLink, editLink, toggleLink, deleteLink, reorderLinks, copyLinksFrom,
    addBlock, updateBlock, toggleBlock, deleteBlock, reorderBlocks, setSoundtrack,
    pickPhoto, recropPhoto, removePhoto, usePhotoFrom, pickSlide, removeSlide, equipReward, go, toast, publicUrl, regenerateShareLink, shortUrl, modeHandles, setModeHandle,
  };

  if (!mode) return <main className="grid min-h-dvh place-items-center p-8 text-sm">Your Modes are being prepared.</main>;

  const personalMode = modes.find((item) => item.slug === "personal");
  const publishButton = profile.is_published
    ? <a className="inline-flex min-h-11 items-center gap-2 rounded-full bg-black/[0.06] px-4 text-sm font-semibold text-black/70 transition hover:bg-black/10" href={publicUrl(slug)} rel="noreferrer" target="_blank"><span aria-hidden="true" className="size-2 rounded-full bg-[#2BB673]" />Live</a>
    : <button className="inline-flex min-h-11 items-center rounded-full bg-[#FF5A4F] px-5 text-sm font-semibold text-[#0D0D0D] transition hover:brightness-95" onClick={() => void setPublished(true)} type="button">Publish</button>;

  // A Mode that is off still edits normally; one quiet line says why its link won't open.
  const modeOff = !mode.is_enabled && (section === "profile" || section === "links" || section === "appearance");
  const content = (
    <>
      {modeOff && (
        <div className="mb-5 flex items-center justify-between gap-3 rounded-[16px] bg-[#0D0D0D]/[0.05] py-2 pl-4 pr-2 text-[13px]" data-mode-off-notice>
          <p className="min-w-0"><span className="font-semibold">{modeMeta[slug].name} Mode is off.</span> <span className="text-black/60">Its link doesn’t open until you turn it on.</span></p>
          <button className="min-h-9 shrink-0 rounded-full bg-[#0D0D0D] px-3.5 text-[13px] font-semibold text-[#F5F4EF]" onClick={() => void setModeEnabled(true)} type="button">Turn on</button>
        </div>
      )}
      {section === "home" && <HomeSection api={api} key={slug} />}
      {section === "profile" && <ProfileSection api={api} />}
      {section === "links" && <ContentSection api={api} key={slug} />}
      {section === "appearance" && <AppearanceSection api={api} />}
      {section === "settings" && <SettingsSection api={api} />}
      {section === "share" && <ShareSection api={api} />}
    </>
  );

  return (
    <div className={`${marketingFontClasses} min-h-dvh bg-[#F5F4EF] font-brand text-[#0D0D0D] lg:flex lg:h-dvh lg:flex-col lg:overflow-hidden lg:pl-[268px]`} style={{ "--editor-dock": !peekable ? "0px" : peekOpen ? "min(46dvh, 420px)" : "52px" } as CSSProperties}>
      <EditorSidebar avatarFocus={personalMode ? modeFocus(personalMode) : undefined} avatarUrl={personalMode?.image_url ?? null} inPlace liveUrl={publicUrl(slug)} modes={modes} onGo={go} personalUrl={profile.username ? publicUrl("personal") : null} plan={plan} profile={profile} section={section} signOut={signOut} slug={slug} />

      {/* Desktop top bar: the Mode, its page sections as tabs, save state, preview and publish. */}
      <header className="hidden shrink-0 border-b border-black/[0.08] pl-8 pr-6 lg:block xl:pl-11">
        <div className="flex h-[68px] items-center justify-between gap-5">
          <div className="flex min-w-0 items-center gap-2.5">
            <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full" style={{ background: MODE_DOT[slug], opacity: mode.is_enabled ? 1 : 0.4 }} />
            <h1 className="truncate font-display text-[22px] font-bold tracking-[-0.035em]">{modeMeta[slug].name} Mode</h1>
            {!mode.is_enabled && <span className="shrink-0 rounded-full bg-black/[0.06] px-2 py-0.5 font-label text-[10px] uppercase tracking-[0.12em] text-black/55">Off</span>}
          </div>
          <div className="flex items-center gap-3">
            <SaveChip justPublished={justPublished} message={statusMessage} onRetry={retry} status={status} />
            <button className="inline-flex min-h-11 items-center rounded-full px-[18px] text-sm font-semibold shadow-[inset_0_0_0_1.5px_#0D0D0D] transition hover:bg-black/[0.04] xl:hidden" onClick={() => setFullPreview(true)} type="button">Preview</button>
            <button className="hidden min-h-11 items-center rounded-full px-[18px] text-sm font-semibold shadow-[inset_0_0_0_1.5px_#0D0D0D] transition hover:bg-black/[0.04] xl:inline-flex" onClick={() => setFullPreview(true)} type="button">Full preview</button>
            {publishButton}
          </div>
        </div>
        <nav aria-label={`${modeMeta[slug].name} Mode page`} className="-mb-px flex gap-1 overflow-x-auto [scrollbar-width:none]">
          {PAGE_TABS.map((tab) => {
            const active = section === tab.id;
            return (
              <button aria-current={active ? "page" : undefined} className={`relative min-h-11 shrink-0 px-3 text-[14px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-4px] ${active ? "font-semibold text-[#0D0D0D]" : "font-medium text-black/55 hover:text-[#0D0D0D]"}`} key={tab.id} onClick={() => go(tab.id)} type="button">
                {tab.label}
                <span aria-hidden="true" className={`absolute inset-x-3 bottom-0 h-[2px] rounded-full ${active ? "bg-[#0D0D0D]" : "bg-transparent"}`} />
              </button>
            );
          })}
        </nav>
      </header>

      {/* Phone: the Mode (tap to switch), its sections and tools in one strip, preview and publish. */}
      <MobileModeHeader
        below={<MobileSaveLine justPublished={justPublished} message={statusMessage} onRetry={retry} status={status} />}
        modes={modes.map((item) => ({ slug: item.slug, enabled: item.is_enabled }))}
        onMode={(next) => go("home", next)}
        onSection={(next) => go(next as Section)}
        place={sectionPlace(section)}
        right={<>
          <button aria-label="Full-screen preview" className="grid size-10 shrink-0 place-items-center rounded-full shadow-[inset_0_0_0_1.5px_rgba(13,13,13,.85)] transition active:scale-[.96]" onClick={() => setFullPreview(true)} type="button"><svg aria-hidden="true" className="size-[18px]" fill="currentColor" viewBox="0 0 24 24"><path d="M12 5c5 0 8.6 4.2 9.8 6.4a1.3 1.3 0 0 1 0 1.2C20.6 14.8 17 19 12 19s-8.6-4.2-9.8-6.4a1.3 1.3 0 0 1 0-1.2C3.4 9.2 7 5 12 5Zm0 3.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z" /></svg></button>
          {profile.is_published
            ? <a aria-label="Your Setuvara is live. Open it." className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full bg-black/[0.06] px-3 text-[13px] font-semibold text-black/70" href={publicUrl(slug)} rel="noreferrer" target="_blank"><span aria-hidden="true" className="size-2 rounded-full bg-[#2BB673]" />Live</a>
            : <button className="inline-flex min-h-10 shrink-0 items-center rounded-full bg-[#FF5A4F] px-3.5 text-[13px] font-semibold" onClick={() => void setPublished(true)} type="button">Publish</button>}
        </>}
        slug={slug}
      />

      <div className="lg:grid lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,1fr)] xl:grid-cols-[minmax(0,1fr)_minmax(400px,38%)] 2xl:grid-cols-[minmax(0,1fr)_minmax(460px,38%)]">
        {/* Content */}
        <main className="min-w-0 lg:min-h-0 lg:overflow-y-auto" id="editor-scroll">
          <div className={`mx-auto w-full max-w-[720px] px-4 pb-36 pt-6 sm:px-6 lg:px-10 lg:pb-16 lg:pt-10 xl:px-11 ${section === "home" ? "max-lg:hidden" : ""}`}>{content}</div>
          {section === "home" && <div className="px-4 pb-32 pt-5 sm:px-6 lg:hidden"><MobileHome api={api} onPreview={() => setFullPreview(true)} /></div>}
          {/* Room to scroll the last controls above the docked preview. */}
          {peekable && <div aria-hidden="true" className="lg:hidden" style={{ height: "var(--editor-dock)" }} />}
        </main>

        {/* Live preview */}
        <aside aria-label="Live preview" className="hidden min-h-0 overflow-y-auto border-l border-black/[0.08] bg-[#ECEAE3] xl:block">
          <PreviewPane api={api} previewState={previewState} setPreviewState={setPreviewState} soundIntro={soundIntro} />
        </aside>
      </div>

      <MobileTabBar />

      {peekable && <PeekPreview api={api} onExpand={() => setFullPreview(true)} onToggle={() => peekStore.write(!peekOpen)} open={peekOpen} previewState={previewState} setPreviewState={setPreviewState} />}
      {fullPreview && <FullPreview api={api} onClose={() => setFullPreview(false)} previewState={previewState} setPreviewState={setPreviewState} soundIntro={soundIntro} />}
      {crop && <CropDialog key={crop.source} busy={busyPhoto} initialCrop={crop.initialCrop} initialFocus={crop.focus} onCancel={() => { if (crop.revoke) URL.revokeObjectURL(crop.source); setCrop(null); }} onReplace={() => { photoTarget.current = crop.modeId; slideTarget.current = Boolean(crop.slide); fileRef.current?.click(); }} onSave={async ({ pixels, crop: area, natural, focus }) => {
        try {
          const blob = await cropToBlob(crop.source, pixels);
          const target = crop.modeId;
          if (crop.slide) {
            if (crop.revoke) URL.revokeObjectURL(crop.source);
            setCrop(null);
            await saveSlide(target, blob, focus);
            return;
          }
          // Keep the whole photo beside the crop: the new upload (capped), or the original already stored.
          const original = crop.keepOriginal
            ? { path: crop.keepOriginal, crop: { ...area, width: natural.width, height: natural.height } }
            : await originalToBlob(crop.source).then((kept) => ({ blob: kept.blob, crop: { ...area, width: kept.width, height: kept.height } }));
          if (crop.revoke) URL.revokeObjectURL(crop.source);
          setCrop(null);
          await savePhoto(target, blob, focus, original);
        } catch { toast("That photo couldn’t be prepared. Try a different file."); }
      }} preview={crop.slide ? undefined : (pending) => <PhotoPreviews api={api} pending={pending} />} savedOnly={crop.savedOnly} source={crop.source} />}

      <input accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => {
        const file = event.currentTarget.files?.[0];
        event.currentTarget.value = "";
        if (!file) return;
        if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) { toast("Choose a JPEG, PNG or WebP image."); return; }
        if (file.size > 15 * 1024 * 1024) { toast("That image is too large. Choose one under 15 MB."); return; }
        if (crop?.revoke) URL.revokeObjectURL(crop.source);
        setCrop({ source: URL.createObjectURL(file), modeId: photoTarget.current ?? mode.id, revoke: true, slide: slideTarget.current });
      }} ref={fileRef} type="file" />

      {toastState && (
        <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-5 z-[90] flex justify-center px-4 max-lg:bottom-[calc(140px+var(--editor-dock)+env(safe-area-inset-bottom))]" key={toastState.id}>
          <div className="pointer-events-auto flex min-h-12 max-w-md items-center gap-4 rounded-full bg-[#0D0D0D] py-1.5 pl-5 pr-1.5 text-sm font-semibold text-[#F5F4EF] shadow-[0_18px_50px_-18px_rgba(13,13,13,.7)] [animation:toast-in_.22s_ease-out]">
            <span className="py-2">{toastState.text}</span>
            {toastState.action ? <button className="min-h-9 rounded-full bg-[#F5F4EF] px-4 text-[13px] text-[#0D0D0D]" onClick={() => { toastState.action?.run(); setToastState(null); }} type="button">{toastState.action.label}</button> : <span className="w-3" />}
          </div>
        </div>
      )}
      {paywallCapability && <FeaturePaywall capability={paywallCapability} onClose={closePaywall} />}
      {plusSheet && <AppearancePlusSheet currentName={APPEARANCE_NAMES[resolveAppearance(mode, plan).id]} modeLabel={mode.label} onClose={() => setPlusSheet(null)} plan={plan} trigger={plusSheet} />}
      <CelebrationClient name={PASSPORT_REWARDS.find((reward) => reward.milestone === celebrationThreshold)?.name ?? (celebrationThreshold ? `${celebrationThreshold} Connections` : null)} threshold={celebrationThreshold} />
    </div>
  );
}

/** Whether the phone's docked live preview is open (folded by default). Remembered on this device only. */
const PEEK_KEY = "setuvara:editor-dock";
const peekListeners = new Set<() => void>();
let peekOpenHere = false;
const peekStore = {
  subscribe(listener: () => void) { peekListeners.add(listener); return () => { peekListeners.delete(listener); }; },
  read() { try { return window.localStorage.getItem(PEEK_KEY) === "open"; } catch { return peekOpenHere; } },
  write(open: boolean) {
    peekOpenHere = open;
    try { if (open) window.localStorage.setItem(PEEK_KEY, "open"); else window.localStorage.removeItem(PEEK_KEY); } catch { /* private mode: remembered for this visit only */ }
    peekListeners.forEach((listener) => listener());
  },
};

const MOBILE_TABS: { id: Section; label: string }[] = [
  { id: "home", label: "Overview" },
  { id: "profile", label: "Profile" },
  { id: "links", label: "Content" },
  { id: "appearance", label: "Appearance" },
  { id: "share", label: "Share" },
];
/** Desktop tabs: the phone's sections plus the Mode's settings. */
const PAGE_TABS: { id: Section; label: string }[] = [...MOBILE_TABS, { id: "settings", label: "Settings" }];


function SaveChip({ status, message, justPublished, onRetry }: { status: SaveStatus; message: string; justPublished: boolean; onRetry: () => void }) {
  if (justPublished && status === "saved") return <span className="inline-flex min-h-9 items-center rounded-full bg-[#C7FF4A] px-3.5 text-sm font-semibold">Published · just now</span>;
  if (status === "error") return <button className="inline-flex min-h-9 max-w-[280px] items-center gap-2 rounded-full px-3 text-sm font-semibold text-[#B42318] hover:bg-[#B42318]/[0.06]" onClick={onRetry} title={message} type="button"><span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-[#B42318]" /><span className="truncate">Not saved · Retry</span></button>;
  if (status === "saving" || status === "pending") return <span aria-live="polite" className="inline-flex min-h-9 items-center gap-2 px-2 text-sm text-black/60"><span aria-hidden="true" className="size-3.5 animate-spin rounded-full border-2 border-black/20 border-t-black/70" />Saving…</span>;
  return <span aria-live="polite" className="inline-flex min-h-9 items-center gap-1.5 px-2 text-sm text-black/60"><span aria-hidden="true">✓</span>Saved</span>;
}

function MobileSaveLine({ status, message, justPublished, onRetry }: { status: SaveStatus; message: string; justPublished: boolean; onRetry: () => void }) {
  // Saving and Saved live under the title; this line only carries a publish or a failed save.
  if (status !== "error" && !(justPublished && status === "saved")) return null;
  return (
    <div className="flex items-center justify-center gap-2 border-t border-black/5 px-4 py-1.5 text-[12px] font-medium" style={{ background: justPublished && status === "saved" ? "#C7FF4A" : undefined }}>
      {status === "error" ? <button className="font-semibold text-[#B42318]" onClick={onRetry} type="button">{message || "Not saved"} · Retry</button>
        : status === "saved" ? "Published · every share surface is up to date"
          : <span className="text-black/60">Saving…</span>}
    </div>
  );
}

/** A Mode's photo columns, to restore them if a write fails. */
function photoFields(mode: ProfileMode) {
  return {
    image_path: mode.image_path,
    image_url: mode.image_url ?? null,
    image_original_path: mode.image_original_path ?? null,
    image_original_url: mode.image_original_url ?? null,
    image_crop: mode.image_crop ?? null,
    image_focus_x: mode.image_focus_x ?? null,
    image_focus_y: mode.image_focus_y ?? null,
  };
}
