"use client";

import { DndContext, KeyboardSensor, PointerSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";

import { ProviderMark } from "@/components/links/provider-mark";
import { ProviderPicker } from "@/components/links/provider-picker";
import { MEDIA_LAYOUTS, resolveAppearance, type MediaLayout } from "@/components/profile/appearance";
import { ProfileBlocks } from "@/components/profile/profile-blocks";
import { SpeakerIcon } from "@/components/profile/soundtrack";
import { BOOKING_PROVIDERS } from "@/components/profile/profile-renderer";
import type { BlockKind, ProfileBlock } from "@/components/profile/types";
import { MUSIC_PROVIDER_NAMES, parseMusic, parseVideo, VIDEO_PROVIDER_NAMES, type LinkPreview } from "@/lib/blocks/media";
import { allowedSizes } from "@/lib/profile/page-order";
import { BLOCK_LIMIT, BLOCKS, blockSummary, emptyBlock, MODE_BLOCKS, validateBlock } from "@/lib/blocks/registry";
import { removePendingContentMedia } from "@/lib/blocks/storage";
import { detectProvider, linkProviderById, MODE_LINK_SUGGESTIONS, normalizeProviderValue, providerForLink, resolveStoredLink, type LinkProvider, type LinkProviderId } from "@/lib/links/providers";
import { createClient } from "@/lib/supabase/client";
import { AddLinkPanel, DragHandle, LinkRow, RowChevron } from "./editor-sections";
import { MODE_SLUGS, type EditorApi } from "./editor-types";
import { ContentImageControl } from "./content-image-control";
import { PageActions } from "./editor-page-actions";
import { ActionPageRow, ProjectPageRow, SectionPageRow, usePage } from "./editor-page-order";
import { ContentVideoControl } from "./content-video-control";
import { BlockIcon, Card, Field, GroupHead, MonoLabel, Pill, SectionHeader, Sheet, SizeChip, TextArea, TextInput, Toggle, modeMeta } from "./editor-ui";

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
  const pageDnd = useId();
  const page = usePage();
  const soundtracks = blocks.filter((block) => block.is_soundtrack);
  const builderHref = slug === "creator" ? "/app/identity/creator/builder" : "/app/identity/builder?mode=business";
  const booking = mode.links.find((link) => BOOKING_PROVIDERS.includes(providerForLink(link.link_type).id) && link.is_visible);
  const copySources = MODE_SLUGS.filter((item) => item !== slug && (api.modes.find((entry) => entry.slug === item)?.links.length ?? 0) > 0);
  const suggested = MODE_BLOCKS[slug].filter((kind) => !blocks.some((block) => block.kind === kind)).slice(0, 3);

  function onPageDrag({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const from = page.order.indexOf(String(active.id));
    const to = page.order.indexOf(String(over.id));
    if (from >= 0 && to >= 0) void page.save(arrayMove(page.order, from, to));
  }

  const hiddenLinks = mode.links.filter((link) => !link.is_visible).length;

  return (
    <div>
      <SectionHeader description={`Everything visitors see in ${modeMeta[slug].name} Mode, top to bottom. Drag to reorder, switch off to hide.`} slug={slug} title="Content" />

      <button className="group flex min-h-[64px] w-full items-center gap-3.5 rounded-[20px] bg-white px-4 text-left shadow-[inset_0_0_0_1.5px_#0D0D0D] transition hover:bg-[#0D0D0D] hover:text-[#F5F4EF] focus-visible:outline-2 focus-visible:outline-offset-2 active:scale-[.99]" data-add-content onClick={() => setSheet({ type: "add" })} type="button">
        <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-full bg-[#FF5A4F] text-xl font-semibold text-[#0D0D0D]">+</span>
        <span className="min-w-0 flex-1"><span className="block text-[15px] font-semibold">Add content</span><span className="block truncate text-[13px] opacity-60">Paste any link, or add a video, music, a card…</span></span>
      </button>

      {soundtracks.length > 0 && (
        <ul aria-label="Soundtrack" className="mt-8 grid grid-cols-1 gap-2">
          {soundtracks.map((block) => <BlockRow api={api} block={block} fixed key={block.id} onEdit={() => setSheet({ type: "block", kind: block.kind, block })} />)}
        </ul>
      )}

      {/* Your page: blocks, links, Actions, projects and sections in the order visitors see them. */}
      <section aria-label="Your page" className={soundtracks.length ? "mt-6" : "mt-8"} data-your-page>
        <GroupHead meta={page.saved ? <button className="text-[13px] font-semibold text-black/50 underline-offset-4 hover:text-black hover:underline" onClick={() => void page.save(null)} type="button">Reset order</button> : `${blocks.length - soundtracks.length} of ${BLOCK_LIMIT} blocks${hiddenLinks ? ` · ${hiddenLinks} hidden` : ""}`} title="Your page" />
        {page.items.length > 1 && <p className="-mt-1 mb-3 px-0.5 text-[13px] leading-[1.45] text-black/55">Top to bottom, as visitors see it. Drag anything above anything.</p>}

        {slug === "business" && (
          <div className="mb-2 flex flex-wrap items-center justify-between gap-3 rounded-[18px] bg-[#0D0D0D]/[0.04] px-4 py-3">
            <div className="min-w-0"><p className="text-[14px] font-semibold">Next to Connect</p><p className="mt-0.5 truncate text-[13px] text-black/55">{booking ? `${booking.title} · ${resolveStoredLink(providerForLink(booking.link_type).id, booking.url)?.displayValue ?? ""}` : "A visible booking link becomes a “Book intro” button."}</p></div>
            {booking ? <span className="inline-flex min-h-9 items-center rounded-full bg-[#0D0D0D] px-3.5 text-[13px] font-semibold text-[#F5F4EF]">Book intro</span> : <Pill className="!min-h-10" onClick={() => setSheet({ type: "link", provider: linkProviderById.cal_com })}>Add booking link</Pill>}
          </div>
        )}

        {!page.loaded && page.items.length === 0 ? (
          <div aria-hidden="true" className="h-[66px] animate-pulse rounded-[18px] bg-black/[0.04]" />
        ) : page.items.length > 0 ? (
          <DndContext collisionDetection={closestCenter} id={pageDnd} onDragEnd={onPageDrag} sensors={sensors}>
            <SortableContext items={page.items.map((item) => item.key)} strategy={verticalListSortingStrategy}>
              <ul className="grid grid-cols-1 gap-2">
                {page.items.map((item) => {
                  const options = allowedSizes(item.kind, item.kind === "block" ? item.block.kind : undefined);
                  const name = item.kind === "block" ? BLOCKS[item.block.kind].name : item.kind === "link" ? item.link.title : item.kind === "action" ? item.action.title : "";
                  const size = <SizeChip label={name} onChange={(next) => page.setSize(item.key, next)} options={options} value={page.sizes[item.key] ?? "wide"} />;
                  return item.kind === "block" ? <BlockRow api={api} block={item.block} key={item.key} onEdit={() => setSheet({ type: "block", kind: item.block.kind, block: item.block })} size={size} sortId={item.key} />
                  : item.kind === "link" ? <LinkRow api={api} editing={editingLink === item.link.id} key={item.key} link={item.link} onEdit={(open) => setEditingLink(open ? item.link.id : null)} size={size} sortId={item.key} />
                  : item.kind === "action" ? <ActionPageRow action={item.action} hidden={page.hidden.includes(item.key)} key={item.key} onToggle={() => page.toggleHidden(item.key)} size={size} slug={slug} />
                  : item.kind === "project" ? <ProjectPageRow hidden={page.hidden.includes(item.key)} href={`${builderHref}${builderHref.includes("?") ? "&" : "?"}project=${item.project.id}`} key={item.key} onToggle={() => page.toggleHidden(item.key)} project={item.project} />
                  : <SectionPageRow hidden={page.hidden.includes(item.key)} href={item.section === "creator" ? "/app/identity/creator/settings" : item.section === "testimonials" ? "/app/identity/testimonials" : undefined} key={item.key} onToggle={() => page.toggleHidden(item.key)} section={item.section} />;
                })}
              </ul>
            </SortableContext>
          </DndContext>
        ) : (
          <Card className="px-5 py-5">
            <p className="text-[15px] font-semibold">Nothing on your {modeMeta[slug].name} page yet</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Pill onClick={() => setSheet({ type: "link", provider: null })} variant="ink">+ Add a link</Pill>
              {copySources.map((item) => <Pill key={item} onClick={() => void api.copyLinksFrom(item)}>Copy links from {modeMeta[item].name}</Pill>)}
            </div>
          </Card>
        )}
        {page.status && <p className="mt-2 px-0.5 text-[12.5px] text-black/55" role="status">{page.status}</p>}

        {blocks.filter((block) => block.kind === "image" && block.is_visible).length > 1 && <PictureLayout api={api} />}
        {suggested.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-2" data-block-suggestions>
            {suggested.map((kind) => (
              <button className="inline-flex min-h-10 items-center gap-2 rounded-full border-[1.5px] border-dashed border-black/20 pl-1.5 pr-3.5 text-[13px] font-semibold text-black/75 transition hover:border-black/60 hover:text-black" key={kind} onClick={() => setSheet({ type: "block", kind })} type="button">
                <BlockIcon className="size-7 rounded-full bg-white" path={BLOCKS[kind].icon} />{BLOCKS[kind].name}
              </button>
            ))}
            {page.items.length > 0 && mode.links.length === 0 && copySources.map((item) => <Pill className="!min-h-10" key={item} onClick={() => void api.copyLinksFrom(item)}>Copy links from {modeMeta[item].name}</Pill>)}
          </div>
        )}
      </section>

      <PageActions api={api} key={mode.id} />

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

function BlockRow({ api, block, onEdit, sortId, fixed = false, size }: { api: EditorApi; block: ProfileBlock; onEdit: () => void; sortId?: string; fixed?: boolean; size?: ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: sortId ?? block.id, disabled: fixed });
  const meta = BLOCKS[block.kind];
  const soundtrack = Boolean(block.is_soundtrack);
  return (
    <li className={`min-w-0 rounded-[18px] bg-white transition-shadow ${isDragging ? "relative z-10 shadow-[0_24px_50px_-20px_rgba(13,13,13,.45),inset_0_0_0_2px_#0D0D0D]" : soundtrack ? "shadow-[inset_0_0_0_1.5px_#0D0D0D]" : "shadow-[inset_0_0_0_1px_rgba(13,13,13,.08)]"}`} ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform ? { ...transform, scaleX: 1, scaleY: 1 } : null), transition }}>
      <div className="flex min-h-[66px] items-center gap-1.5 py-2 pl-1 pr-1 sm:gap-2">
        {fixed ? <span aria-hidden="true" className="w-2 shrink-0" /> : <DragHandle {...attributes} {...listeners} />}
        {soundtrack
          ? <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#FF5A4F] text-[#0D0D0D]"><SpeakerIcon className="size-5" on /></span>
          : <BlockIcon className="size-10 rounded-xl bg-[#0D0D0D] text-[#F5F4EF]" path={meta.icon} />}
        <button className={`min-w-0 flex-1 px-1.5 text-left ${block.is_visible ? "" : "opacity-50"}`} onClick={onEdit} type="button">
          <span className="flex items-center gap-2"><span className="truncate text-[15px] font-semibold">{meta.name}</span>{soundtrack && <span className="shrink-0 rounded-full max-[389px]:hidden bg-[#0D0D0D] px-2 py-0.5 font-label text-[9px] tracking-[0.1em] text-[#F5F4EF]">SOUNDTRACK</span>}{!block.is_visible && <span className="shrink-0 rounded-full px-2 py-0.5 font-label text-[9px] tracking-[0.1em] shadow-[inset_0_0_0_1px_rgba(13,13,13,.35)]">HIDDEN</span>}</span>
          <span className="block truncate text-[13px] text-black/55">{blockSummary(block)}</span>
        </button>
        {size}
        <Toggle label={`${block.is_visible ? "Hide" : "Show"} ${meta.name}`} on={block.is_visible} onChange={() => api.toggleBlock(block)} />
        <RowChevron label={`Edit ${meta.name}`} onClick={onEdit} />
      </div>
    </li>
  );
}

// ---------------------------------------------------------------- Add sheet

/** Apps offered when someone types a bare username, most likely first per Mode. */
const HANDLE_APPS: Record<"personal" | "event" | "business" | "creator", LinkProviderId[]> = {
  personal: ["instagram", "tiktok", "x", "youtube", "threads", "snapchat", "twitch", "telegram"],
  event: ["instagram", "linkedin", "x", "tiktok", "threads", "youtube", "github", "telegram"],
  business: ["linkedin", "instagram", "x", "github", "youtube", "tiktok", "calendly", "telegram"],
  creator: ["instagram", "tiktok", "youtube", "spotify", "substack", "patreon", "twitch", "threads", "x"],
};

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
  // A bare username: ask which app it belongs to instead of guessing.
  const handleApps = !video && !music && (!detected || generic) && /^@?[A-Za-z0-9_][A-Za-z0-9_.-]{0,59}$/.test(value)
    ? HANDLE_APPS[api.slug].map((id) => linkProviderById[id]).filter((provider) => normalizeProviderValue(provider.id, value).ok)
    : [];

  return (
    <Sheet onClose={onClose} title="Add content" wide>
      <label className="block" htmlFor="smart-paste">
        <span className="text-sm font-semibold">Paste a link or username</span>
        <span className="mt-0.5 block text-[13px] text-black/55">A link, a @username, an email or a phone number. We’ll suggest the best way to show it.</span>
      </label>
      <TextInput autoCapitalize="none" autoComplete="off" className="mt-2.5" id="smart-paste" inputMode="url" onChange={(event) => setPaste(event.target.value)} placeholder="instagram.com/you or @you" spellCheck={false} value={paste} />

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
          {handleApps.length > 0 && (
            <div className={generic ? "mt-2" : ""}>
              <p className="px-1 text-[13px] font-semibold">{generic ? "Or is it a username? Pick the app:" : `Which app is ${value.startsWith("@") ? value : `@${value}`} on?`}</p>
              <div className="mt-2 grid grid-cols-4 gap-2">
                {handleApps.map((provider) => (
                  <button aria-label={`${provider.name}: ${value}`} className="flex min-h-[68px] flex-col items-center justify-center gap-1.5 rounded-2xl bg-white px-1 text-center text-[12px] font-semibold shadow-[inset_0_0_0_1px_rgba(13,13,13,.08)] transition hover:shadow-[inset_0_0_0_1.5px_#0D0D0D]" key={provider.id} onClick={() => onPick({ type: "link", provider, value })} type="button">
                    <ProviderMark className="size-7 rounded-lg bg-[#F5F4EF]" icon={provider.icon} label={provider.name} url={provider.hostname ? `https://${provider.hostname}` : null} />
                    <span className="line-clamp-1">{provider.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {!video && !music && !detected && !handleApps.length && <p className="px-1 text-[13px] text-black/55">That doesn’t look like a link or username yet.</p>}
        </div>
      )}

      <GroupHead className="mt-7" meta={`Only in ${modeMeta[api.slug].name}`} title="Blocks" />
      {full && <p className="mb-2 text-[13px] text-[#B42318]">This Mode has {BLOCK_LIMIT} blocks. Remove one to add more.</p>}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {[...first, ...rest].map((kind, index) => (
          <button className={`flex min-h-[86px] flex-col items-start justify-between gap-2 rounded-2xl p-3.5 text-left transition disabled:opacity-40 ${index < first.length ? "bg-white shadow-[inset_0_0_0_1px_rgba(13,13,13,.1)] hover:shadow-[inset_0_0_0_1.5px_#0D0D0D]" : "bg-black/[0.035] hover:bg-black/[0.06]"}`} disabled={full} key={kind} onClick={() => onPick({ type: "block", kind })} type="button">
            <BlockIcon className="size-8 rounded-lg bg-[#0D0D0D] text-[#F5F4EF]" path={BLOCKS[kind].icon} />
            <span><span className="block text-[14px] font-semibold leading-tight">{BLOCKS[kind].name}</span><span className="mt-0.5 line-clamp-1 block text-[12px] text-black/50">{BLOCKS[kind].hint}</span></span>
          </button>
        ))}
      </div>

      <GroupHead className="mt-7" title="Links" />
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
  const [mediaUploading, setMediaUploading] = useState(false);
  const [videoPlayable, setVideoPlayable] = useState(false);
  const [videoSource, setVideoSource] = useState<"link" | "upload">(() => kind === "video" && (block?.data.source === "upload" || typeof block?.data.video_path === "string") ? "upload" : "link");
  const [soundtrack, setSoundtrack] = useState(Boolean(block?.is_soundtrack));
  const pendingMediaPaths = useRef(new Set<string>());
  const submitting = useRef(false);
  const cleanupClient = useMemo(() => createClient(), []);
  const meta = BLOCKS[kind];
  const str = (key: string) => (typeof data[key] === "string" ? String(data[key]) : "");
  const set = (key: string, value: unknown) => { setData((current) => ({ ...current, [key]: value })); setTouched((current) => new Set(current).add(key)); setError(null); };
  const closeSheet = () => { if (!saving && !mediaUploading) onClose(); };

  useEffect(() => () => {
    void removePendingContentMedia(cleanupClient, api.profile.id, pendingMediaPaths.current);
  }, [api.profile.id, cleanupClient]);

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
    if (kind === "music") { fill("title", preview.title); if (!touched.has("image") && preview.image && !next.image) next.image = preview.image; }
    if (kind === "feature") { fill("title", preview.title); fill("description", preview.description); fill("siteName", preview.siteName); if (!touched.has("image") && preview.image && !next.image) next.image = preview.image; }
    return next;
  }, [data, kind, preview, touched]);

  const blockDraft = kind === "feature"
    ? { ...merged, url: normalizedUrl }
    : kind === "video" && videoSource === "upload"
      ? { ...merged, source: "upload", url: undefined }
      : kind === "video"
        ? { ...merged, source: "provider", video_path: undefined, video_mime_type: undefined, video_url: undefined }
        : merged;
  const check = validateBlock(kind, blockDraft);
  const music = kind === "music" ? parseMusic(url) : null;
  const canSoundtrack = Boolean(music?.soundtrack) && (block?.is_visible ?? true);
  const currentSoundtrack = (api.mode.blocks ?? []).find((item) => item.is_soundtrack && item.id !== block?.id);
  const previewBlock: ProfileBlock | null = check.ok ? { id: "preview", kind, data: { ...check.data, ...(str("image_url") ? { image_url: str("image_url") } : {}), ...(str("video_url") ? { video_url: str("video_url") } : {}) }, is_visible: true, sort_order: 0 } : null;

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    if (mediaUploading || submitting.current) return;
    if (!check.ok) { setError(check.message); return; }
    if (kind === "video" && videoSource === "upload" && !videoPlayable) { setError("Wait for the uploaded video preview to load before adding it."); return; }
    submitting.current = true;
    setSaving(true);
    const options = kind === "music" ? { soundtrack: soundtrack && canSoundtrack } : {};
    let failure: string | null;
    try {
      failure = block ? await api.updateBlock(block, check.data, options) : await api.addBlock(kind, check.data, options);
    } catch {
      failure = "That block couldn’t be saved. Check your connection and try again.";
    } finally {
      submitting.current = false;
      setSaving(false);
    }
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
          {block ? <button className="min-h-11 rounded-full px-3 text-sm font-semibold text-[#B42318] hover:bg-[#B42318]/[0.07] disabled:opacity-45" disabled={saving || mediaUploading} onClick={() => { api.deleteBlock(block); onClose(); }} type="button">Delete</button> : <span />}
          <div className="flex gap-2"><Pill disabled={saving || mediaUploading} onClick={closeSheet} variant="ghost">Cancel</Pill><Pill disabled={saving || mediaUploading || (kind === "video" && videoSource === "upload" && !videoPlayable)} onClick={() => void submit()} variant="ink">{saving ? "Saving…" : mediaUploading ? "Uploading…" : block ? "Save" : `Add ${meta.name.toLowerCase()}`}</Pill></div>
        </div>
      }
      onClose={closeSheet}
      title={<span className="flex items-center gap-3"><BlockIcon className="size-9 rounded-xl bg-[#0D0D0D] text-[#F5F4EF]" path={meta.icon} />{block ? `Edit ${meta.name.toLowerCase()}` : meta.name}</span>}
    >
      <form className="grid gap-4" onSubmit={submit}>
        {kind === "video" && (
          <div aria-label="Video source" className="grid grid-cols-2 gap-1 rounded-full bg-[#F5F4EF] p-1" role="group">
            {(["link", "upload"] as const).map((source) => (
              <button aria-pressed={videoSource === source} className={`min-h-10 rounded-full px-4 text-sm font-semibold transition ${videoSource === source ? "bg-[#0D0D0D] text-[#F5F4EF]" : "text-black/55 hover:bg-black/[0.04]"}`} key={source} onClick={() => { setVideoSource(source); setVideoPlayable(false); setError(null); }} type="button">
                {source === "link" ? "Link" : "Upload"}
              </button>
            ))}
          </div>
        )}
        {((kind === "video" && videoSource === "link") || kind === "music" || kind === "feature") && (
          <Field hint={loading ? "Looking it up…" : preview?.title ? "Details filled in" : failed || preview ? "Add a title below if you like" : meta.hint} htmlFor="block-url" label="Link">
            <TextInput autoCapitalize="none" autoFocus={!url} id="block-url" inputMode="url" onChange={(event) => set("url", event.target.value)} placeholder={kind === "video" ? "youtube.com/watch?v=… or a TikTok link" : kind === "music" ? "open.spotify.com/…" : "https://"} spellCheck={false} value={str("url")} />
          </Field>
        )}
        {kind === "video" && videoSource === "upload" && <ContentVideoControl
          label="Uploaded video"
          mimeType={str("video_mime_type")}
          onBusyChange={setMediaUploading}
          onChange={(path, url, mimeType) => {
            pendingMediaPaths.current.add(path);
            set("source", "upload");
            set("video_path", path);
            set("video_mime_type", mimeType);
            set("video_url", url);
            setVideoPlayable(false);
          }}
          onPlayableChange={setVideoPlayable}
          previewUrl={str("video_url")}
          profileId={api.profile.id}
          videoPath={str("video_path")}
        />}
        {kind === "music" && (
          <div className="rounded-2xl bg-white p-3.5 shadow-[inset_0_0_0_1px_rgba(13,13,13,.08)]">
            <div className="flex items-center gap-3">
              <span aria-hidden="true" className={`grid size-10 shrink-0 place-items-center rounded-xl transition-colors ${soundtrack && canSoundtrack ? "bg-[#FF5A4F] text-[#0D0D0D]" : "bg-[#F5F4EF] text-black/60"}`}><SpeakerIcon className="size-5" on={soundtrack && canSoundtrack} /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold leading-snug" id="soundtrack-label">Use as profile soundtrack</span>
                <span className="block text-[13px] leading-5 text-black/55">Plays when visitors choose Sound on.</span>
              </span>
              <Toggle disabled={!canSoundtrack} label="Use as profile soundtrack" on={soundtrack && canSoundtrack} onChange={setSoundtrack} />
            </div>
            {!canSoundtrack && url && <p className="mt-2.5 text-[13px] leading-5 text-black/55">{block && !block.is_visible ? "Show this block to use it as the soundtrack." : music ? "Use a track, album or playlist link to make this the soundtrack." : "Paste a music link first."}</p>}
            {soundtrack && canSoundtrack && currentSoundtrack && <p className="mt-2.5 text-[13px] leading-5 text-black/55">Replaces “{blockSummary(currentSoundtrack)}” as the {modeMeta[api.slug].name} Mode soundtrack.</p>}
          </div>
        )}
        {kind === "video" && <>
          <Field hint="Optional" htmlFor="block-title" label="Title"><TextInput id="block-title" maxLength={120} onChange={(event) => set("title", event.target.value)} value={String(merged.title ?? "")} /></Field>
          <Field hint="Optional" htmlFor="block-caption" label="Caption"><TextInput id="block-caption" maxLength={160} onChange={(event) => set("caption", event.target.value)} placeholder="Shot on 16mm in Porto" value={str("caption")} /></Field>
        </>}
        {(kind === "feature" || kind === "image") && <ContentImageControl
          imagePath={str("image_path")}
          label={kind === "image" ? "Profile image" : "Featured Link image"}
          onBusyChange={setMediaUploading}
          onChange={(path, url) => {
            if (path) pendingMediaPaths.current.add(path);
            set("image_path", path);
            set("image_url", url);
          }}
          onRemove={kind === "feature" ? () => { set("image_path", null); set("image_url", null); } : undefined}
          previewUrl={str("image_url") || (kind === "feature" && typeof merged.image === "string" ? merged.image : "")}
          profileId={api.profile.id}
        />}
        {kind === "image" && <>
          <Field htmlFor="block-image-alt" label="Describe the image"><TextInput autoFocus maxLength={180} id="block-image-alt" onChange={(event) => set("alt", event.target.value)} placeholder="A candid photo from the studio" value={str("alt")} /></Field>
          <Field hint="Optional" htmlFor="block-image-caption" label="Caption"><TextArea className="min-h-[72px]" id="block-image-caption" maxLength={240} onChange={(event) => set("caption", event.target.value)} placeholder="A small note to go with the image" value={str("caption")} /></Field>
        </>}
        {kind === "feature" && <>
          <Field htmlFor="block-title" label="Title"><TextInput id="block-title" maxLength={120} onChange={(event) => set("title", event.target.value)} value={String(merged.title ?? "")} /></Field>
          <Field hint="Optional" htmlFor="block-description" label="Description"><TextArea className="min-h-[80px]" id="block-description" maxLength={240} onChange={(event) => set("description", event.target.value)} value={String(merged.description ?? "")} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field hint="Optional" htmlFor="block-cta" label="Button text"><TextInput id="block-cta" maxLength={30} onChange={(event) => set("cta", event.target.value)} placeholder="Read the case study" value={str("cta")} /></Field>
            <Field hint="Optional" htmlFor="block-site" label="Site name"><TextInput id="block-site" maxLength={80} onChange={(event) => set("siteName", event.target.value)} value={String(merged.siteName ?? "")} /></Field>
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

const LAYOUT_NAMES: Record<MediaLayout, string> = { featured: "Featured", stack: "Stack", grid: "Grid", carousel: "Carousel" };

/** A tiny drawing of each picture layout, so the choice reads at a glance. */
function LayoutGlyph({ layout }: { layout: MediaLayout }) {
  const tile = "rounded-[3px] bg-current";
  switch (layout) {
    case "featured": return <span className="grid h-9 w-11 grid-rows-[1fr_9px] gap-[3px]"><span className={tile} /><span className="flex gap-[3px]"><span className={`w-3 ${tile} opacity-50`} /><span className={`w-3 ${tile} opacity-50`} /><span className={`w-3 ${tile} opacity-50`} /></span></span>;
    case "stack": return <span className="grid h-9 w-11 grid-rows-3 gap-[3px] px-1"><span className={tile} /><span className={`${tile} opacity-70`} /><span className={`${tile} opacity-50`} /></span>;
    case "grid": return <span className="grid h-9 w-11 grid-cols-2 grid-rows-2 gap-[3px] px-1"><span className={tile} /><span className={`${tile} opacity-70`} /><span className={`${tile} opacity-70`} /><span className={`${tile} opacity-50`} /></span>;
    case "carousel": return <span className="flex h-9 w-11 items-stretch gap-[3px] overflow-hidden py-1"><span className={`w-2 shrink-0 ${tile} opacity-40`} /><span className={`w-6 shrink-0 ${tile}`} /><span className={`w-2 shrink-0 ${tile} opacity-40`} /></span>;
  }
}

/** How this Mode's pictures sit under its Appearance. Saved on the Mode; every plan. */
function PictureLayout({ api }: { api: EditorApi }) {
  const current = resolveAppearance(api.mode, api.plan).mediaLayout;
  return (
    <fieldset className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2.5 rounded-[18px] bg-white px-4 py-3 shadow-[inset_0_0_0_1px_#0D0D0D14]" data-picture-layout>
      <legend className="sr-only">Picture layout</legend>
      <span aria-hidden="true"><span className="block text-[13px] font-semibold">Picture layout</span><span className="block text-[12px] text-black/50">How your pictures sit together</span></span>
      <div className="flex gap-1.5" role="radiogroup" aria-label="Picture layout">
        {MEDIA_LAYOUTS.map((layout) => {
          const on = layout === current;
          return (
            <button aria-checked={on} className={`flex w-[62px] flex-col items-center gap-1 rounded-[12px] px-1.5 pb-1.5 pt-2 text-[11px] font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0D0D0D] ${on ? "bg-[#0D0D0D] text-[#F5F4EF]" : "text-black/55 hover:bg-black/[0.05] hover:text-black"}`} data-layout={layout} key={layout} onClick={() => api.updateAppearance({ mediaLayout: layout === "featured" ? undefined : layout })} role="radio" type="button">
              <LayoutGlyph layout={layout} />
              {LAYOUT_NAMES[layout]}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
