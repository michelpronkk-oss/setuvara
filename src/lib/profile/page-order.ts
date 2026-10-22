import type { ModeSlug } from "@/components/profile/types";

/**
 * One order for everything on a Mode's page. Each entry is "kind:id" for a single item (a block,
 * a link, an Action, a Builder project) or "section:name" for a Mode's own section that moves as
 * one piece. Every Mode allows only what it has: projects live on Business and Creator, Creator's
 * Featured/Work/Store/Actions move together as its creator section, and so on.
 */
export type PageItemKind = "block" | "link" | "action" | "project" | "section";
export type PageSection = "testimonials" | "creator" | "audience";

export const PAGE_KINDS: Record<ModeSlug, readonly Exclude<PageItemKind, "section">[]> = {
  personal: ["block", "link", "action"],
  event: ["block", "link", "action"],
  business: ["block", "link", "action", "project"],
  // Creator's Actions sit inside its own sections.
  creator: ["block", "link", "project"],
};
export const PAGE_SECTIONS: Record<ModeSlug, readonly PageSection[]> = {
  personal: [],
  event: [],
  business: ["testimonials"],
  creator: ["audience", "creator"],
};
export const SECTION_NAME: Record<PageSection, string> = { testimonials: "Testimonials", creator: "Featured, work, store and Actions", audience: "Audience" };

export const pageKey = (kind: PageItemKind, id: string) => `${kind}:${id}`;
export function parseKey(key: string): { kind: PageItemKind; id: string } | null {
  const at = key.indexOf(":");
  const kind = key.slice(0, at) as PageItemKind;
  return at > 0 && ["block", "link", "action", "project", "section"].includes(kind) ? { kind, id: key.slice(at + 1) } : null;
}

/** What a Mode has, each list in its own saved order. */
export type PageInventory = { blocks: string[]; links: string[]; actions: string[]; projects: string[]; sections: PageSection[] };

/** Today's order: blocks, links, the Mode's own sections, Actions, projects. */
export function defaultOrder(slug: ModeSlug, have: PageInventory): string[] {
  const kinds = PAGE_KINDS[slug];
  const sections = PAGE_SECTIONS[slug].filter((name) => have.sections.includes(name));
  return [
    ...have.blocks.map((id) => pageKey("block", id)),
    ...have.links.map((id) => pageKey("link", id)),
    ...(slug === "creator" ? sections.map((name) => pageKey("section", name)) : []),
    ...(kinds.includes("action") ? have.actions.map((id) => pageKey("action", id)) : []),
    ...(kinds.includes("project") ? have.projects.map((id) => pageKey("project", id)) : []),
    ...(slug === "business" ? sections.map((name) => pageKey("section", name)) : []),
  ];
}

/**
 * The saved order applied to what exists now: saved entries first (dropping anything gone or not
 * allowed on this Mode), then anything new next to the last item of its kind.
 */
export function resolveOrder(slug: ModeSlug, saved: readonly string[] | null | undefined, have: PageInventory): string[] {
  const fallback = defaultOrder(slug, have);
  if (!saved?.length) return fallback;
  const allowed = new Set(fallback);
  const out = [...new Set(saved)].filter((key) => allowed.has(key));
  const seen = new Set(out);
  for (const key of fallback) {
    if (seen.has(key)) continue;
    const kind = key.slice(0, key.indexOf(":"));
    const last = out.map((item) => item.slice(0, item.indexOf(":"))).lastIndexOf(kind);
    out.splice(last >= 0 ? last + 1 : out.length, 0, key);
    seen.add(key);
  }
  return out;
}

/** Consecutive entries of one kind, so each kind renders with its own component. */
export function pageRuns(order: readonly string[]): { kind: PageItemKind; ids: string[] }[] {
  const runs: { kind: PageItemKind; ids: string[] }[] = [];
  for (const key of order) {
    const item = parseKey(key);
    if (!item) continue;
    const last = runs[runs.length - 1];
    if (last && last.kind === item.kind && item.kind !== "section") last.ids.push(item.id);
    else runs.push({ kind: item.kind, ids: [item.id] });
  }
  return runs;
}

export const PAGE_ORDER_PATTERN = /^((block|link|action|project):[0-9a-f-]{36}|section:(testimonials|creator|audience))$/;
