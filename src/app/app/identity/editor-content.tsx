"use client";

import { DndContext, KeyboardSensor, PointerSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useEffect, useId, useMemo, useState, type FormEvent } from "react";

import { ProviderMark } from "@/components/links/provider-mark";
import { ProviderPicker } from "@/components/links/provider-picker";
import { ProfileBlocks } from "@/components/profile/profile-blocks";
import { BOOKING_PROVIDERS } from "@/components/profile/profile-renderer";
import type { BlockKind, ProfileBlock } from "@/components/profile/types";
import { MUSIC_PROVIDER_NAMES, parseMusic, parseVideo, VIDEO_PROVIDER_NAMES, type LinkPreview } from "@/lib/blocks/media";
import { BLOCK_LIMIT, BLOCKS, blockSummary, emptyBlock, MODE_BLOCKS, validateBlock } from "@/lib/blocks/registry";
import { detectProvider, linkProviderById, MODE_LINK_SUGGESTIONS, providerForLink, resolveStoredLink, type LinkProvider } from "@/lib/links/providers";
import { AddLinkPanel, DragHandle, LinkRow } from "./editor-sections";
import { MODE_SLUGS, type EditorApi } from "./editor-types";
import { BlockIcon, Card, Field, MonoLabel, Pill, SectionHeader, Sheet, TextArea, TextInput, Toggle, modeMeta } from "./editor-ui";

type SheetState =
  | { type: "add" }
  | { type: "block"; kind: BlockKind; block?: ProfileBlock; seed?: Record<string, unknown> }
  | { type: "link"; provider: LinkProvider | null; value?: string };

const LINK_ICON = "M10.6 13.4a1 1 0 0 1 0-1.4l3.5-3.5a1 1 0 1 1 1.4 1.4L12 13.4a1 1 0 0 1-1.4 0ZM8.5 11l-1.8 1.8a3 3 0 0 0 4.3 4.3l1.8-1.8a1 1 0 1 1 1.4 1.4l-1.8 1.8a5 5 0 1 1-7.1-7.1l1.8-1.8A1 1 0 1 1 8.5 11Zm7-1.4 1.8-1.8a3 3 0 0 0-4.3-4.3L11.2 5.3a1 1 0 1 1-1.4-1.4l1.8-1.8a5 5 0 1 1 7.1 7.1l-1.8 1.8a1 1 0 1 1-1.4-1.4Z";
const previewTone = { bg: "#FFFFFF", ink: "#0D0D0D", sub: "rgba(13,13,13,.62)", chip: "#F5F4EF", line: "rgba(13,13,13,.12)", dark: false };

// ---------------------------------------------------------------- Content section

export function ContentSection({ api }: { api: EditorApi }) {
  const { mode, slug } = api;
  const blocks = mode.blocks ?? [];
  const [sheet, setSheet] = useState<SheetState | null>(null);
  const [editingLink, setEditingLink] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 160, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const blockDnd = useId();
  const linkDnd = useId();
  const booking = mode.links.find((link) => BOOKING_PROVIDERS.includes(providerForLink(link.link_type).id) && link.is_visible);
  const copySources = MODE_SLUGS.filter((item) => item !== slug && (api.modes.find((entry) => entry.slug === item)?.links.length ?? 0) > 0);
  const suggested = MODE_BLOCKS[slug].filter((kind) => !blocks.some((block) => block.kind === kind)).slice(0, 3);

  function onBlockDrag({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const from = blocks.findIndex((block) => block.id === active.id);
    const to = blocks.findIndex((block) => block.id === over.id);
    if (from >= 0 && to >= 0) api.reorderBlocks(arrayMove(blocks, from, to));
  }
  function onLinkDrag({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const from = mode.links.findIndex((link) => link.id === active.id);
    const to = mode.links.findIndex((link) => link.id === over.id);
    if (from >= 0 && to >= 0) api.reorderLinks(arrayMove(mode.links, from, to));
  }

  return (
    <div>
      <SectionHeader description={`Everything visitors see in ${modeMeta[slug].name} Mode, in order. Paste any link and Setuvara works out the rest.`} slug={slug} title="Content" />

      <button className="group flex min-h-[60px] w-full items-center gap-3 rounded-[20px] bg-white px-4 text-left shadow-[inset_0_0_0_1.5px_#0D0D0D] transition hover:bg-[#0D0D0D] hover:text-[#F5F4EF] max-lg:hidden" onClick={() => setSheet({ type: "add" })} type="button">
        <span aria-hidden="true" className="grid size-9 place-items-center rounded-full bg-[#FF5A4F] text-xl font-semibold text-[#0D0D0D]">+</span>
        <span className="flex-1"><span className="block text-[15px] font-semibold">Add content</span><span className="block text-[13px] opacity-60">Paste a link, or pick a video, music, a featured card, services…</span></span>
      </button>

      {/* Blocks */}
      <div className="mb-3 mt-8 flex items-end justify-between gap-3">
        <div><MonoLabel className="text-black/50">Blocks</MonoLabel><p className="mt-1 text-[13px] text-black/55">Rich sections: videos, music, cards{slug === "business" ? ", services, proof" : ""}.</p></div>
        <span className="font-label text-[11px] text-black/40">{blocks.length}/{BLOCK_LIMIT}</span>
      </div>
      {blocks.length > 0 && (
        <DndContext collisionDetection={closestCenter} id={blockDnd} onDragEnd={onBlockDrag} sensors={sensors}>
          <SortableContext items={blocks.map((block) => block.id)} strategy={verticalListSortingStrategy}>
            <ul className="grid grid-cols-1 gap-2.5">
              {blocks.map((block) => <BlockRow api={api} block={block} key={block.id} onEdit={() => setSheet({ type: "block", kind: block.kind, block })} />)}
            </ul>
          </SortableContext>
        </DndContext>
      )}
      {suggested.length > 0 && (
        <div className={`grid grid-cols-1 gap-2 sm:grid-cols-3 ${blocks.length ? "mt-2.5" : ""}`}>
          {suggested.map((kind) => (
            <button className="flex min-h-[64px] items-center gap-3 rounded-[18px] border-[1.5px] border-dashed border-black/20 px-3.5 text-left transition hover:border-black/60 hover:bg-white/70" key={kind} onClick={() => setSheet({ type: "block", kind })} type="button">
              <BlockIcon className="size-9 rounded-xl bg-white" path={BLOCKS[kind].icon} />
              <span className="min-w-0"><span className="block text-[14px] font-semibold">Add {BLOCKS[kind].name.toLowerCase()}</span><span className="block truncate text-[12px] text-black/50">{BLOCKS[kind].hint}</span></span>
            </button>
          ))}
        </div>
      )}

      {/* Links */}
      <div className="mb-3 mt-9">
        <MonoLabel className="text-black/50">Links</MonoLabel>
        <p className="mt-1 text-[13px] text-black/55">{slug === "personal" ? "Social links show as round icons under your name; others as buttons." : "Drag to reorder. Hidden links stay saved here."}</p>
      </div>

      {slug === "business" && (
        <Card className="mb-3 flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div className="min-w-0"><p className="text-[15px] font-semibold">Next to Connect, visitors see</p><p className="mt-0.5 truncate text-[13px] text-black/55">{booking ? `${booking.title} · ${resolveStoredLink(providerForLink(booking.link_type).id, booking.url)?.displayValue ?? ""}` : "Nothing yet. A visible booking link becomes a “Book intro” button."}</p></div>
          {booking ? <span className="inline-flex min-h-10 items-center rounded-full bg-[#0D0D0D] px-4 text-sm font-semibold text-[#F5F4EF]">Book intro</span> : <Pill onClick={() => setSheet({ type: "link", provider: linkProviderById.cal_com })}>Add booking link</Pill>}
        </Card>
      )}

      {mode.links.length > 0 ? (
        <DndContext collisionDetection={closestCenter} id={linkDnd} onDragEnd={onLinkDrag} sensors={sensors}>
          <SortableContext items={mode.links.map((link) => link.id)} strategy={verticalListSortingStrategy}>
            <ul className="grid grid-cols-1 gap-2.5">
              {mode.links.map((link) => <LinkRow api={api} editing={editingLink === link.id} key={link.id} link={link} onEdit={(open) => setEditingLink(open ? link.id : null)} />)}
            </ul>
          </SortableContext>
        </DndContext>
      ) : (
        <Card className="px-5 py-5">
          <p className="text-[15px] font-semibold">No links in {modeMeta[slug].name} Mode yet</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Pill onClick={() => setSheet({ type: "link", provider: null })} variant="ink">+ Add a link</Pill>
            {copySources.map((item) => <Pill key={item} onClick={() => void api.copyLinksFrom(item)}>Copy from {modeMeta[item].name}</Pill>)}
          </div>
        </Card>
      )}
      <p className="mt-4 pb-28 text-[13px] text-black/50 lg:pb-0">Turn anything off to hide it without deleting it.</p>

      {/* Mobile add button sits above the tab bar */}
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(64px+env(safe-area-inset-bottom))] z-30 flex justify-center px-4 pb-3 lg:hidden">
        <button className="pointer-events-auto inline-flex min-h-[52px] items-center gap-2 rounded-full bg-[#0D0D0D] px-6 text-[15px] font-semibold text-[#F5F4EF] shadow-[0_16px_40px_-14px_rgba(13,13,13,.7)]" onClick={() => setSheet({ type: "add" })} type="button"><span aria-hidden="true" className="text-xl leading-none">+</span>Add</button>
      </div>

      {sheet?.type === "add" && <AddSheet api={api} onClose={() => setSheet(null)} onPick={setSheet} />}
      {sheet?.type === "block" && <BlockSheet api={api} block={sheet.block} key={sheet.block?.id ?? sheet.kind} kind={sheet.kind} onClose={() => setSheet(null)} seed={sheet.seed} />}
      {sheet?.type === "link" && (
        <Sheet onClose={() => setSheet(null)} title={sheet.provider ? `Add ${sheet.provider.name}` : "Add a link"}>
          <AddLinkPanel api={api} bare initial={sheet.provider} initialValue={sheet.value} onClose={() => setSheet(null)} />
        </Sheet>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Rows

function BlockRow({ api, block, onEdit }: { api: EditorApi; block: ProfileBlock; onEdit: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });
  const meta = BLOCKS[block.kind];
  return (
    <li className={`min-w-0 rounded-[18px] bg-white transition-shadow ${isDragging ? "relative z-10 shadow-[0_24px_50px_-20px_rgba(13,13,13,.45),inset_0_0_0_2px_#0D0D0D]" : "shadow-[inset_0_0_0_1px_rgba(13,13,13,.08)]"}`} ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform ? { ...transform, scaleX: 1, scaleY: 1 } : null), transition }}>
      <div className="flex min-h-[70px] items-center gap-1.5 py-2 pl-1.5 pr-2 sm:gap-2 sm:pr-3">
        <DragHandle {...attributes} {...listeners} />
        <BlockIcon className="size-10 rounded-xl bg-[#0D0D0D] text-[#F5F4EF]" path={meta.icon} />
        <button className={`min-w-0 flex-1 px-1.5 text-left ${block.is_visible ? "" : "opacity-50"}`} onClick={onEdit} type="button">
          <span className="flex items-center gap-2"><span className="truncate text-[15px] font-semibold">{meta.name}</span>{!block.is_visible && <span className="shrink-0 rounded-full px-2 py-0.5 font-label text-[9px] tracking-[0.1em] shadow-[inset_0_0_0_1px_rgba(13,13,13,.35)]">HIDDEN</span>}</span>
          <span className="block truncate text-[13px] text-black/55">{blockSummary(block)}</span>
        </button>
        <Toggle label={`${block.is_visible ? "Hide" : "Show"} ${meta.name}`} on={block.is_visible} onChange={() => api.toggleBlock(block)} />
        <button className="hidden min-h-10 rounded-full px-3 text-sm font-semibold hover:bg-black/[0.05] sm:block" onClick={onEdit} type="button">Edit</button>
        <button aria-label={`Delete ${meta.name}`} className="hidden size-10 place-items-center rounded-full text-lg text-black/40 hover:bg-[#B42318]/[0.07] hover:text-[#B42318] sm:grid" onClick={() => api.deleteBlock(block)} type="button">×</button>
      </div>
    </li>
  );
}

// ---------------------------------------------------------------- Add sheet

function AddSheet({ api, onClose, onPick }: { api: EditorApi; onClose: () => void; onPick: (next: SheetState) => void }) {
  const [paste, setPaste] = useState("");
  const blocks = api.mode.blocks ?? [];
  const full = blocks.length >= BLOCK_LIMIT;
  const first = MODE_BLOCKS[api.slug];
  const rest = (Object.keys(BLOCKS) as BlockKind[]).filter((kind) => !first.includes(kind));
  const quickLinks = MODE_LINK_SUGGESTIONS[api.slug].slice(0, 6).map((id) => linkProviderById[id]).filter(Boolean);

  const value = paste.trim();
  const video = value ? parseVideo(value) : null;
  const music = !video && value ? parseMusic(value) : null;
  const detected = !video && !music && value ? detectProvider(value) : null;
  const generic = detected && ["website", "company_website", "url"].includes(detected.provider.id);

  return (
    <Sheet onClose={onClose} title="Add content" wide>
      <label className="block" htmlFor="smart-paste">
        <span className="text-sm font-semibold">Paste any link</span>
        <span className="mt-0.5 block text-[13px] text-black/55">YouTube, TikTok, Spotify, a website, an email… we’ll suggest the best way to show it.</span>
      </label>
      <TextInput autoCapitalize="none" autoComplete="off" className="mt-2.5" id="smart-paste" inputMode="url" onChange={(event) => setPaste(event.target.value)} placeholder="https://" spellCheck={false} value={paste} />

      {value && (
        <div className="mt-3 grid gap-2">
          {video && <Suggestion disabled={full} icon={BLOCKS.video.icon} label={`Add ${VIDEO_PROVIDER_NAMES[video.provider]} video`} note="Plays right on your profile" onClick={() => onPick({ type: "block", kind: "video", seed: { url: value } })} primary />}
          {music && <Suggestion disabled={full} icon={BLOCKS.music.icon} label={`Add ${MUSIC_PROVIDER_NAMES[music.provider]} player`} note="Visitors can listen without leaving" onClick={() => onPick({ type: "block", kind: "music", seed: { url: value } })} primary />}
          {(video || music) && <Suggestion icon={LINK_ICON} label="Add as a plain link instead" note={value} onClick={() => { const found = detectProvider(value); onPick({ type: "link", provider: found?.provider ?? linkProviderById.url, value: found?.value ?? value }); }} />}
          {detected && !generic && <Suggestion label={`Add ${detected.provider.name} link`} mark={detected.provider} note={detected.value} onClick={() => onPick({ type: "link", provider: detected.provider, value: detected.value })} primary />}
          {detected && generic && <>
            <Suggestion disabled={full} icon={BLOCKS.feature.icon} label="Feature it as a card" note="Big card with the page’s image and title" onClick={() => onPick({ type: "block", kind: "feature", seed: { url: /^https?:\/\//i.test(value) ? value : `https://${value}` } })} primary />
            <Suggestion label="Add as a link button" mark={detected.provider} note={detected.value} onClick={() => onPick({ type: "link", provider: detected.provider, value: detected.value })} />
          </>}
          {!video && !music && !detected && <p className="px-1 text-[13px] text-black/55">That doesn’t look like a link yet.</p>}
        </div>
      )}

      <MonoLabel className="mb-2.5 mt-7 text-black/50">Blocks for {modeMeta[api.slug].name} Mode</MonoLabel>
      {full && <p className="mb-2 text-[13px] text-[#B42318]">This Mode has {BLOCK_LIMIT} blocks. Remove one to add more.</p>}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {[...first, ...rest].map((kind, index) => (
          <button className={`flex min-h-[86px] flex-col items-start justify-between gap-2 rounded-2xl p-3.5 text-left transition disabled:opacity-40 ${index < first.length ? "bg-white shadow-[inset_0_0_0_1px_rgba(13,13,13,.1)] hover:shadow-[inset_0_0_0_1.5px_#0D0D0D]" : "bg-black/[0.035] hover:bg-black/[0.06]"}`} disabled={full} key={kind} onClick={() => onPick({ type: "block", kind })} type="button">
            <BlockIcon className="size-8 rounded-lg bg-[#0D0D0D] text-[#F5F4EF]" path={BLOCKS[kind].icon} />
            <span><span className="block text-[14px] font-semibold leading-tight">{BLOCKS[kind].name}</span><span className="mt-0.5 line-clamp-1 block text-[12px] text-black/50">{BLOCKS[kind].hint}</span></span>
          </button>
        ))}
      </div>

      <MonoLabel className="mb-2.5 mt-7 text-black/50">Links</MonoLabel>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {quickLinks.map((provider) => (
          <button className="flex min-h-[76px] flex-col items-center justify-center gap-1.5 rounded-2xl bg-white px-2 text-center text-[12px] font-semibold shadow-[inset_0_0_0_1px_rgba(13,13,13,.08)] transition hover:shadow-[inset_0_0_0_1.5px_#0D0D0D]" key={provider.id} onClick={() => onPick({ type: "link", provider })} type="button">
            <ProviderMark className="size-8 rounded-lg bg-[#F5F4EF]" icon={provider.icon} label={provider.name} url={provider.hostname ? `https://${provider.hostname}` : null} />
            <span className="line-clamp-1">{provider.name}</span>
          </button>
        ))}
        <div className="col-span-3 sm:col-span-4 [&>button]:min-h-[56px] [&>button]:w-full [&>button]:rounded-2xl [&>button]:border-0 [&>button]:bg-white [&>button]:shadow-[inset_0_0_0_1px_rgba(13,13,13,.08)]"><ProviderPicker mode={api.slug} onSelect={(provider) => onPick({ type: "link", provider })} /></div>
      </div>
    </Sheet>
  );
}

function Suggestion({ label, note, onClick, icon, mark, primary = false, disabled = false }: { label: string; note: string; onClick: () => void; icon?: string; mark?: LinkProvider; primary?: boolean; disabled?: boolean }) {
  return (
    <button className={`flex min-h-[62px] w-full items-center gap-3 rounded-2xl px-3.5 text-left transition disabled:opacity-40 ${primary ? "bg-[#0D0D0D] text-[#F5F4EF] hover:bg-black/85" : "bg-white shadow-[inset_0_0_0_1px_rgba(13,13,13,.1)] hover:shadow-[inset_0_0_0_1.5px_#0D0D0D]"}`} disabled={disabled} onClick={onClick} type="button">
      {mark ? <ProviderMark className={`size-9 rounded-xl ${primary ? "bg-white text-black" : "bg-[#F5F4EF]"}`} icon={mark.icon} label={mark.name} url={/^https?:/i.test(note) ? note : note.includes(".") && !note.includes("@") ? `https://${note}` : null} /> : <BlockIcon className={`size-9 rounded-xl ${primary ? "bg-[#FF5A4F] text-[#0D0D0D]" : "bg-[#F5F4EF]"}`} path={icon ?? BLOCKS.feature.icon} />}
      <span className="min-w-0 flex-1"><span className="block text-[15px] font-semibold">{label}</span><span className={`block truncate text-[12px] ${primary ? "text-white/60" : "text-black/50"}`}>{note}</span></span>
      <span aria-hidden="true" className="text-lg opacity-60">→</span>
    </button>
  );
}

// ---------------------------------------------------------------- Block editor

function useLinkPreview(url: string, enabled: boolean) {
  const [state, setState] = useState<{ url: string; data: LinkPreview | null; failed: boolean } | null>(null);
  useEffect(() => {
    if (!enabled || !url) return;
    const controller = new AbortController();
    const handle = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/link-preview?url=${encodeURIComponent(url)}`, { signal: controller.signal });
        const data = response.ok ? await response.json() as LinkPreview : null;
        setState({ url, data, failed: !data });
      } catch (error) {
        if ((error as Error).name !== "AbortError") setState({ url, data: null, failed: true });
      }
    }, 450);
    return () => { controller.abort(); window.clearTimeout(handle); };
  }, [enabled, url]);
  const current = state?.url === url ? state : null;
  return { loading: enabled && Boolean(url) && !current, preview: current?.data ?? null, failed: Boolean(current?.failed) };
}

type Item = Record<string, string>;

function BlockSheet({ api, kind, block, seed, onClose }: { api: EditorApi; kind: BlockKind; block?: ProfileBlock; seed?: Record<string, unknown>; onClose: () => void }) {
  const [data, setData] = useState<Record<string, unknown>>(() => ({ ...emptyBlock(kind), ...(block?.data ?? {}), ...(seed ?? {}) }));
  const [touched, setTouched] = useState<Set<string>>(() => new Set(block ? Object.keys(block.data) : []));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const meta = BLOCKS[kind];
  const str = (key: string) => (typeof data[key] === "string" ? String(data[key]) : "");
  const set = (key: string, value: unknown) => { setData((current) => ({ ...current, [key]: value })); setTouched((current) => new Set(current).add(key)); setError(null); };

  const url = str("url").trim();
  const normalizedUrl = url && !/^https?:\/\//i.test(url) ? `https://${url}` : url;
  const lookup = kind === "video" ? Boolean(parseVideo(url)) : kind === "music" ? Boolean(parseMusic(url)) : kind === "feature" ? /^https?:\/\/[^\s/]+\.[^\s]+/i.test(normalizedUrl) : false;
  const { loading, preview, failed } = useLinkPreview(normalizedUrl, lookup && !block);

  // Fill fields the owner hasn't typed into yet once the lookup returns.
  const merged = useMemo(() => {
    if (!preview) return data;
    const next = { ...data };
    const fill = (key: string, value: string | null | undefined) => { if (value && !touched.has(key) && !String(next[key] ?? "").trim()) next[key] = value; };
    if (kind === "video") { fill("title", preview.title); if (!touched.has("thumbnail") && preview.image) next.thumbnail = preview.image; }
    if (kind === "music") fill("title", preview.title);
    if (kind === "feature") { fill("title", preview.title); fill("description", preview.description); fill("siteName", preview.siteName); if (!touched.has("image") && preview.image && !next.image) next.image = preview.image; }
    return next;
  }, [data, kind, preview, touched]);

  const check = validateBlock(kind, kind === "feature" ? { ...merged, url: normalizedUrl } : merged);
  const previewBlock: ProfileBlock | null = check.ok ? { id: "preview", kind, data: check.data, is_visible: true, sort_order: 0 } : null;

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    if (!check.ok) { setError(check.message); return; }
    setSaving(true);
    const failure = block ? await api.updateBlock(block, check.data) : await api.addBlock(kind, check.data);
    setSaving(false);
    if (failure) setError(failure);
    else onClose();
  }

  const items = (merged.items as Item[] | undefined) ?? [];
  const setItem = (index: number, key: string, value: string) => set("items", items.map((item, position) => position === index ? { ...item, [key]: value } : item));
  const maxItems = kind === "highlights" ? 3 : 6;

  return (
    <Sheet
      footer={
        <div className="flex items-center justify-between gap-2">
          {block ? <button className="min-h-11 rounded-full px-3 text-sm font-semibold text-[#B42318] hover:bg-[#B42318]/[0.07]" onClick={() => { api.deleteBlock(block); onClose(); }} type="button">Delete</button> : <span />}
          <div className="flex gap-2"><Pill onClick={onClose} variant="ghost">Cancel</Pill><Pill disabled={saving} onClick={() => void submit()} variant="ink">{saving ? "Saving…" : block ? "Save" : `Add ${meta.name.toLowerCase()}`}</Pill></div>
        </div>
      }
      onClose={onClose}
      title={<span className="flex items-center gap-3"><BlockIcon className="size-9 rounded-xl bg-[#0D0D0D] text-[#F5F4EF]" path={meta.icon} />{block ? `Edit ${meta.name.toLowerCase()}` : meta.name}</span>}
    >
      <form className="grid gap-4" onSubmit={submit}>
        {(kind === "video" || kind === "music" || kind === "feature") && (
          <Field hint={loading ? "Looking it up…" : preview?.title ? "Details filled in" : failed || preview ? "Add a title below if you like" : meta.hint} htmlFor="block-url" label="Link">
            <TextInput autoCapitalize="none" autoFocus={!url} id="block-url" inputMode="url" onChange={(event) => set("url", event.target.value)} placeholder={kind === "video" ? "youtube.com/watch?v=… or a TikTok link" : kind === "music" ? "open.spotify.com/…" : "https://"} spellCheck={false} value={str("url")} />
          </Field>
        )}
        {kind === "video" && <>
          <Field hint="Optional" htmlFor="block-title" label="Title"><TextInput id="block-title" maxLength={120} onChange={(event) => set("title", event.target.value)} value={String(merged.title ?? "")} /></Field>
          <Field hint="Optional" htmlFor="block-caption" label="Caption"><TextInput id="block-caption" maxLength={160} onChange={(event) => set("caption", event.target.value)} placeholder="Shot on 16mm in Porto" value={str("caption")} /></Field>
        </>}
        {kind === "feature" && <>
          <Field htmlFor="block-title" label="Title"><TextInput id="block-title" maxLength={120} onChange={(event) => set("title", event.target.value)} value={String(merged.title ?? "")} /></Field>
          <Field hint="Optional" htmlFor="block-description" label="Description"><TextArea className="min-h-[80px]" id="block-description" maxLength={240} onChange={(event) => set("description", event.target.value)} value={String(merged.description ?? "")} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field hint="Optional" htmlFor="block-cta" label="Button text"><TextInput id="block-cta" maxLength={30} onChange={(event) => set("cta", event.target.value)} placeholder="Read the case study" value={str("cta")} /></Field>
            <Field hint={merged.image ? <button className="font-semibold underline" onClick={() => set("image", null)} type="button">Remove image</button> : "Optional"} htmlFor="block-site" label="Site name"><TextInput id="block-site" maxLength={80} onChange={(event) => set("siteName", event.target.value)} value={String(merged.siteName ?? "")} /></Field>
          </div>
        </>}
        {kind === "services" && <>
          <Field hint="Optional" htmlFor="block-heading" label="Heading"><TextInput id="block-heading" maxLength={60} onChange={(event) => set("heading", event.target.value)} placeholder="Services" value={str("heading")} /></Field>
          {items.map((item, index) => (
            <div className="grid gap-2 rounded-2xl bg-white p-3.5 shadow-[inset_0_0_0_1px_rgba(13,13,13,.08)]" key={index}>
              <div className="flex items-center justify-between"><MonoLabel className="text-black/45">Service {index + 1}</MonoLabel>{items.length > 1 && <button className="min-h-9 px-2 text-[13px] font-semibold text-black/50 hover:text-[#B42318]" onClick={() => set("items", items.filter((_, position) => position !== index))} type="button">Remove</button>}</div>
              <div className="grid gap-2 sm:grid-cols-[1fr_140px]">
                <TextInput aria-label={`Service ${index + 1} name`} maxLength={60} onChange={(event) => setItem(index, "name", event.target.value)} placeholder="Brand strategy sprint" value={item.name ?? ""} />
                <TextInput aria-label={`Service ${index + 1} price`} maxLength={30} onChange={(event) => setItem(index, "price", event.target.value)} placeholder="From €2k" value={item.price ?? ""} />
              </div>
              <TextInput aria-label={`Service ${index + 1} detail`} maxLength={140} onChange={(event) => setItem(index, "detail", event.target.value)} placeholder="Two weeks, one clear positioning" value={item.detail ?? ""} />
            </div>
          ))}
          {items.length < maxItems && <Pill className="justify-self-start" onClick={() => set("items", [...items, { name: "", detail: "", price: "" }])}>+ Add service</Pill>}
        </>}
        {kind === "highlights" && <>
          {items.map((item, index) => (
            <div className="grid grid-cols-[110px_minmax(0,1fr)_auto] items-center gap-2" key={index}>
              <TextInput aria-label={`Highlight ${index + 1} value`} maxLength={12} onChange={(event) => setItem(index, "value", event.target.value)} placeholder={["120+", "8 yrs", "4.9★"][index]} value={item.value ?? ""} />
              <TextInput aria-label={`Highlight ${index + 1} label`} maxLength={40} onChange={(event) => setItem(index, "label", event.target.value)} placeholder={["clients", "in fintech", "avg rating"][index]} value={item.label ?? ""} />
              {items.length > 1 ? <button aria-label={`Remove highlight ${index + 1}`} className="grid size-10 place-items-center rounded-full text-lg text-black/40 hover:bg-black/5" onClick={() => set("items", items.filter((_, position) => position !== index))} type="button">×</button> : <span className="size-10" />}
            </div>
          ))}
          {items.length < maxItems && <Pill className="justify-self-start" onClick={() => set("items", [...items, { value: "", label: "" }])}>+ Add highlight</Pill>}
        </>}
        {kind === "testimonial" && <>
          <Field htmlFor="block-quote" label="Quote"><TextArea autoFocus id="block-quote" maxLength={320} onChange={(event) => set("quote", event.target.value)} placeholder="Aanya rebuilt our partner pipeline in a quarter." value={str("quote")} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field htmlFor="block-author" label="Who said it"><TextInput id="block-author" maxLength={60} onChange={(event) => set("author", event.target.value)} placeholder="Maya Chen" value={str("author")} /></Field>
            <Field hint="Optional" htmlFor="block-role" label="Their role"><TextInput id="block-role" maxLength={80} onChange={(event) => set("role", event.target.value)} placeholder="COO, Northwind" value={str("role")} /></Field>
          </div>
        </>}
        <button className="hidden" type="submit">Save</button>
      </form>

      {error && <p className="mt-3 text-[13px] font-medium text-[#B42318]" role="alert">{error}</p>}

      <div className="mt-6 rounded-[22px] bg-[#E9E7E0] p-3.5 sm:p-4">
        <MonoLabel className="mb-2.5 text-black/45">Preview</MonoLabel>
        <div className="rounded-[18px] bg-white p-3">
          {previewBlock ? <ProfileBlocks accent="#FF5A4F" accentInk="#0D0D0D" blocks={[previewBlock]} className="" tone={previewTone} /> : <p className="px-1 py-6 text-center text-[13px] text-black/45">{loading ? "Fetching details…" : "Fill in the fields to see it here."}</p>}
        </div>
      </div>
    </Sheet>
  );
}
