import { notFound } from "next/navigation";

import { BuilderStudio } from "@/components/builder/builder-studio";
import { StudioHead, StudioPage } from "@/components/creator/studio-ui";
import { loadModeActions } from "@/lib/actions/studio-server";
import { DEFAULT_BUILDER_LIMITS, PROJECT_COLUMNS, ROADMAP_COLUMNS, UPDATE_COLUMNS, type BuilderInsights, type BuilderLimits, type BuilderProject, type BuilderSuggestion, type ProjectUpdate, type RoadmapItem } from "@/lib/builder/model";

/** Builder Showcase studio for Creator or Business Mode: projects, roadmaps, updates. */
export async function BuilderView({ slug, project }: { slug: "creator" | "business"; project: string | null }) {
  const data = await loadModeActions(slug, slug === "creator" ? "/app/identity/creator/builder" : "/app/identity/builder?mode=business");
  if (!data.mode) notFound();
  const supabase = data.supabase;
  const [{ data: projects }, { data: limits }] = await Promise.all([
    supabase.from("builder_projects").select(PROJECT_COLUMNS).eq("mode_id", data.mode.id).order("sort_order").order("created_at"),
    supabase.rpc("my_builder_limits"),
  ]);
  const ids = (projects ?? []).map((project) => project.id as string);
  const [{ data: roadmap }, { data: updates }, { data: links }, { data: suggestions }] = ids.length ? await Promise.all([
    supabase.from("builder_roadmap_items").select(ROADMAP_COLUMNS).in("project_id", ids).order("sort_order").order("created_at"),
    supabase.from("builder_project_updates").select(UPDATE_COLUMNS).in("project_id", ids).order("published_at", { ascending: false }),
    supabase.from("builder_project_actions").select("project_id, action_id").in("project_id", ids),
    supabase.from("builder_suggestions").select("id, project_id, title, body, status, created_at, roadmap_item_id").in("project_id", ids).order("created_at", { ascending: false }).limit(200),
  ]) : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }];
  const insights = Object.fromEntries(await Promise.all(ids.map(async (id) => [id, (await supabase.rpc("builder_project_insights", { p_project_id: id })).data] as const)));
  return (
    <StudioPage>
      <StudioHead sub={`Projects on your ${slug === "creator" ? "Creator" : "Business"} page: what you're building, its roadmap and what shipped.`} title="Builder" />
      <BuilderStudio
        actions={data.actions.map((action) => ({ id: action.id, title: action.title, status: action.status }))}
        images={data.covers}
        limits={(limits as BuilderLimits | null) ?? DEFAULT_BUILDER_LIMITS}
        links={(links ?? []) as { project_id: string; action_id: string }[]}
        modeId={data.mode.id}
        ownerId={data.userId}
        projects={(projects ?? []) as BuilderProject[]}
        roadmap={(roadmap ?? []) as (RoadmapItem & { project_id: string })[]}
        insights={insights as Record<string, BuilderInsights | null>}
        selected={project}
        suggestions={(suggestions ?? []) as BuilderSuggestion[]}
        slug={slug}
        updates={(updates ?? []) as (ProjectUpdate & { project_id: string })[]}
      />
    </StudioPage>
  );
}
