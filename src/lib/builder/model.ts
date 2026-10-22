/** Builder Showcase: projects, roadmaps and updates on Creator and Business Mode. */

export const PROJECT_STATUSES = ["building", "live", "paused", "shipped", "acquired"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = { building: "Building", live: "Live", paused: "Paused", shipped: "Shipped", acquired: "Acquired" };

export const ROADMAP_STAGES = ["planned", "in_progress", "shipped"] as const;
export type RoadmapStage = (typeof ROADMAP_STAGES)[number];
export const ROADMAP_STAGE_LABEL: Record<RoadmapStage, string> = { planned: "Planned", in_progress: "In progress", shipped: "Shipped" };

export type RoadmapItem = { id: string; title: string; description: string; stage: RoadmapStage; progress: number; target_date: string | null; shipped_at: string | null; is_public?: boolean; sort_order?: number; votes?: number };
export type ProjectUpdate = { id: string; title: string; body: string; published_at: string };
export type BuilderProject = {
  id: string; slug: string; name: string; tagline: string; description: string; url: string | null; status: ProjectStatus;
  category: string; tech_stack: string[]; launched_on: string | null; logo_block_id: string | null; cover_block_id: string | null;
  visibility?: "draft" | "public"; roadmap_public?: boolean; sort_order?: number; voting_enabled?: boolean; suggestions_enabled?: boolean; revenue_visibility?: RevenueVisibility;
};
export type PublicProject = BuilderProject & { roadmap: RoadmapItem[]; updates: ProjectUpdate[]; action_ids: string[]; voting?: boolean; suggestions?: boolean; revenue?: PublicRevenue[] };
export type RevenueVisibility = "hidden" | "exact" | "range" | "growth";
/** One provider's verified figure, already reduced to what the owner chose to show. */
export type PublicRevenue = { provider: "stripe" | "revenuecat" | "dodo" | "paddle"; currency: string; synced_at: string; visibility: RevenueVisibility; mrr_minor: number | null; arr_minor: number | null; paying_customers: number | null; band: string | null; growth_pct: number | null; preview?: boolean; test?: boolean; stale?: boolean; trend?: number[] | null; reconstructed?: boolean };
export type BuilderActivity = { voted: string[]; suggestions: { id: string; title: string; status: string; stage: string | null; created_at: string }[] };
export type BuilderViewer = { signedIn: boolean; loginHref: string; activity: Record<string, BuilderActivity> };
export type BuilderLimits = { plan: "free" | "plus" | "pro"; public_projects: number; roadmap_items: number; suggestions?: boolean; export?: boolean };
export const DEFAULT_BUILDER_LIMITS: BuilderLimits = { plan: "free", public_projects: 1, roadmap_items: 15, suggestions: false, export: false };

export const PROJECT_COLUMNS = "id, slug, name, tagline, description, url, status, category, tech_stack, launched_on, logo_block_id, cover_block_id, visibility, roadmap_public, sort_order, voting_enabled, suggestions_enabled, revenue_visibility";
export const ROADMAP_COLUMNS = "id, project_id, title, description, stage, progress, target_date, shipped_at, is_public, sort_order";
export const UPDATE_COLUMNS = "id, project_id, title, body, published_at";

export const BUILDER_ERRORS: Record<string, string> = {
  plan_project_limit: "Your plan's public projects are all in use. Keep this one as a draft or upgrade.",
  plan_roadmap_limit: "This roadmap is full on your plan.",
  builder_image_invalid: "Pick an image from this Mode.",
  builder_stack_invalid: "Each stack item is 1–30 characters.",
  builder_projects_owner_user_id_slug_key: "You already have a project with that link name.",
  duplicate: "You already have a project with that link name.",
};
export const builderError = (message?: string) => Object.entries(BUILDER_ERRORS).find(([key]) => message?.includes(key))?.[1] ?? "That didn't save. Try again.";

/** "My SaaS!" → "my-saas". */
export function projectSlug(name: string) {
  return name.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "project";
}
/** Comma-separated stack → clean, de-duplicated list (max 12). */
export function parseStack(value: string) {
  const seen = new Set<string>();
  return value.split(",").map((item) => item.trim().slice(0, 30)).filter((item) => item && !seen.has(item.toLowerCase()) && seen.add(item.toLowerCase())).slice(0, 12);
}
export function byStage(items: RoadmapItem[]) {
  const out: Record<RoadmapStage, RoadmapItem[]> = { planned: [], in_progress: [], shipped: [] };
  for (const item of items) out[item.stage].push(item);
  out.shipped.sort((a, b) => (b.shipped_at ?? "").localeCompare(a.shipped_at ?? ""));
  return out;
}
export const safeHttps = (value: string | null) => (value && /^https:\/\/[^\s/]+\.[^\s]+$/i.test(value) ? value : null);

export type BuilderSuggestion = { id: string; project_id: string; title: string; body: string; status: "pending" | "approved" | "declined"; created_at: string; roadmap_item_id: string | null };
export type BuilderInsights = { items: { id: string; title: string; stage: RoadmapStage; votes: number; votes_30d: number }[]; voters: number; pending: number; approved: number; declined: number; can_export: boolean };

/** Aggregate vote counts as CSV: no voter or author is ever in it. */
export function insightsCsv(projectName: string, insights: BuilderInsights) {
  const cell = (value: string | number) => { const text = String(value); return /^[=+\-@\t\r]/.test(text) ? `"'${text.replace(/"/g, '""')}"` : /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text; };
  const rows = [["project", "item", "stage", "votes", "votes_last_30_days"], ...insights.items.map((item) => [projectName, item.title, item.stage, item.votes, item.votes_30d])];
  return rows.map((row) => row.map(cell).join(",")).join("\n") + "\n";
}
