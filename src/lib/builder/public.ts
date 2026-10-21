import { cache } from "react";

import type { PublicProject } from "@/lib/builder/model";
import { createClient } from "@/lib/supabase/server";

/** A published Creator or Business Mode's public projects, with roadmap, changelog and updates. */
export const getPublicBuilder = cache(async (username: string, slug: string): Promise<PublicProject[]> => {
  if (slug !== "creator" && slug !== "business") return [];
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_public_builder", { p_username: username, p_mode_slug: slug });
  return error || !Array.isArray(data) ? [] : (data as PublicProject[]);
});
