import { cache } from "react";

import type { BuilderActivity, PublicProject } from "@/lib/builder/model";
import { createClient } from "@/lib/supabase/server";

/** A published Creator or Business Mode's public projects, with roadmap, changelog and updates. */
export const getPublicBuilder = cache(async (username: string, slug: string): Promise<PublicProject[]> => {
  if (slug !== "creator" && slug !== "business") return [];
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_public_builder", { p_username: username, p_mode_slug: slug });
  return error || !Array.isArray(data) ? [] : (data as PublicProject[]);
});

/** The signed-in viewer's own votes and ideas on each project; empty for visitors. */
export async function getBuilderActivity(projectIds: string[]): Promise<Record<string, BuilderActivity>> {
  if (!projectIds.length) return {};
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (typeof claims?.claims?.sub !== "string") return {};
  const rows = await Promise.all(projectIds.map(async (id) => [id, (await supabase.rpc("my_builder_activity", { p_project_id: id })).data as BuilderActivity | null] as const));
  return Object.fromEntries(rows.map(([id, activity]) => [id, activity ?? { voted: [], suggestions: [] }]));
}
