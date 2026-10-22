"use client";

import { DndContext, KeyboardSensor, PointerSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Link from "next/link";
import { useCallback, useEffect, useId, useState } from "react";

import { KindTile } from "@/components/actions/kind-picker";
import type { ModeSlug } from "@/components/profile/types";
import { ACTION_KIND_SHORT, ACTION_STATUS_LABEL, MODE_KIND_ORDER, actionWindow, type ActionKind, type ProfileAction } from "@/lib/actions/model";
import { createClient } from "@/lib/supabase/client";
import { DragHandle } from "./editor-sections";
import type { EditorApi } from "./editor-types";
import { GroupHead } from "./editor-ui";

type Row = Pick<ProfileAction, "id" | "kind" | "status" | "title" | "sort_order" | "starts_at" | "ends_at">;

// Same addresses as the Actions workspace (lib/actions/studio-server, which is server-only).
const base = (slug: ModeSlug) => (slug === "creator" ? "/app/identity/creator/actions" : "/app/identity/actions");
const listHref = (slug: ModeSlug) => (slug === "creator" ? base(slug) : `${base(slug)}?mode=${slug}`);
const newHref = (slug: ModeSlug, kind?: ActionKind) => {
  const query = [slug === "creator" ? null : `mode=${slug}`, kind ? `kind=${kind}` : null].filter(Boolean).join("&");
  return `${base(slug)}/new${query ? `?${query}` : ""}`;
};

const TONE: Record<Row["status"], string> = {
  published: "bg-[#C7FF4A] text-[#0D0D0D]",
  draft: "bg-[#E6E4DC] text-[#0D0D0D]",
  closed: "text-black/60 shadow-[inset_0_0_0_1px_rgba(13,13,13,.2)]",
  archived: "text-black/45 shadow-[inset_0_0_0_1px_rgba(13,13,13,.12)]",
};

/**
 * The Mode's Actions as part of its page: in the order visitors see them, movable by drag or the arrows,
 * with a quick way to add the kinds that suit this Mode. Responses stay in the Actions workspace.
 */
export function PageActions({ api }: { api: EditorApi }) {
  const { mode, slug, profile } = api;
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const dnd = useId();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 160, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    let cancelled = false;
    void createClient().from("profile_actions").select("id, kind, status, title, sort_order, starts_at, ends_at")
      .eq("mode_id", mode.id).neq("status", "archived").order("sort_order").order("created_at")
      .then(({ data, error: loadError }) => {
        if (cancelled) return;
        if (loadError) { setError("Your Actions didn't load."); setRows([]); return; }
        setRows((data ?? []) as Row[]);
      });
    return () => { cancelled = true; };
  }, [mode.id]);

  const save = useCallback(async (next: Row[]) => {
    const before = rows;
    setRows(next.map((row, index) => ({ ...row, sort_order: index })));
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const results = await Promise.all(next.map((row, index) => row.sort_order === index ? null : supabase.from("profile_actions").update({ sort_order: index }).eq("id", row.id).eq("profile_id", profile.id)));
    setBusy(false);
    if (results.some((result) => result?.error)) { setRows(before); setError("The order didn't save. Try again."); }
  }, [profile.id, rows]);

  function move(index: number, by: -1 | 1) {
    if (!rows || index + by < 0 || index + by >= rows.length) return;
    void save(arrayMove(rows, index, index + by));
  }
  function onDrag({ active, over }: DragEndEvent) {
    if (!rows || !over || active.id === over.id) return;
    const from = rows.findIndex((row) => row.id === active.id);
    const to = rows.findIndex((row) => row.id === over.id);
    if (from >= 0 && to >= 0) void save(arrayMove(rows, from, to));
  }

  const live = rows?.filter((row) => row.status === "published").length ?? 0;
  const kinds = MODE_KIND_ORDER[slug].slice(0, 3);

  return (
    <section aria-label="Actions" className="mt-8" data-page-actions>
      <GroupHead meta={rows === null ? undefined : rows.length ? `${live} live · place them in Page order` : undefined} title="Actions" />
      {!api.actionsLive && rows !== null && rows.length > 0 && <p className="mb-2 rounded-[14px] bg-[#FFF3D6] px-4 py-2.5 text-[13px] leading-5">Visitors don&apos;t see Actions yet. Arrange them now; they appear in this order once Actions go live.</p>}

      {rows === null ? (
        <div aria-hidden="true" className="h-[68px] animate-pulse rounded-[20px] bg-black/[0.04]" />
      ) : rows.length > 0 ? (
        <DndContext collisionDetection={closestCenter} id={dnd} onDragEnd={onDrag} sensors={sensors}>
          <SortableContext items={rows.map((row) => row.id)} strategy={verticalListSortingStrategy}>
            <ul className="grid grid-cols-1 gap-2">
              {rows.map((row, index) => <ActionRow busy={busy} first={index === 0} key={row.id} last={index === rows.length - 1} onMove={(by) => move(index, by)} row={row} slug={slug} />)}
            </ul>
          </SortableContext>
        </DndContext>
      ) : (
        <Link className="group flex items-center gap-4 rounded-[20px] bg-[#0D0D0D] p-4 text-[#F5F4EF] transition hover:bg-black focus-visible:outline-2 focus-visible:outline-offset-2 sm:p-5" data-create-first-action href={listHref(slug)}>
          <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-full bg-[#FF5A4F] text-[22px] font-semibold leading-none text-[#0D0D0D]">+</span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold">Create your first Action</span>
            <span className="mt-0.5 block text-[13px] leading-5 text-[#F5F4EF]/65">A newsletter, a form, a giveaway: a card on your page with its own form, in your Appearance.</span>
          </span>
          <span aria-hidden="true" className="text-lg text-[#F5F4EF]/50 transition-transform group-hover:translate-x-0.5 group-hover:text-[#F5F4EF]">→</span>
        </Link>
      )}
      {error && <p className="mt-2 text-[13px] font-medium text-[#B42318]" role="alert">{error}</p>}

      {rows !== null && rows.length > 0 && <div className="mt-2.5 flex flex-wrap items-center gap-2">
        {kinds.map((kind) => (
          <Link className="inline-flex min-h-10 items-center gap-2 rounded-full border-[1.5px] border-dashed border-black/20 pl-1.5 pr-3.5 text-[13px] font-semibold text-black/75 transition hover:border-black/60 hover:text-black focus-visible:outline-2" href={newHref(slug, kind)} key={kind}>
            <KindTile kind={kind} size={28} />{ACTION_KIND_SHORT[kind]}
          </Link>
        ))}
        <Link className="inline-flex min-h-10 items-center px-2 text-[13px] font-semibold text-black/60 underline decoration-black/20 underline-offset-4 hover:text-black hover:decoration-black" href={newHref(slug)}>All kinds</Link>
        <Link className="ml-auto inline-flex min-h-10 items-center text-[13px] font-semibold text-black/60 hover:text-black" href={listHref(slug)}>Responses →</Link>
      </div>}
    </section>
  );
}

function ActionRow({ row, slug, first, last, busy, onMove }: { row: Row; slug: ModeSlug; first: boolean; last: boolean; busy: boolean; onMove: (by: -1 | 1) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: row.id });
  const ended = row.status === "published" && actionWindow(row) === "ended";
  const status = ended ? "Ended" : ACTION_STATUS_LABEL[row.status];
  const muted = row.status !== "published" || ended;
  return (
    <li className={`flex min-h-[64px] items-center gap-2 rounded-[20px] bg-white pl-1.5 pr-2 shadow-[inset_0_0_0_1px_rgba(13,13,13,.08)] ${isDragging ? "relative z-10 shadow-[0_18px_40px_-18px_rgba(13,13,13,.45)]" : ""}`} data-action-kind={row.kind} ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }}>
      <DragHandle {...attributes} {...listeners} aria-label={`Drag ${row.title}`} />
      <Link className="flex min-w-0 flex-1 items-center gap-3 rounded-[14px] py-2 focus-visible:outline-2" href={`${base(slug)}/${row.id}`}>
        <KindTile kind={row.kind} size={38} />
        <span className="min-w-0 flex-1">
          <span className={`block truncate text-[15px] font-semibold ${muted ? "text-black/60" : ""}`}>{row.title}</span>
          <span className="block truncate text-[12.5px] text-black/50">{ACTION_KIND_SHORT[row.kind]}{row.status === "draft" ? " · not on your page yet" : ""}</span>
        </span>
        <span className={`shrink-0 rounded-[5px] px-2 py-[3px] font-label text-[10px] uppercase tracking-[0.12em] ${TONE[row.status]}`}>{status}</span>
      </Link>
      <span className="flex shrink-0 flex-col">
        <button aria-label={`Move ${row.title} up`} className="grid h-6 w-8 place-items-center rounded-md text-black/45 transition hover:bg-black/[0.05] hover:text-black disabled:opacity-25" disabled={busy || first} onClick={() => onMove(-1)} type="button"><Chevron up /></button>
        <button aria-label={`Move ${row.title} down`} className="grid h-6 w-8 place-items-center rounded-md text-black/45 transition hover:bg-black/[0.05] hover:text-black disabled:opacity-25" disabled={busy || last} onClick={() => onMove(1)} type="button"><Chevron /></button>
      </span>
    </li>
  );
}

function Chevron({ up = false }: { up?: boolean }) {
  return <svg aria-hidden="true" className={`size-3.5 ${up ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6" /></svg>;
}
