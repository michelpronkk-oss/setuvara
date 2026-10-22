"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useMemo, useState } from "react";

import { ContentImageControl } from "@/app/app/identity/content-image-control";
import { Field, Segmented, Sheet, TextInput, Toggle } from "@/app/app/identity/editor-ui";
import { parseVideo } from "@/lib/blocks/media";
import { BLOCK_LIMIT, validateBlock } from "@/lib/blocks/registry";
import { collectionsOf, type WorkItem } from "@/lib/creator/studio";
import { FAN_AUDIENCE_LABEL, fanAudienceNote, toLocalInput, type FanAudience, type WorkAccess, type WorkDrop } from "@/lib/creator/fan-drops";
import { createClient } from "@/lib/supabase/client";
import { EmptyState, FilterPill, inkButton, lineButton, Mono, StudioHead } from "./studio-ui";

type Draft = {
  id: string | null;
  kind: "image" | "video";
  title: string;
  credit: string;
  collection: string;
  featured: boolean;
  visible: boolean;
  url: string;
  imagePath: string;
  imageUrl: string;
  /** Who can open it: everyone or one fan audience. Purchase stays with Commerce. */
  audience: FanAudience | "public" | "purchase";
  teaser: string;
  /** A public release date, and an optional earlier opening for one audience (local input values). */
  dropAt: string;
  earlyAudience: FanAudience | "";
  earlyAt: string;
};

const blank = (kind: Draft["kind"]): Draft => ({ id: null, kind, title: "", credit: "", collection: "", featured: false, visible: true, url: "", imagePath: "", imageUrl: "", audience: "public", teaser: "", dropAt: "", earlyAudience: "", earlyAt: "" });
const AUDIENCES: FanAudience[] = ["followers", "connections", "subscribers", "members"];

/**
 * Work is a magazine spread of Creator Mode's image and video blocks. The first piece (or the
 * featured one) gets the weight; each card says its format and the credit line.
 */
export function WorkStudio({ profileId, modeId, items, rawData, blockCount, aside = null, access = {}, drops = {} }: {
  profileId: string;
  modeId: string;
  items: WorkItem[];
  /** Stored block data by id, so edits keep fields the studio doesn't show. */
  rawData: Record<string, Record<string, unknown>>;
  blockCount: number;
  /** Shown beside the empty state, such as the first-run steps. */
  aside?: ReactNode;
  /** Each piece's audience rule and drop, by block id. */
  access?: Record<string, WorkAccess>;
  drops?: Record<string, WorkDrop>;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState("All");
  const [now] = useState(() => Date.now());
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const collections = useMemo(() => collectionsOf(items), [items]);
  const ordered = useMemo(() => {
    const featured = items.find((item) => item.featured);
    return featured ? [featured, ...items.filter((item) => item !== featured)] : items;
  }, [items]);
  const shown = filter === "All" ? ordered : ordered.filter((item) => item.collection === filter);
  const full = blockCount >= BLOCK_LIMIT;

  function edit(item: WorkItem) {
    const data = rawData[item.id] ?? {};
    setError(null);
    const rule = access[item.id];
    const drop = drops[item.id];
    setDraft({ id: item.id, kind: item.kind, title: item.title === "Untitled" || item.title === "Untitled film" ? "" : item.title, credit: item.credit, collection: item.collection, featured: item.featured, visible: item.visible, url: item.url ?? "", imagePath: typeof data.image_path === "string" ? data.image_path : "", imageUrl: item.imageUrl ?? "",
      audience: rule?.access_level ?? "public", teaser: rule?.teaser_title ?? "", dropAt: drop?.starts_at ? toLocalInput(drop.starts_at) : "", earlyAudience: drop?.early_access_level ?? "", earlyAt: drop?.early_access_starts_at ? toLocalInput(drop.early_access_starts_at) : "" });
  }

  async function save() {
    if (!draft) return;
    const supabase = createClient();
    const base = draft.id ? { ...(rawData[draft.id] ?? {}) } : {};
    delete base.image_url; delete base.video_url;
    const data = draft.kind === "image"
      ? { ...base, image_path: draft.imagePath, title: draft.title, credit: draft.credit, collection: draft.collection, featured: draft.featured }
      : { ...base, ...(base.source === "upload" ? {} : { source: "provider", url: draft.url }), title: draft.title, credit: draft.credit, collection: draft.collection, featured: draft.featured };
    const check = validateBlock(draft.kind, data);
    if (!check.ok) { setError(check.message); return; }
    const dropAt = draft.dropAt ? new Date(draft.dropAt) : null;
    const earlyAt = draft.earlyAudience && draft.earlyAt ? new Date(draft.earlyAt) : null;
    if (draft.earlyAudience && (!dropAt || !earlyAt)) { setError("Early access needs a release date and an early date."); return; }
    if (dropAt && earlyAt && earlyAt >= dropAt) { setError("Early access opens before the release date."); return; }
    setBusy(true);
    setError(null);
    const result = draft.id
      ? await supabase.from("profile_blocks").update({ data: check.data, is_visible: draft.visible }).eq("id", draft.id).eq("profile_id", profileId)
      : await supabase.from("profile_blocks").insert({ profile_id: profileId, mode_id: modeId, kind: draft.kind, data: check.data, is_visible: draft.visible, sort_order: blockCount }).select("id").single();
    const blockId = draft.id ?? (result.data as { id: string } | null)?.id ?? null;
    // Who can open it, and when it goes out. Row policies let only the creator write these.
    let accessError = null;
    if (!result.error && blockId && draft.audience !== "purchase") {
      const rule = draft.audience === "public"
        ? await supabase.from("creator_content_rules").delete().eq("profile_block_id", blockId).eq("creator_user_id", profileId)
        : await supabase.from("creator_content_rules").upsert({ profile_block_id: blockId, creator_user_id: profileId, access_level: draft.audience, teaser_title: draft.teaser.trim() || null }, { onConflict: "profile_block_id" });
      const existing = drops[blockId];
      const drop = dropAt
        ? existing
          ? await supabase.from("creator_drops").update({ title: draft.title || "New work", status: "scheduled", starts_at: dropAt.toISOString(), early_access_level: earlyAt ? draft.earlyAudience : null, early_access_starts_at: earlyAt?.toISOString() ?? null }).eq("id", existing.id)
          : await supabase.from("creator_drops").insert({ creator_user_id: profileId, profile_block_id: blockId, title: draft.title || "New work", status: "scheduled", starts_at: dropAt.toISOString(), early_access_level: earlyAt ? draft.earlyAudience : null, early_access_starts_at: earlyAt?.toISOString() ?? null })
        : existing ? await supabase.from("creator_drops").delete().eq("id", existing.id) : { error: null };
      accessError = rule.error ?? drop.error;
    }
    // One piece is featured at a time: the page leads with it.
    if (!result.error && draft.featured) {
      await Promise.all(items.filter((item) => item.featured && item.id !== draft.id).map((item) => {
        const other: Record<string, unknown> = { ...(rawData[item.id] ?? {}), featured: false };
        delete other.image_url; delete other.video_url;
        return supabase.from("profile_blocks").update({ data: other }).eq("id", item.id).eq("profile_id", profileId);
      }));
    }
    setBusy(false);
    if (result.error) { setError("That didn’t save. Try again."); return; }
    if (accessError) { setError("The piece saved, but who can see it didn’t. Try again."); router.refresh(); return; }
    setDraft(null);
    router.refresh();
  }

  async function remove() {
    if (!draft?.id) return;
    setBusy(true);
    const { error: deleteError } = await createClient().from("profile_blocks").delete().eq("id", draft.id).eq("profile_id", profileId);
    setBusy(false);
    if (deleteError) { setError("That didn’t delete. Try again."); return; }
    setDraft(null);
    router.refresh();
  }

  const add = <button className={inkButton} disabled={full} onClick={() => { setError(null); setDraft(blank("image")); }} title={full ? `Creator holds ${BLOCK_LIMIT} pieces of content. Remove one first.` : undefined} type="button">+ Add work</button>;

  return (
    <>
      <StudioHead creator
        action={items.length > 0 ? (
          <div className="flex w-full flex-wrap items-center gap-2 md:w-auto">
            <div className="-mx-3.5 flex min-w-0 flex-1 gap-2 overflow-x-auto px-3.5 pb-1 [scrollbar-width:none] md:mx-0 md:flex-none md:px-0">
              <FilterPill count={items.length} label="All" on={filter === "All"} onClick={() => setFilter("All")} />
              {collections.map((item) => <FilterPill count={item.count} key={item.name} label={item.name} on={filter === item.name} onClick={() => setFilter(item.name)} />)}
            </div>
            {add}
          </div>
        ) : undefined}
        sub={items.length ? `${items.length} ${items.length === 1 ? "piece" : "pieces"}${collections.length ? ` in ${collections.length} ${collections.length === 1 ? "collection" : "collections"}` : ""}` : undefined}
        title="Work"
      />

      {items.length === 0 ? (
        aside
          ? <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-6"><div className="rounded-[26px] bg-white p-6 shadow-[inset_0_0_0_1px_rgba(13,13,13,.08)] md:p-9">{aside}</div><EmptyState action={add} body="Add films, photos or series. Your page leads with the piece you feature, and every card says what it is." title="Show what you make." /></div>
          : <EmptyState action={add} body="Add films, photos or series. Your page leads with the piece you feature, and every card says what it is." title="Show what you make." />
      ) : (
        <div className="grid gap-3.5 md:grid-cols-[1.7fr_1fr_1fr] md:auto-rows-[minmax(300px,1fr)]" data-work-grid>
          {shown.map((item, index) => <WorkCard access={access[item.id]} drop={drops[item.id]} index={index} now={now} item={item} key={item.id} onOpen={() => edit(item)} />)}
        </div>
      )}

      {draft && (
        <Sheet
          footer={(
            <div className="flex flex-wrap items-center justify-between gap-2">
              {draft.id ? <button className="min-h-11 rounded-full px-3 text-sm font-semibold text-[#B42318] hover:bg-[#B42318]/[0.06] disabled:opacity-50" disabled={busy} onClick={() => void remove()} type="button">Delete</button> : <span />}
              <div className="flex gap-2">
                <button className={lineButton} onClick={() => setDraft(null)} type="button">Cancel</button>
                <button className={inkButton} disabled={busy || uploading} onClick={() => void save()} type="button">{busy ? "Saving…" : draft.id ? "Save" : "Add to Work"}</button>
              </div>
            </div>
          )}
          onClose={() => setDraft(null)}
          title={draft.id ? "Edit piece" : "Add work"}
        >
          <div className="grid gap-5">
            {!draft.id && <Segmented label="Kind" onChange={(kind) => setDraft({ ...blank(kind), title: draft.title, credit: draft.credit, collection: draft.collection })} options={[{ value: "image", label: "Photo" }, { value: "video", label: "Film or video" }]} value={draft.kind} />}
            {draft.kind === "image" ? (
              <ContentImageControl imagePath={draft.imagePath} label="Photo" onBusyChange={setUploading} onChange={(path, url) => setDraft((current) => current && { ...current, imagePath: path ?? "", imageUrl: url ?? "" })} previewUrl={draft.imageUrl} profileId={profileId} />
            ) : rawData[draft.id ?? ""]?.source === "upload" ? (
              <p className="rounded-2xl bg-white p-4 text-sm text-black/65 shadow-[inset_0_0_0_1px_rgba(13,13,13,.08)]">Uploaded video. Replace it from the Identity editor.</p>
            ) : (
              <Field hint={draft.url && !parseVideo(draft.url) ? "YouTube, Vimeo, TikTok, Loom or Instagram" : undefined} htmlFor="work-url" label="Link">
                <TextInput id="work-url" inputMode="url" onChange={(event) => setDraft({ ...draft, url: event.target.value })} placeholder="https://youtube.com/watch?v=…" value={draft.url} />
              </Field>
            )}
            <Field htmlFor="work-title" label="Title"><TextInput id="work-title" maxLength={120} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="Salt" value={draft.title} /></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field hint="Client, year or runtime" htmlFor="work-credit" label="Credit line"><TextInput id="work-credit" maxLength={80} onChange={(event) => setDraft({ ...draft, credit: event.target.value })} placeholder="Atlântico · 2026" value={draft.credit} /></Field>
              <Field hint="Groups your filters" htmlFor="work-collection" label="Collection"><TextInput id="work-collection" list="work-collections" maxLength={40} onChange={(event) => setDraft({ ...draft, collection: event.target.value })} placeholder="Films" value={draft.collection} /></Field>
              <datalist id="work-collections">{collections.map((item) => <option key={item.name} value={item.name} />)}</datalist>
            </div>
            <div className="divide-y divide-black/10 rounded-2xl bg-white px-4 shadow-[inset_0_0_0_1px_rgba(13,13,13,.08)]">
              <label className="flex items-center justify-between gap-4 py-2"><span><span className="block text-[15px] font-semibold">Feature on page</span><span className="block text-[13px] text-black/60">Your page leads with it. One at a time.</span></span><Toggle label="Feature on page" on={draft.featured} onChange={(featured) => setDraft({ ...draft, featured })} /></label>
              <label className="flex items-center justify-between gap-4 py-2"><span><span className="block text-[15px] font-semibold">Show on page</span><span className="block text-[13px] text-black/60">Hidden pieces stay here.</span></span><Toggle label="Show on page" on={draft.visible} onChange={(visible) => setDraft({ ...draft, visible })} /></label>
            </div>
            <div className="rounded-2xl bg-white p-4 shadow-[inset_0_0_0_1px_rgba(13,13,13,.08)]" data-work-access>
              <p className="text-[15px] font-semibold">Who can see it</p>
              {draft.audience === "purchase" ? (
                <p className="mt-1 text-[13px] text-black/60">Unlocked by a purchase. Change it in Commerce.</p>
              ) : (
                <>
                  <div aria-label="Who can see it" className="mt-3 flex flex-wrap gap-1.5" role="radiogroup">
                    {(["public", ...AUDIENCES] as const).map((value) => (
                      <button aria-checked={draft.audience === value} className={`min-h-10 rounded-full px-3.5 text-[13.5px] font-semibold transition ${draft.audience === value ? "bg-[#0D0D0D] text-[#F5F4EF]" : "shadow-[inset_0_0_0_1px_rgba(13,13,13,.14)] hover:bg-black/[0.03]"}`} key={value} onClick={() => setDraft({ ...draft, audience: value })} role="radio" type="button">{value === "public" ? "Everyone" : FAN_AUDIENCE_LABEL[value]}</button>
                    ))}
                  </div>
                  <p className="mt-2 text-[13px] text-black/60">{draft.audience === "public" ? "Anyone on your page sees it." : `${fanAudienceNote(draft.audience)} Everyone else sees a locked card.`}</p>
                  {draft.audience !== "public" && <div className="mt-3"><Field htmlFor="work-teaser" label="Locked card line"><TextInput id="work-teaser" maxLength={120} onChange={(event) => setDraft({ ...draft, teaser: event.target.value })} placeholder="Behind the scenes, for followers" value={draft.teaser} /></Field></div>}
                </>
              )}
            </div>
            <div className="rounded-2xl bg-white p-4 shadow-[inset_0_0_0_1px_rgba(13,13,13,.08)]" data-work-drop>
              <p className="text-[15px] font-semibold">Drop</p>
              <p className="mt-1 text-[13px] text-black/60">Release it on a date. Optionally let one audience in early.</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Field htmlFor="work-drop-at" label="Release"><TextInput id="work-drop-at" onChange={(event) => setDraft({ ...draft, dropAt: event.target.value })} type="datetime-local" value={draft.dropAt} /></Field>
                <Field htmlFor="work-early-at" label="Early access from"><TextInput disabled={!draft.dropAt} id="work-early-at" onChange={(event) => setDraft({ ...draft, earlyAt: event.target.value, earlyAudience: draft.earlyAudience || "followers" })} type="datetime-local" value={draft.earlyAt} /></Field>
              </div>
              {draft.dropAt && draft.earlyAt && (
                <div aria-label="Early access for" className="mt-3 flex flex-wrap gap-1.5" role="radiogroup">
                  {AUDIENCES.map((value) => <button aria-checked={draft.earlyAudience === value} className={`min-h-10 rounded-full px-3.5 text-[13.5px] font-semibold transition ${draft.earlyAudience === value ? "bg-[#E8A6FF] text-[#0D0D0D]" : "shadow-[inset_0_0_0_1px_rgba(13,13,13,.14)] hover:bg-black/[0.03]"}`} key={value} onClick={() => setDraft({ ...draft, earlyAudience: value })} role="radio" type="button">{FAN_AUDIENCE_LABEL[value]}</button>)}
                </div>
              )}
              {draft.dropAt && <button className="mt-3 text-[13px] font-semibold text-black/55 underline-offset-4 hover:underline" onClick={() => setDraft({ ...draft, dropAt: "", earlyAt: "", earlyAudience: "" })} type="button">Remove the release date</button>}
            </div>
            {error && <p className="text-sm font-medium text-[#B42318]" role="alert">{error}</p>}
          </div>
        </Sheet>
      )}
    </>
  );
}

function WorkCard({ item, index, onOpen, access, drop, now }: { item: WorkItem; index: number; onOpen: () => void; access?: WorkAccess; drop?: WorkDrop; now: number }) {
  const upcoming = drop?.starts_at && new Date(drop.starts_at).getTime() > now ? new Date(drop.starts_at) : null;
  const lead = index === 0;
  const kind = item.kind === "video" ? "FILM" : "PHOTO";
  return (
    <button className={`group relative isolate flex min-h-[260px] flex-col justify-between overflow-hidden rounded-[22px] bg-[#0D0D0D] p-4 text-left text-[#F5F4EF] focus-visible:outline-2 focus-visible:outline-offset-2 md:p-5 ${lead ? "min-h-[420px] md:row-span-2" : ""} ${item.visible ? "" : "opacity-55"}`} data-work-card onClick={onOpen} type="button">
      {item.imageUrl && <>
        {/* eslint-disable-next-line @next/next/no-img-element -- signed Supabase image or provider thumbnail */}
        <img alt="" className="absolute inset-0 -z-10 size-full object-cover transition duration-500 group-hover:scale-[1.02]" src={item.imageUrl} />
      </>}
      <span aria-hidden="true" className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(13,13,13,.35)_0%,transparent_30%,transparent_55%,rgba(13,13,13,.75)_100%)]" />
      <span className="flex items-start justify-between gap-3">
        <Mono className="!text-[10px] !tracking-[0.18em]">{kind}{item.collection ? ` · ${item.collection}` : ""}</Mono>
        <span className="flex gap-1.5">
          {!item.visible && <span className="rounded-full bg-white/15 px-2.5 py-1 font-label text-[10px] tracking-[0.14em] backdrop-blur">HIDDEN</span>}
          {access && access.access_level !== "public" && <span className="rounded-full bg-white/15 px-2.5 py-1 font-label text-[10px] uppercase tracking-[0.14em] backdrop-blur" data-work-badge="access">{access.access_level === "purchase" ? "Purchase" : FAN_AUDIENCE_LABEL[access.access_level]}</span>}
          {upcoming && <span className="rounded-full bg-[#E8A6FF] px-2.5 py-1 font-label text-[10px] uppercase tracking-[0.14em] text-[#0D0D0D]" data-work-badge="drop">Drops {upcoming.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>}
          {item.featured && <span className="rounded-full bg-[#FF5A4F] px-2.5 py-1 font-label text-[10px] tracking-[0.14em] text-[#0D0D0D]">FEATURED ON PAGE</span>}
        </span>
      </span>
      {item.kind === "video" && <span aria-hidden="true" className={`absolute left-1/2 top-1/2 grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-[#F5F4EF]/90 text-[#0D0D0D] ${lead ? "size-[72px]" : "size-14"}`}><svg className={lead ? "ml-1 size-7" : "ml-0.5 size-5"} fill="currentColor" viewBox="0 0 24 24"><path d="M7 4.5v15l12.5-7.5L7 4.5Z" /></svg></span>}
      <span className="flex flex-col gap-0.5">
        <span className={`font-semibold tracking-[-0.02em] ${lead ? "text-[30px] leading-tight" : "text-lg"}`}>{item.title}</span>
        {item.credit && <span className="text-sm text-white/75">{item.credit}</span>}
      </span>
    </button>
  );
}
