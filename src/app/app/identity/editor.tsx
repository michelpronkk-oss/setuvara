"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";

import { marketingFontClasses } from "@/app/(marketing)/fonts";
import { MeetMark } from "@/components/marketing/brand";
import type { ModeAppearance, ModeSlug, ProfileIdentity, ProfileLink, ProfileMode } from "@/components/profile/types";
import { createClient } from "@/lib/supabase/client";
import { resolveStoredLink, providerForLink, type LinkProvider } from "@/lib/links/providers";
import { PASSPORT_REWARDS, type RewardCategory } from "@/lib/passport/rewards";
import { isAllowedUsername } from "@/lib/usernames";
import { CelebrationClient } from "../passport/passport-dashboard";
import { createProviderLink, updateProviderLink } from "./actions";
import { CropDialog, cropToBlob } from "./editor-crop";
import { FullPreview, PreviewPane } from "./editor-preview";
import { AppearanceSection, HomeSection, LinksSection, MobileHome, ProfileSection, SettingsSection, ShareSection } from "./editor-sections";
import { MODE_SLUGS, SECTIONS, SETTING_KEYS, LAYOUTS, type EditableProfile, type EditorApi, type PreviewState, type Section, type UsernameStatus } from "./editor-types";
import { modeMeta } from "./editor-ui";

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

type SaveStatus = "saved" | "pending" | "saving" | "error";
type Task = () => Promise<string | null>;

const profileSchema = z.object({
  username: z.string().trim().regex(/^[a-z0-9_]{3,24}$/, "Use 3–24 lowercase letters, numbers or underscores."),
  display_name: z.string().trim().min(1, "Add the name people know you by.").max(80, "Keep your name under 80 characters."),
  bio: z.string().max(280, "Keep this under 280 characters."),
});
const SAVE_DELAY = 650;
const MEDIA = "profile-media";

function isSection(value: string): value is Section {
  return value === "home" || SECTIONS.some((section) => section.id === value);
}

export function IdentityEditor({ initialProfile, initialModes, initialMode, initialSection, publicOrigin, error, signOut, unlockedRewards, selectedRewards: initialSelectedRewards, celebrationThreshold }: EditorProps) {
  const [profile, setProfile] = useState(initialProfile);
  const [modes, setModes] = useState(initialModes);
  const [slug, setSlug] = useState<ModeSlug>(initialMode);
  const [section, setSection] = useState<Section>(isSection(initialSection) ? initialSection : "home");
  const [selectedRewards, setSelectedRewards] = useState(initialSelectedRewards);
  const [previewState, setPreviewState] = useState<PreviewState>("owner");
  const [fullPreview, setFullPreview] = useState(false);
  const [status, setStatus] = useState<SaveStatus>("saved");
  const [statusMessage, setStatusMessage] = useState(error ? "Something didn’t save last time. Check your details." : "");
  const [justPublished, setJustPublished] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [savedUsername, setSavedUsername] = useState(initialProfile.username);
  const [usernameCheck, setUsernameCheck] = useState<{ candidate: string; result: UsernameStatus } | null>(null);
  const [toastState, setToastState] = useState<{ id: number; text: string; action?: { label: string; run: () => void } } | null>(null);
  const [crop, setCrop] = useState<{ source: string; modeId: string; revoke: boolean } | null>(null);
  const [busyPhoto, setBusyPhoto] = useState(false);

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
    const { error: updateError } = await supabase.from("profiles").update(values).eq("id", initialProfile.id);
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
    const settings: Record<string, string> = {};
    for (const [key, max] of Object.entries(limits)) {
      const value = current.settings[key];
      if (typeof value !== "string") continue;
      if (value.length > max) return `Keep that under ${max} characters.`;
      settings[key] = value.trim();
    }
    const appearance = current.appearance;
    if (!validAppearance(current.slug, appearance)) return "That look isn’t available for this Mode.";
    const { error: updateError } = await supabase.from("profile_modes").update({ settings, appearance }).eq("id", modeId).eq("profile_id", initialProfile.id);
    return updateError ? `${modeMeta[current.slug].name} Mode couldn’t be saved. Try again.` : null;
  }, [initialProfile.id, supabase]);

  const updateSetting = useCallback((key: string, value: string) => {
    const current = modesRef.current.find((item) => item.slug === slug);
    if (!current) return;
    patchMode(current.id, { settings: { ...current.settings, [key]: value } });
    schedule(`mode:${current.id}`, saveModeTask(current.id));
  }, [patchMode, saveModeTask, schedule, slug]);

  const updateAppearance = useCallback((patch: Partial<ModeAppearance>) => {
    const current = modesRef.current.find((item) => item.slug === slug);
    if (!current) return;
    patchMode(current.id, { appearance: { ...current.appearance, ...patch } });
    schedule(`mode:${current.id}`, saveModeTask(current.id));
  }, [patchMode, saveModeTask, schedule, slug]);

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

  // ---------- Photos ----------
  const removeIfUnused = useCallback(async (path: string | null) => {
    if (!path || modesRef.current.some((item) => item.image_path === path)) return;
    await supabase.storage.from(MEDIA).remove([path]);
  }, [supabase]);

  const pickPhoto = useCallback(() => { photoTarget.current = mode.id; fileRef.current?.click(); }, [mode.id]);
  const recropPhoto = useCallback(() => { if (mode.image_url) setCrop({ source: mode.image_url, modeId: mode.id, revoke: false }); }, [mode.id, mode.image_url]);

  const savePhoto = useCallback(async (modeId: string, blob: Blob) => {
    setBusyPhoto(true);
    const target = modesRef.current.find((item) => item.id === modeId);
    const failure = await runNow(async () => {
      if (!target) return "That Mode couldn’t be found.";
      const path = `${initialProfile.id}/${crypto.randomUUID()}.webp`;
      const { error: uploadError } = await supabase.storage.from(MEDIA).upload(path, blob, { contentType: "image/webp", upsert: false });
      if (uploadError) return "The photo couldn’t be uploaded. Use a JPEG, PNG or WebP under 5 MB.";
      const { error: updateError } = await supabase.from("profile_modes").update({ image_path: path }).eq("id", modeId).eq("profile_id", initialProfile.id);
      if (updateError) { await supabase.storage.from(MEDIA).remove([path]); return "The photo uploaded but couldn’t be attached."; }
      const { data: signed } = await supabase.storage.from(MEDIA).createSignedUrl(path, 3600);
      const previous = target.image_path;
      patchMode(modeId, { image_path: path, image_url: signed?.signedUrl ?? URL.createObjectURL(blob) });
      await removeIfUnused(previous);
      return null;
    });
    setBusyPhoto(false);
    if (!failure) toast(`Photo updated in ${modeMeta[target?.slug ?? "personal"].name} Mode`);
  }, [initialProfile.id, patchMode, removeIfUnused, runNow, supabase, toast]);

  const removePhoto = useCallback(() => {
    const target = mode;
    if (!target.image_path) return;
    const previous = { image_path: target.image_path, image_url: target.image_url };
    patchMode(target.id, { image_path: null, image_url: null });
    void runNow(async () => {
      const { error: updateError } = await supabase.from("profile_modes").update({ image_path: null }).eq("id", target.id).eq("profile_id", initialProfile.id);
      if (updateError) { patchMode(target.id, previous); return "The photo couldn’t be removed."; }
      await removeIfUnused(previous.image_path);
      return null;
    });
  }, [initialProfile.id, mode, patchMode, removeIfUnused, runNow, supabase]);

  const usePhotoFrom = useCallback((source: ModeSlug) => {
    const from = modesRef.current.find((item) => item.slug === source);
    const target = mode;
    if (!from?.image_path || from.id === target.id) return;
    const previous = { image_path: target.image_path, image_url: target.image_url };
    patchMode(target.id, { image_path: from.image_path, image_url: from.image_url });
    void runNow(async () => {
      const { error: updateError } = await supabase.from("profile_modes").update({ image_path: from.image_path }).eq("id", target.id).eq("profile_id", initialProfile.id);
      if (updateError) { patchMode(target.id, previous); return "That photo couldn’t be used here."; }
      await removeIfUnused(previous.image_path);
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
    window.history.replaceState(window.history.state, "", `/app/identity?${query.toString()}`);
    document.getElementById("editor-scroll")?.scrollTo({ top: 0 });
    window.scrollTo({ top: 0 });
  }, [flush, slug]);

  const publicUrl = useCallback((target: ModeSlug, source?: string) => {
    const query = new URLSearchParams();
    if (target !== "personal") query.set("mode", target);
    if (source) query.set("source", source);
    const suffix = query.toString();
    return `${publicOrigin}/${savedUsername}${suffix ? `?${suffix}` : ""}`;
  }, [publicOrigin, savedUsername]);

  const api: EditorApi = {
    profile, modes, mode, slug, section, publicOrigin, fieldErrors, usernameStatus, unlockedRewards, selectedRewards, busyPhoto,
    updateProfile, updateSetting, updateAppearance, setModeEnabled, setPublished,
    addLink, editLink, toggleLink, deleteLink, reorderLinks, copyLinksFrom,
    pickPhoto, recropPhoto, removePhoto, usePhotoFrom, equipReward, go, toast, publicUrl,
  };

  if (!mode) return <main className="grid min-h-dvh place-items-center p-8 text-sm">Your Modes are being prepared.</main>;

  const sectionTitle = SECTIONS.find((item) => item.id === section)?.short ?? "Profile";
  const publishButton = profile.is_published
    ? <a className="inline-flex min-h-11 items-center gap-2 rounded-full bg-black/[0.06] px-4 text-sm font-semibold text-black/70 transition hover:bg-black/10" href={publicUrl(slug)} rel="noreferrer" target="_blank"><span aria-hidden="true" className="size-2 rounded-full bg-[#2BB673]" />Live</a>
    : <button className="inline-flex min-h-11 items-center rounded-full bg-[#FF5A4F] px-5 text-sm font-semibold text-[#0D0D0D] transition hover:brightness-95" onClick={() => void setPublished(true)} type="button">Publish</button>;

  const content = (
    <>
      {section === "home" && <HomeSection api={api} key={slug} />}
      {section === "profile" && <ProfileSection api={api} />}
      {section === "links" && <LinksSection api={api} key={slug} />}
      {section === "appearance" && <AppearanceSection api={api} />}
      {section === "settings" && <SettingsSection api={api} />}
      {section === "share" && <ShareSection api={api} />}
    </>
  );

  return (
    <div className={`${marketingFontClasses} min-h-dvh bg-[#F5F4EF] font-brand text-[#0D0D0D] lg:flex lg:h-dvh lg:flex-col lg:overflow-hidden`}>
      {/* Desktop top bar */}
      <header className="hidden h-[72px] shrink-0 items-center justify-between gap-5 border-b border-black/10 pl-7 pr-6 lg:flex">
        <div className="flex min-w-0 items-center gap-3">
          <Link aria-label="Back to Setuvara home" className="flex items-center gap-2.5" href="/app"><MeetMark className="size-7" /><span className="font-display text-[21px] font-bold tracking-[-0.05em]">setuvara</span></Link>
          <span aria-hidden="true" className="mx-1.5 h-[22px] w-px bg-black/15" />
          <span className="hidden text-[15px] text-black/60 xl:inline">Editing</span>
        </div>
        <ModeTabs modes={modes} onPick={(next) => go(section, next)} slug={slug} />
        <div className="flex items-center gap-3">
          <SaveChip justPublished={justPublished} message={statusMessage} onRetry={retry} status={status} />
          <button className="inline-flex min-h-11 items-center rounded-full px-[18px] text-sm font-semibold shadow-[inset_0_0_0_1.5px_#0D0D0D] transition hover:bg-black/[0.04] xl:hidden" onClick={() => setFullPreview(true)} type="button">Preview</button>
          <button className="hidden min-h-11 items-center rounded-full px-[18px] text-sm font-semibold shadow-[inset_0_0_0_1.5px_#0D0D0D] transition hover:bg-black/[0.04] xl:inline-flex" onClick={() => setFullPreview(true)} type="button">Full preview</button>
          {publishButton}
        </div>
      </header>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-40 border-b border-black/10 bg-[#F5F4EF]/92 backdrop-blur-md lg:hidden">
        <div className="flex h-14 items-center gap-2 px-3">
          {section === "home"
            ? <Link aria-label="Back to Setuvara home" className="flex min-h-11 items-center gap-1.5 px-1.5" href="/app"><MeetMark className="size-6" /></Link>
            : <button className="flex min-h-11 min-w-0 items-center gap-1 px-1.5 text-[15px] font-semibold" onClick={() => go("home")} type="button"><span aria-hidden="true" className="text-lg leading-none">‹</span><span className="truncate">{sectionTitle}</span></button>}
          <MobileModePicker onPick={(next) => go(section, next)} slug={slug} />
          <div className="ml-auto flex items-center gap-1.5">
            <button className="inline-flex min-h-10 items-center rounded-full px-3.5 text-[13px] font-semibold shadow-[inset_0_0_0_1.5px_#0D0D0D]" onClick={() => setFullPreview(true)} type="button">Preview</button>
            {profile.is_published
              ? <a aria-label="Your Setuvara is live. Open it." className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-black/[0.06] px-3 text-[13px] font-semibold text-black/70" href={publicUrl(slug)} rel="noreferrer" target="_blank"><span aria-hidden="true" className="size-2 rounded-full bg-[#2BB673]" />Live</a>
              : <button className="inline-flex min-h-10 items-center rounded-full bg-[#FF5A4F] px-3.5 text-[13px] font-semibold" onClick={() => void setPublished(true)} type="button">Publish</button>}
          </div>
        </div>
        <MobileSaveLine justPublished={justPublished} message={statusMessage} onRetry={retry} status={status} />
      </header>

      <div className="lg:grid lg:min-h-0 lg:flex-1 lg:grid-cols-[232px_minmax(0,1fr)] xl:grid-cols-[256px_minmax(0,1fr)_minmax(420px,34%)] 2xl:grid-cols-[256px_minmax(0,1fr)_minmax(460px,36%)]">
        {/* Rail */}
        <aside className="hidden min-h-0 flex-col border-r border-black/10 px-4 py-6 lg:flex">
          <button className="flex items-center gap-3 rounded-2xl px-2 py-1.5 text-left transition hover:bg-black/[0.04]" onClick={() => go("home")} type="button">
            <Avatar mode={modes.find((item) => item.slug === "personal") ?? mode} name={profile.display_name} />
            <span className="min-w-0"><span className="block truncate text-[15px] font-semibold">{profile.display_name || "Your name"}</span><span className="block text-[13px] text-black/55">One identity · 3 Modes</span></span>
          </button>
          <nav aria-label="Editor sections" className="mt-7 grid gap-1">
            {SECTIONS.map((item, index) => {
              const active = section === item.id;
              return (
                <button aria-current={active ? "page" : undefined} className={`group flex min-h-[52px] items-center gap-3.5 rounded-2xl px-3.5 text-left transition ${active ? "bg-white shadow-[inset_0_0_0_1px_rgba(13,13,13,.12)]" : "hover:bg-black/[0.035]"}`} key={item.id} onClick={() => go(item.id)} type="button">
                  <span className={`font-label text-[11px] ${active ? "text-[#FF5A4F]" : "text-black/40"}`}>0{index + 1}</span>
                  <span className={`flex-1 font-display text-[19px] font-bold tracking-[-0.035em] ${active ? "text-black" : "text-black/50 group-hover:text-black/75"}`}>{item.title}</span>
                  {active && <span aria-hidden="true" className="font-display text-base font-bold text-[#FF5A4F]">/</span>}
                </button>
              );
            })}
          </nav>
          <div className="mt-auto px-2 pt-8">
            <p className="text-[13px] text-black/55">{profile.is_published ? "Live at" : "Will live at"}</p>
            <p className="mt-1 break-all font-label text-[12px]">{publicUrl(slug).replace(/^https?:\/\//, "")}</p>
            <a className="mt-2 inline-flex min-h-9 items-center text-sm font-semibold underline underline-offset-4" href={publicUrl(slug)} rel="noreferrer" target="_blank">View live profile ↗</a>
            <div className="mt-5 flex items-center gap-4 border-t border-black/10 pt-4 text-[13px] text-black/55">
              <Link className="min-h-9 py-2 hover:text-black" href="/app">Home</Link>
              <Link className="min-h-9 py-2 hover:text-black" href="/app/connections">Connections</Link>
              <form action={signOut}><button className="min-h-9 py-2 hover:text-black" type="submit">Sign out</button></form>
            </div>
          </div>
        </aside>

        {/* Content */}
        <main className="min-w-0 lg:min-h-0 lg:overflow-y-auto" id="editor-scroll">
          <div className={`mx-auto w-full max-w-[720px] px-4 pb-32 pt-6 sm:px-6 lg:px-10 lg:pb-16 lg:pt-10 xl:px-11 ${section === "home" ? "max-lg:hidden" : ""}`}>{content}</div>
          {section === "home" && <div className="px-4 pb-28 pt-5 sm:px-6 lg:hidden"><MobileHome api={api} onPreview={() => setFullPreview(true)} /></div>}
        </main>

        {/* Live preview */}
        <aside aria-label="Live preview" className="hidden min-h-0 overflow-y-auto border-l border-black/10 bg-[#E9E7E0] xl:block">
          <PreviewPane api={api} previewState={previewState} setPreviewState={setPreviewState} />
        </aside>
      </div>

      {fullPreview && <FullPreview api={api} onClose={() => setFullPreview(false)} previewState={previewState} setPreviewState={setPreviewState} />}
      {crop && <CropDialog key={crop.source} busy={busyPhoto} onCancel={() => { if (crop.revoke) URL.revokeObjectURL(crop.source); setCrop(null); }} onReplace={() => { photoTarget.current = crop.modeId; fileRef.current?.click(); }} onSave={async (area) => {
        try {
          const blob = await cropToBlob(crop.source, area);
          const target = crop.modeId;
          if (crop.revoke) URL.revokeObjectURL(crop.source);
          setCrop(null);
          await savePhoto(target, blob);
        } catch { toast("That photo couldn’t be prepared. Try a different file."); }
      }} source={crop.source} />}

      <input accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => {
        const file = event.currentTarget.files?.[0];
        event.currentTarget.value = "";
        if (!file) return;
        if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) { toast("Choose a JPEG, PNG or WebP image."); return; }
        if (file.size > 15 * 1024 * 1024) { toast("That image is too large. Choose one under 15 MB."); return; }
        if (crop?.revoke) URL.revokeObjectURL(crop.source);
        setCrop({ source: URL.createObjectURL(file), modeId: photoTarget.current ?? mode.id, revoke: true });
      }} ref={fileRef} type="file" />

      {toastState && (
        <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-5 z-[90] flex justify-center px-4 max-lg:bottom-24" key={toastState.id}>
          <div className="pointer-events-auto flex min-h-12 max-w-md items-center gap-4 rounded-full bg-[#0D0D0D] py-1.5 pl-5 pr-1.5 text-sm font-semibold text-[#F5F4EF] shadow-[0_18px_50px_-18px_rgba(13,13,13,.7)] [animation:toast-in_.22s_ease-out]">
            <span className="py-2">{toastState.text}</span>
            {toastState.action ? <button className="min-h-9 rounded-full bg-[#F5F4EF] px-4 text-[13px] text-[#0D0D0D]" onClick={() => { toastState.action?.run(); setToastState(null); }} type="button">{toastState.action.label}</button> : <span className="w-3" />}
          </div>
        </div>
      )}
      <CelebrationClient name={PASSPORT_REWARDS.find((reward) => reward.milestone === celebrationThreshold)?.name ?? (celebrationThreshold ? `${celebrationThreshold} Connections` : null)} threshold={celebrationThreshold} />
    </div>
  );
}

function ModeTabs({ modes, slug, onPick }: { modes: ProfileMode[]; slug: ModeSlug; onPick: (slug: ModeSlug) => void }) {
  return (
    <div aria-label="Mode" className="flex gap-1 rounded-full bg-white p-1 shadow-[inset_0_0_0_1px_rgba(13,13,13,.12)]" role="tablist">
      {MODE_SLUGS.map((item) => {
        const on = item === slug;
        const meta = modeMeta[item];
        const eventName = item === "event" ? String(modes.find((entry) => entry.slug === "event")?.settings.eventName ?? "").trim() : "";
        const off = modes.find((entry) => entry.slug === item)?.is_enabled === false;
        return (
          <button aria-selected={on} className="flex h-10 items-center gap-2 rounded-full px-4 text-[15px] font-semibold transition-colors 2xl:px-5" key={item} onClick={() => onPick(item)} role="tab" style={{ background: on ? meta.bg : "transparent", color: on ? meta.fg : "rgba(13,13,13,.55)", boxShadow: on ? meta.ring : undefined }} type="button">
            {meta.name}
            {eventName && <span className="hidden max-w-[110px] truncate text-xs font-medium opacity-80 2xl:inline">{eventName}</span>}
            {off && <span className="text-[11px] font-medium opacity-70">Off</span>}
          </button>
        );
      })}
    </div>
  );
}

function MobileModePicker({ slug, onPick }: { slug: ModeSlug; onPick: (slug: ModeSlug) => void }) {
  const meta = modeMeta[slug];
  return (
    <label className="relative inline-flex min-h-10 items-center gap-1 rounded-full px-3.5 text-[13px] font-semibold" style={{ background: meta.bg, color: meta.fg, boxShadow: meta.ring }}>
      {meta.name}<span aria-hidden="true" className="text-[10px]">▼</span>
      <span className="sr-only">Mode</span>
      <select aria-label="Mode" className="absolute inset-0 cursor-pointer opacity-0" onChange={(event) => onPick(event.target.value as ModeSlug)} value={slug}>
        {MODE_SLUGS.map((item) => <option key={item} value={item}>{modeMeta[item].name}</option>)}
      </select>
    </label>
  );
}

function SaveChip({ status, message, justPublished, onRetry }: { status: SaveStatus; message: string; justPublished: boolean; onRetry: () => void }) {
  if (justPublished && status === "saved") return <span className="inline-flex min-h-9 items-center rounded-full bg-[#C7FF4A] px-3.5 text-sm font-semibold">Published · just now</span>;
  if (status === "error") return <button className="inline-flex min-h-9 max-w-[280px] items-center gap-2 rounded-full px-3 text-sm font-semibold text-[#B42318] hover:bg-[#B42318]/[0.06]" onClick={onRetry} title={message} type="button"><span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-[#B42318]" /><span className="truncate">Not saved · Retry</span></button>;
  if (status === "saving" || status === "pending") return <span aria-live="polite" className="inline-flex min-h-9 items-center gap-2 px-2 text-sm text-black/60"><span aria-hidden="true" className="size-3.5 animate-spin rounded-full border-2 border-black/20 border-t-black/70" />Saving…</span>;
  return <span aria-live="polite" className="inline-flex min-h-9 items-center gap-1.5 px-2 text-sm text-black/60"><span aria-hidden="true">✓</span>Saved</span>;
}

function MobileSaveLine({ status, message, justPublished, onRetry }: { status: SaveStatus; message: string; justPublished: boolean; onRetry: () => void }) {
  if (status === "saved" && !justPublished) return null;
  return (
    <div className="flex items-center justify-center gap-2 border-t border-black/5 px-4 py-1.5 text-[12px] font-medium" style={{ background: justPublished && status === "saved" ? "#C7FF4A" : undefined }}>
      {status === "error" ? <button className="font-semibold text-[#B42318]" onClick={onRetry} type="button">{message || "Not saved"} · Retry</button>
        : status === "saved" ? "Published · every share surface is up to date"
          : <span className="text-black/60">Saving…</span>}
    </div>
  );
}

function Avatar({ mode, name }: { mode: ProfileMode; name: string }) {
  return (
    <span className="relative grid size-11 shrink-0 place-items-center overflow-hidden rounded-full bg-[#0D0D0D] font-display text-base font-bold text-[#F5F4EF]">
      {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL */}
      {mode.image_url ? <img alt="" className="absolute inset-0 size-full object-cover" src={mode.image_url} /> : (name.trim()[0] ?? "S").toUpperCase()}
    </span>
  );
}

function validAppearance(slug: ModeSlug, appearance: ModeAppearance) {
  return ["light", "dark", "editorial"].includes(appearance.theme)
    && /^#[\da-f]{6}$/i.test(appearance.accent)
    && LAYOUTS[slug].some((layout) => layout.value === appearance.layout)
    && ["full-bleed", "portrait", "compact"].includes(appearance.imageTreatment);
}

