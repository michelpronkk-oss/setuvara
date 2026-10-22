import "server-only";

import { APPEARANCE_NAMES, resolveAppearance } from "@/components/profile/appearance";
import type { AppearanceId, ModeAppearance, ModeSlug } from "@/components/profile/types";
import type { PlanCode } from "@/lib/billing/catalog";
import { createPublicProfileImageUrl } from "@/lib/supabase/public-profile-image-url";
import { createClient } from "@/lib/supabase/server";
import { isAllowedUsername } from "@/lib/usernames";

export type GalleryEntry = {
  path: string;
  name: string;
  mode: ModeSlug;
  look: AppearanceId;
  lookName: string;
  accent: string;
  photo: string | null;
  focus: { x: number; y: number };
  line: string;
};

type Row = { path: string; name: string | null; mode: string; look: string; accent: string | null; image_path: string | null; focus_x: number | null; focus_y: number | null; details: Record<string, string> | null };

const MODES = new Set<ModeSlug>(["personal", "business", "creator"]);

/** The line under a name: what each Mode leads with on its own page. */
function lineFor(mode: ModeSlug, details: Record<string, string>) {
  const pick = (...keys: string[]) => keys.map((key) => details[key]?.replace(/\s+/g, " ").trim()).filter(Boolean).join(" · ");
  const line = mode === "business" ? pick("role", "company", "city") : mode === "creator" ? pick("category", "city") : pick("location");
  return Array.from(line).slice(0, 90).join("");
}

/**
 * Members' pages that are listed in the gallery (opt-in per Mode, see list_gallery). The Look is
 * read the way the page itself reads it (the member's plan included), so every page is filed under
 * the Look a visitor actually sees.
 */
export async function loadGallery(): Promise<GalleryEntry[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("list_gallery", { p_limit: 200 });
    if (error || !Array.isArray(data)) return [];
    const rows = (data as Row[]).filter((row) => MODES.has(row.mode as ModeSlug) && isAllowedUsername(row.path) && row.name?.trim());
    return await Promise.all(rows.map(async (row) => {
      const mode = row.mode as ModeSlug;
      const details = row.details ?? {};
      const plan: PlanCode = details.plan === "plus" || details.plan === "pro" ? details.plan : "free";
      const look = resolveAppearance({ slug: mode, appearance: { theme: row.look, accent: row.accent ?? "#FF5A4F" } as ModeAppearance }, plan);
      return {
        path: row.path,
        name: row.name!.trim(),
        mode,
        look: look.id,
        lookName: APPEARANCE_NAMES[look.id],
        accent: look.accent,
        photo: row.image_path ? await createPublicProfileImageUrl(supabase, row.image_path) : null,
        focus: { x: row.focus_x ?? 50, y: row.focus_y ?? 35 },
        line: lineFor(mode, details),
      };
    }));
  } catch {
    return [];
  }
}
