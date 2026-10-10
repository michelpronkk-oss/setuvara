import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { Suspense } from "react";

import { IdentityStage, type StageMode } from "@/components/app/home/identity-stage";
import { PassportSection, PassportSkeleton } from "@/components/app/home/passport-section";
import { PeopleSection, PeopleSkeleton } from "@/components/app/home/people-section";
import type { ModeSlug } from "@/components/profile/types";
import { getPublicOrigin, getViewerPlan } from "@/lib/app/viewer";
import { signHomeImage } from "@/lib/app/media";
import { readFocus } from "@/components/profile/photo-focus";
import { parseConnectPolicy } from "@/lib/connections/access";
import { createClient } from "@/lib/supabase/server";

const ORDER: ModeSlug[] = ["personal", "event", "business"];

export default async function AppHomePage({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
  const query = await searchParams;
  const supabase = await createClient();
  const { data: claims, error } = await supabase.auth.getClaims();
  const userId = typeof claims?.claims?.sub === "string" ? claims.claims.sub : null;
  if (error || !userId) redirect("/login?next=/app");
  const guestSessionToken = (await cookies()).get("sv-guest-session")?.value;
  if (guestSessionToken) await supabase.rpc("claim_guest_connections", { p_session_token: guestSessionToken });

  // Identity is the only required source. People and Passport stream in behind their own boundaries.
  const [{ data: profile }, { data: modeRows }, requestHeaders, billing] = await Promise.all([
    supabase.from("profiles").select("username, display_name, bio, is_published").eq("id", userId).maybeSingle(),
    supabase.from("profile_modes").select("slug, label, is_enabled, settings, appearance, image_path, image_focus_x, image_focus_y, connect_policy").eq("profile_id", userId).order("sort_order"),
    headers(),
    getViewerPlan(userId),
  ]);
  if (!profile) redirect("/login?next=/app");
  const publicOrigin = await getPublicOrigin(requestHeaders);

  const modes: StageMode[] = await Promise.all(ORDER.map(async (slug) => {
    const row = modeRows?.find((item) => item.slug === slug);
    const settings = (row?.settings ?? {}) as Record<string, string | boolean>;
    const imageUrl = await signHomeImage(supabase, row?.image_path);
    return { slug, enabled: row?.is_enabled ?? false, appearance: (row?.appearance ?? { qrStyle: "standard", accent: "#FF5A4F" }) as StageMode["appearance"], imageUrl, imageFocus: readFocus(row?.image_focus_x, row?.image_focus_y), connectPolicy: parseConnectPolicy(row?.connect_policy), ...describeMode(slug, settings, profile.bio) };
  }));
  const initialMode = ORDER.includes(query.mode as ModeSlug) ? (query.mode as ModeSlug) : "personal";

  return (
    <main className="px-3.5 pb-6 pt-0.5 md:px-8 md:pb-8 lg:grid lg:h-[calc(100dvh-76px)] lg:min-h-[680px] lg:grid-cols-[minmax(0,1.25fr)_minmax(400px,1fr)] lg:gap-6 lg:pt-1 min-[1800px]:gap-8">
      <h1 className="sr-only">Your Setuvara</h1>
      <IdentityStage
        displayName={profile.display_name}
        initialMode={initialMode}
        hasRequestedMode={ORDER.includes(query.mode as ModeSlug)}
        isPublished={profile.is_published}
        modes={modes}
        plan={billing.plan}
        publicOrigin={publicOrigin}
        username={profile.username}
      />
      <div className="mt-5 flex min-h-0 flex-col gap-6 lg:mt-0 min-[1800px]:gap-8">
        <Suspense fallback={<PeopleSkeleton />}><PeopleSection userId={userId} /></Suspense>
        <Suspense fallback={<PassportSkeleton />}><PassportSection plan={billing.plan} /></Suspense>
      </div>
    </main>
  );
}

function describeMode(slug: ModeSlug, settings: Record<string, string | boolean>, personalBio: string) {
  const s = (key: string) => (typeof settings[key] === "string" ? (settings[key] as string).trim() : "");
  const join = (...parts: string[]) => parts.filter(Boolean).join(" · ");
  if (slug === "event") {
    return {
      sub: join(s("eventName"), s("city")) || "Not set up",
      line: s("hereToMeet") || join(s("eventName"), s("dateLabel"), s("city")) || "Add an event and city before you go.",
      configured: Boolean(s("eventName") || s("hereToMeet")),
    };
  }
  if (slug === "business") {
    return {
      sub: join(s("role"), s("company")) || "Not set up",
      line: s("description") || join(s("role"), s("company"), s("city")) || "Add your role and company.",
      configured: Boolean(s("role") || s("company")),
    };
  }
  return {
    sub: s("location") || "Personal",
    line: personalBio.trim() || s("note") || "Add a note so people know who they just met.",
    configured: Boolean(personalBio.trim() || s("note")),
  };
}
