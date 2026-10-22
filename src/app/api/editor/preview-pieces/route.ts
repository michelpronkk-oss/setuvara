import { getPublicActions } from "@/lib/actions/public";
import { getPublicBuilder } from "@/lib/builder/public";
import { getPublicTestimonials } from "@/lib/business/public";
import { getPublicStore } from "@/lib/commerce/public";
import { freshPlatforms, type PublicPlatform } from "@/lib/social/model";
import { createClient } from "@/lib/supabase/server";
import type { ModeSlug } from "@/components/profile/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SLUGS: ModeSlug[] = ["personal", "event", "business", "creator"];

/**
 * What the owner's page shows besides blocks and links (Actions, Builder projects, testimonials,
 * platforms and the store), read through the same public readers as the page itself, so the
 * editor preview draws the real cards. Signed-in owners only, for their own page.
 */
export async function GET(request: Request) {
  const slug = new URL(request.url).searchParams.get("mode") as ModeSlug | null;
  if (!slug || !SLUGS.includes(slug)) return Response.json({ error: "Unknown Mode." }, { status: 400 });
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = typeof claims?.claims?.sub === "string" ? claims.claims.sub : null;
  if (!userId) return Response.json({ error: "Sign in first." }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("username").eq("id", userId).maybeSingle();
  const username = profile?.username;
  if (!username) return Response.json({ actions: [], projects: [], testimonials: [], platforms: [], offers: [] });

  const creator = slug === "creator";
  const [actions, projects, testimonials, platforms, offers] = await Promise.all([
    getPublicActions(username, slug).catch(() => []),
    slug === "business" || creator ? getPublicBuilder(username, slug).catch(() => []) : Promise.resolve([]),
    slug === "business" ? getPublicTestimonials(username).catch(() => []) : Promise.resolve([]),
    creator ? supabase.rpc("get_creator_platforms", { p_username: username }).then(({ data }) => freshPlatforms(Array.isArray(data) ? data as PublicPlatform[] : []), () => []) : Promise.resolve([]),
    creator ? getPublicStore(username).catch(() => []) : Promise.resolve([]),
  ]);
  return Response.json({ actions, projects, testimonials, platforms, offers }, { headers: { "Cache-Control": "private, no-store" } });
}
