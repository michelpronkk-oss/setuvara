"use client";

import { DndContext, KeyboardSensor, PointerSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Link from "next/link";
import { useEffect, useId, useMemo, useState } from "react";

import { providerForLink } from "@/lib/links/providers";
import { BLOCKS } from "@/lib/blocks/registry";
import { PAGE_KINDS, PAGE_SECTIONS, SECTION_NAME, parseKey, resolveOrder, type PageInventory, type PageSection } from "@/lib/profile/page-order";
import { createClient } from "@/lib/supabase/client";
import { DragHandle } from "./editor-sections";
import type { EditorApi } from "./editor-types";
import { GroupHead, modeMeta } from "./editor-ui";

type Extra = { actions: { id: string; title: string; status: string }[]; projects: { id: string; name: string; visibility: string }[]; audience: boolean; loaded: boolean };
type Row = { key: string; kind: string; title: string; note: string; hidden: boolean; href?: string };

const KIND_STYLE: Record<string, { label: string; bg: string; fg: string }> = {
  block: { label: "Block", bg: "#F5F4EF", fg: "#0D0D0D" },
  link: { label: "Link", bg: "#F5F4EF", fg: "#0D0D0D" },
  action: { label: "Action", bg: "#C7FF4A", fg: "#0D0D0D" },
  project: { label: "Project", bg: "#AFCBFF", fg: "#0D0D0D" },
  section: { label: "Section", bg: "#0D0D0D", fg: "#F5F4EF" },
};

/**
 * Everything on this Mode's page in one list. Drag anything above anything: blocks, links,
 * Actions, Builder projects and the Mode's own sections. Each Mode lists only what it can show.
 * The order saves on drop; Reset goes back to the default (blocks, links, then the rest).
 */
export function PageOrder({ api }: { api: EditorApi }) {
  const { mode, slug, profile } = api;
  const dndId = useId();
  const [extra, setExtra] = useState<Extra>({ actions: [], projects: [], audience: false, loaded: false });
  const [saved, setSaved] = useState<string[] | null>(null);
  const [status, setStatus] = useState("");
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 160, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    let live = true;
    const supabase = createClient();
    const kinds = PAGE_KINDS[slug];
    void Promise.all([
      supabase.from("mode_page_order").select("items").eq("mode_id", mode.id).maybeSingle(),
      kinds.includes("action") ? supabase.from("profile_actions").select("id, title, status, sort_order").eq("mode_id", mode.id).neq("status", "archived").order("sort_order") : Promise.resolve({ data: [] }),
      kinds.includes("project") ? supabase.from("builder_projects").select("id, name, visibility, sort_order").eq("mode_id", mode.id).order("sort_order") : Promise.resolve({ data: [] }),
      slug === "creator" ? supabase.from("social_accounts").select("id", { count: "exact", head: true }).eq("profile_id", profile.id).eq("show_on_page", true) : Promise.resolve({ count: 0 }),
    ]).then(([order, actions, projects, social]) => {
      if (!live) return;
      setSaved(Array.isArray(order.data?.items) ? order.data.items as string[] : null);
      setExtra({ actions: (actions.data ?? []) as Extra["actions"], projects: (projects.data ?? []) as Extra["projects"], audience: ((social as { count?: number | null }).count ?? 0) > 0, loaded: true });
    });
    return () => { live = false; };
  }, [mode.id, profile.id, slug]);

  const blocks = useMemo(() => (mode.blocks ?? []).filter((block) => !block.is_soundtrack), [mode.blocks]);
  const sections: PageSection[] = PAGE_SECTIONS[slug].filter((name) => name !== "audience" || extra.audience);
  const have: PageInventory = { blocks: blocks.map((b) => b.id), links: mode.links.map((l) => l.id), actions: extra.actions.map((a) => a.id), projects: extra.projects.map((p) => p.id), sections };
  const order = resolveOrder(slug, saved, have);
  const builderHref = slug === "creator" ? "/app/identity/creator/builder" : "/app/identity/builder?mode=business";

  const rows: Row[] = order.flatMap((key): Row[] => {
    const item = parseKey(key);
    if (!item) return [];
    if (item.kind === "block") { const b = blocks.find((x) => x.id === item.id); return b ? [{ key, kind: "block", title: BLOCKS[b.kind].name, note: "Block", hidden: !b.is_visible }] : []; }
    if (item.kind === "link") { const l = mode.links.find((x) => x.id === item.id); return l ? [{ key, kind: "link", title: l.title || providerForLink(l.link_type).name, note: providerForLink(l.link_type).name, hidden: !l.is_visible }] : []; }
    if (item.kind === "action") { const a = extra.actions.find((x) => x.id === item.id); return a ? [{ key, kind: "action", title: a.title || "Untitled Action", note: a.status === "published" ? "Action · Live" : "Action · Draft", hidden: a.status !== "published" }] : []; }
    if (item.kind === "project") { const p = extra.projects.find((x) => x.id === item.id); return p ? [{ key, kind: "project", title: p.name, note: p.visibility === "public" ? "Builder project" : "Builder project · Draft", hidden: p.visibility !== "public", href: `${builderHref}${builderHref.includes("?") ? "&" : "?"}project=${p.id}` }] : []; }
    return [{ key, kind: "section", title: SECTION_NAME[item.id as PageSection] ?? item.id, note: item.id === "creator" ? "Creator sections · order them in Creator settings" : "Shows when it has something", hidden: false }];
  });

  // The preview follows the saved order as it changes; labels stand in for what it can't draw.
  const orderKey = saved ? order.join(",") : "";
  const labelKey = rows.filter((row) => !row.hidden && !["block", "link"].includes(row.kind)).map((row) => `${row.key}=${row.title}`).join("|");
  const { setPageOrder } = api;
  useEffect(() => {
    if (!extra.loaded) return;
    const labels = Object.fromEntries(labelKey ? labelKey.split("|").map((pair) => { const [key, ...title] = pair.split("="); return [key, { kind: key.slice(0, key.indexOf(":")), title: title.join("=") }]; }) : []);
    setPageOrder(orderKey ? { order: orderKey.split(","), labels } : null);
  }, [orderKey, labelKey, extra.loaded, setPageOrder]);

  async function save(next: string[] | null) {
    setSaved(next);
    setStatus("Saving…");
    const supabase = createClient();
    const result = next
      ? await supabase.from("mode_page_order").upsert({ mode_id: mode.id, profile_id: profile.id, items: next }, { onConflict: "mode_id" })
      : await supabase.from("mode_page_order").delete().eq("mode_id", mode.id);
    setStatus(result.error ? "That didn't save. Try again." : next ? "Saved. Your page follows this order." : "Back to the default order.");
  }

  function onDrag({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const from = order.indexOf(String(active.id));
    const to = order.indexOf(String(over.id));
    if (from >= 0 && to >= 0) void save(arrayMove(order, from, to));
  }

  if (!extra.loaded || rows.length < 2) return null;
  return (
    <section aria-label="Page order" className="mt-8" data-page-order>
      <GroupHead meta={saved ? <button className="text-[13px] font-semibold text-black/50 underline-offset-4 hover:text-black hover:underline" onClick={() => void save(null)} type="button">Reset</button> : "Default"} title="Page order" />
      <p className="-mt-1 mb-3 px-0.5 text-[13px] leading-[1.45] text-black/55">Everything on your {modeMeta[slug].name} page, top to bottom. Drag anything above anything.</p>
      <DndContext collisionDetection={closestCenter} id={dndId} onDragEnd={onDrag} sensors={sensors}>
        <SortableContext items={rows.map((row) => row.key)} strategy={verticalListSortingStrategy}>
          <ol className="grid grid-cols-1 gap-1.5 rounded-[22px] bg-[#0D0D0D]/[0.035] p-1.5">
            {rows.map((row, index) => <OrderRow index={index} key={row.key} row={row} />)}
          </ol>
        </SortableContext>
      </DndContext>
      {status && <p className="mt-2 px-0.5 text-[12.5px] text-black/55" role="status">{status}</p>}
    </section>
  );
}

function OrderRow({ row, index }: { row: Row; index: number }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: row.key });
  const style = KIND_STYLE[row.kind];
  return (
    <li className={`flex min-h-[52px] items-center gap-2.5 rounded-[16px] bg-white pr-3 shadow-[0_1px_0_rgba(13,13,13,.04)] ${isDragging ? "relative z-10 shadow-[0_18px_40px_-18px_#0D0D0D80]" : ""}`} ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }}>
      <DragHandle {...attributes} {...listeners} />
      <span className="w-5 shrink-0 font-label text-[11px] text-black/35">{String(index + 1).padStart(2, "0")}</span>
      <span className="shrink-0 rounded-full px-2 py-0.5 font-label text-[9.5px] uppercase tracking-[0.12em]" style={{ background: style.bg, color: style.fg }}>{style.label}</span>
      <span className={`min-w-0 flex-1 ${row.hidden ? "opacity-45" : ""}`}><span className="block truncate text-[14px] font-semibold">{row.title}</span><span className="block truncate text-[12px] text-black/50">{row.note}{row.hidden ? " · not shown" : ""}</span></span>
      {row.href && <Link className="shrink-0 text-[12.5px] font-semibold text-black/50 hover:text-black" href={row.href}>Edit</Link>}
    </li>
  );
}
