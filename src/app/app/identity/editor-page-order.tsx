"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { KindTile } from "@/components/actions/kind-picker";
import type { ModeSlug, ProfileBlock, ProfileLink } from "@/components/profile/types";
import { ACTION_KIND_SHORT, ACTION_STATUS_LABEL, actionWindow, type ActionKind, type ProfileAction } from "@/lib/actions/model";
import { PAGE_KINDS, PAGE_SECTIONS, SECTION_NAME, parseKey, resolveOrder, type PageInventory, type PageSection } from "@/lib/profile/page-order";
import { createClient } from "@/lib/supabase/client";
import { DragHandle } from "./editor-sections";
import type { EditorApi } from "./editor-types";
import { BlockIcon } from "./editor-ui";

export type PageAction = Pick<ProfileAction, "id" | "kind" | "status" | "title" | "sort_order" | "starts_at" | "ends_at">;
export type PageProject = { id: string; name: string; visibility: string; sort_order: number };

/** One row of "Your page", in the order visitors see it. */
export type PageItem =
  | { key: string; kind: "block"; block: ProfileBlock }
  | { key: string; kind: "link"; link: ProfileLink }
  | { key: string; kind: "action"; action: PageAction }
  | { key: string; kind: "project"; project: PageProject }
  | { key: string; kind: "section"; section: PageSection };

const actionsBase = (slug: ModeSlug) => (slug === "creator" ? "/app/identity/creator/actions" : "/app/identity/actions");

/**
 * Everything on a Mode's page as one ordered list: blocks, links, Actions, Builder projects and
 * the Mode's own sections, each Mode only what it can show. The soundtrack is not part of it; it
 * keeps its own place. Moving a row saves the page order and keeps each kind's own order in step.
 */
export function usePageItems(api: EditorApi) {
  const { mode, slug, profile } = api;
  const [actions, setActions] = useState<PageAction[]>([]);
  const [projects, setProjects] = useState<PageProject[]>([]);
  const [audience, setAudience] = useState(false);
  const [saved, setSaved] = useState<string[] | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    let live = true;
    const supabase = createClient();
    const kinds = PAGE_KINDS[slug];
    void Promise.all([
      supabase.from("mode_page_order").select("items").eq("mode_id", mode.id).maybeSingle(),
      kinds.includes("action") ? supabase.from("profile_actions").select("id, kind, status, title, sort_order, starts_at, ends_at").eq("mode_id", mode.id).neq("status", "archived").order("sort_order").order("created_at") : Promise.resolve({ data: [] }),
      kinds.includes("project") ? supabase.from("builder_projects").select("id, name, visibility, sort_order").eq("mode_id", mode.id).order("sort_order") : Promise.resolve({ data: [] }),
      slug === "creator" ? supabase.from("social_accounts").select("id", { count: "exact", head: true }).eq("profile_id", profile.id).eq("show_on_page", true) : Promise.resolve({ count: 0 }),
    ]).then(([order, actionRows, projectRows, social]) => {
      if (!live) return;
      setSaved(Array.isArray(order.data?.items) ? order.data.items as string[] : null);
      setActions((actionRows.data ?? []) as PageAction[]);
      setProjects((projectRows.data ?? []) as PageProject[]);
      setAudience(((social as { count?: number | null }).count ?? 0) > 0);
      setLoaded(true);
    });
    return () => { live = false; };
  }, [mode.id, profile.id, slug]);

  const blocks = useMemo(() => (mode.blocks ?? []).filter((block) => !block.is_soundtrack), [mode.blocks]);
  const sections: PageSection[] = PAGE_SECTIONS[slug].filter((name) => name !== "audience" || audience);
  const have: PageInventory = { blocks: blocks.map((b) => b.id), links: mode.links.map((l) => l.id), actions: actions.map((a) => a.id), projects: projects.map((p) => p.id), sections };
  const order = resolveOrder(slug, saved, have);

  const items: PageItem[] = order.flatMap((key): PageItem[] => {
    const item = parseKey(key);
    if (!item) return [];
    if (item.kind === "block") { const block = blocks.find((x) => x.id === item.id); return block ? [{ key, kind: "block", block }] : []; }
    if (item.kind === "link") { const link = mode.links.find((x) => x.id === item.id); return link ? [{ key, kind: "link", link }] : []; }
    if (item.kind === "action") { const action = actions.find((x) => x.id === item.id); return action ? [{ key, kind: "action", action }] : []; }
    if (item.kind === "project") { const project = projects.find((x) => x.id === item.id); return project ? [{ key, kind: "project", project }] : []; }
    return [{ key, kind: "section", section: item.id as PageSection }];
  });

  // The preview follows a saved order; labels stand in for what it can't draw.
  const orderKey = saved ? order.join(",") : "";
  const labelKey = items.flatMap((row) => row.kind === "action" && row.action.status === "published" ? [`${row.key}=${row.action.title || "Untitled Action"}`]
    : row.kind === "project" && row.project.visibility === "public" ? [`${row.key}=${row.project.name}`]
    : row.kind === "section" ? [`${row.key}=${SECTION_NAME[row.section]}`] : []).join("|");
  const { setPageOrder } = api;
  useEffect(() => {
    if (!loaded) return;
    const labels = Object.fromEntries(labelKey ? labelKey.split("|").map((pair) => { const [key, ...title] = pair.split("="); return [key, { kind: key.slice(0, key.indexOf(":")), title: title.join("=") }]; }) : []);
    setPageOrder(orderKey ? { order: orderKey.split(","), labels } : null);
  }, [orderKey, labelKey, loaded, setPageOrder]);

  async function save(next: string[] | null) {
    setSaved(next);
    setStatus("Saving…");
    const supabase = createClient();
    const result = next
      ? await supabase.from("mode_page_order").upsert({ mode_id: mode.id, profile_id: profile.id, items: next }, { onConflict: "mode_id" })
      : await supabase.from("mode_page_order").delete().eq("mode_id", mode.id);
    if (result.error) { setStatus("That didn't save. Try again."); return; }
    setStatus(next ? "" : "Back to the default order.");
    if (!next) return;
    // Keep each kind's own order in step, so every other place lists them the same way.
    const ids = (kind: string) => next.filter((key) => key.startsWith(`${kind}:`)).map((key) => key.slice(kind.length + 1));
    const blockIds = ids("block");
    if (blockIds.join() !== blocks.map((b) => b.id).join()) {
      const soundtrack = (mode.blocks ?? []).filter((block) => block.is_soundtrack);
      api.reorderBlocks([...soundtrack, ...blockIds.flatMap((id) => blocks.filter((b) => b.id === id))]);
    }
    const linkIds = ids("link");
    if (linkIds.join() !== mode.links.map((l) => l.id).join()) api.reorderLinks(linkIds.flatMap((id) => mode.links.filter((l) => l.id === id)));
    const actionIds = ids("action");
    if (actionIds.join() !== actions.map((a) => a.id).join()) {
      setActions(actionIds.flatMap((id, index) => actions.filter((a) => a.id === id).map((a) => ({ ...a, sort_order: index }))));
      await Promise.all(actionIds.map((id, index) => supabase.from("profile_actions").update({ sort_order: index }).eq("id", id).eq("profile_id", profile.id)));
    }
    const projectIds = ids("project");
    if (projectIds.join() !== projects.map((p) => p.id).join()) {
      setProjects(projectIds.flatMap((id, index) => projects.filter((p) => p.id === id).map((p) => ({ ...p, sort_order: index }))));
      await Promise.all(projectIds.map((id, index) => supabase.from("builder_projects").update({ sort_order: index }).eq("id", id)));
    }
  }

  return { items, order, saved, loaded, status, save, actionsCount: actions.length };
}

/** Drag wiring shared by the rows below. */
function sortStyle(transform: Parameters<typeof CSS.Transform.toString>[0], transition: string | undefined) {
  return { transform: CSS.Transform.toString(transform ? { ...transform, scaleX: 1, scaleY: 1 } : null), transition };
}

const rowClass = (dragging: boolean) => `min-w-0 rounded-[18px] bg-white transition-shadow ${dragging ? "relative z-10 shadow-[0_24px_50px_-20px_rgba(13,13,13,.45),inset_0_0_0_2px_#0D0D0D]" : "shadow-[inset_0_0_0_1px_rgba(13,13,13,.08)]"}`;

function Tag({ children, tone = "line" }: { children: string; tone?: "line" | "live" | "ink" }) {
  const cls = tone === "live" ? "bg-[#C7FF4A] text-[#0D0D0D]" : tone === "ink" ? "bg-[#0D0D0D] text-[#F5F4EF]" : "shadow-[inset_0_0_0_1px_rgba(13,13,13,.3)]";
  return <span className={`shrink-0 rounded-full px-2 py-0.5 font-label text-[9px] uppercase tracking-[0.1em] max-[389px]:hidden ${cls}`}>{children}</span>;
}

export function ActionPageRow({ action, slug }: { action: PageAction; slug: ModeSlug }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: `action:${action.id}` });
  const ended = action.status === "published" && actionWindow(action) === "ended";
  const live = action.status === "published" && !ended;
  const href = `${actionsBase(slug)}/${action.id}`;
  return (
    <li className={rowClass(isDragging)} data-action-kind={action.kind} ref={setNodeRef} style={sortStyle(transform, transition)}>
      <div className="flex min-h-[66px] items-center gap-1.5 py-2 pl-1 pr-1 sm:gap-2">
        <DragHandle {...attributes} {...listeners} />
        <KindTile kind={action.kind as ActionKind} size={40} />
        <Link className={`min-w-0 flex-1 px-1.5 ${live ? "" : "opacity-55"}`} href={href}>
          <span className="flex items-center gap-2"><span className="truncate text-[15px] font-semibold">{action.title || "Untitled Action"}</span><Tag tone={live ? "live" : "line"}>{ended ? "Ended" : ACTION_STATUS_LABEL[action.status]}</Tag></span>
          <span className="block truncate text-[13px] text-black/55">Action · {ACTION_KIND_SHORT[action.kind as ActionKind]}{action.status === "draft" ? " · publish to show it" : ""}</span>
        </Link>
        <Link aria-label={`Edit ${action.title}`} className="grid size-10 shrink-0 place-items-center rounded-full text-black/40 transition hover:bg-black/[0.05] hover:text-black" href={href}><Arrow /></Link>
      </div>
    </li>
  );
}

const PROJECT_ICON = "M4 5h16v11H4zM8 20h8M12 16v4";
export function ProjectPageRow({ project, href }: { project: PageProject; href: string }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: `project:${project.id}` });
  const live = project.visibility === "public";
  return (
    <li className={rowClass(isDragging)} ref={setNodeRef} style={sortStyle(transform, transition)}>
      <div className="flex min-h-[66px] items-center gap-1.5 py-2 pl-1 pr-1 sm:gap-2">
        <DragHandle {...attributes} {...listeners} />
        <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#AFCBFF] text-[#0D0D0D]"><svg className="size-5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24"><path d={PROJECT_ICON} /></svg></span>
        <Link className={`min-w-0 flex-1 px-1.5 ${live ? "" : "opacity-55"}`} href={href}>
          <span className="flex items-center gap-2"><span className="truncate text-[15px] font-semibold">{project.name}</span>{!live && <Tag>Draft</Tag>}</span>
          <span className="block truncate text-[13px] text-black/55">Builder project</span>
        </Link>
        <Link aria-label={`Edit ${project.name}`} className="grid size-10 shrink-0 place-items-center rounded-full text-black/40 transition hover:bg-black/[0.05] hover:text-black" href={href}><Arrow /></Link>
      </div>
    </li>
  );
}

const SECTION_ICON: Record<PageSection, string> = {
  testimonials: "M7 7h4v4H8a3 3 0 0 0 3 3v2a5 5 0 0 1-5-5V8a1 1 0 0 1 1-1Zm8 0h4v4h-3a3 3 0 0 0 3 3v2a5 5 0 0 1-5-5V8a1 1 0 0 1 1-1Z",
  audience: "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm-7 9c.6-3.4 3.3-5.5 7-5.5s6.4 2.1 7 5.5H2Z",
  creator: "M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7L12 3Z",
};
const SECTION_NOTE: Record<PageSection, string> = {
  testimonials: "Shows when you have published testimonials",
  audience: "Your connected platforms and follower counts",
  creator: "Moves as one piece · order its parts in Creator settings",
};
export function SectionPageRow({ section, href }: { section: PageSection; href?: string }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: `section:${section}` });
  return (
    <li className={rowClass(isDragging)} ref={setNodeRef} style={sortStyle(transform, transition)}>
      <div className="flex min-h-[66px] items-center gap-1.5 py-2 pl-1 pr-1 sm:gap-2">
        <DragHandle {...attributes} {...listeners} />
        <BlockIcon className="size-10 rounded-xl bg-[#0D0D0D] text-[#E8A6FF]" path={SECTION_ICON[section]} />
        <span className="min-w-0 flex-1 px-1.5">
          <span className="flex items-center gap-2"><span className="truncate text-[15px] font-semibold">{SECTION_NAME[section]}</span><Tag tone="ink">Section</Tag></span>
          <span className="block truncate text-[13px] text-black/55">{SECTION_NOTE[section]}</span>
        </span>
        {href && <Link aria-label={`Edit ${SECTION_NAME[section]}`} className="grid size-10 shrink-0 place-items-center rounded-full text-black/40 transition hover:bg-black/[0.05] hover:text-black" href={href}><Arrow /></Link>}
      </div>
    </li>
  );
}

function Arrow() {
  return <svg aria-hidden="true" className="size-[18px]" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24"><path d="m9 6 6 6-6 6" /></svg>;
}

