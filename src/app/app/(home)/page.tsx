import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { Suspense } from "react";

import { CreatorDashboard } from "@/components/creator/creator-dashboard";
import { IdentityStage, type StageMode } from "@/components/app/home/identity-stage";
import { GoalsSection } from "@/components/app/home/goals-section";
import { ModesSection, type HomeModeTile } from "@/components/app/home/modes-section";
import { PulseSection } from "@/components/app/home/pulse-section";
import { SetupSection } from "@/components/app/home/setup-section";
import { PassportSection, PassportSkeleton } from "@/components/app/home/passport-section";
import { PeopleSection, PeopleSkeleton } from "@/components/app/home/people-section";
import type { ModeSlug } from "@/components/profile/types";
import { getPublicOrigin, getViewerPlan } from "@/lib/app/viewer";
import { signHomeImage } from "@/lib/app/media";
import { photoSource, readFocus } from "@/components/profile/photo-focus";
import { parseConnectPolicy } from "@/lib/connections/access";
import { LAUNCH_MODE_COOKIE, LAUNCH_VALUE, parseLaunchMode } from "@/lib/pwa/launch";
import { ownerModeShareUrls } from "@/lib/share/mode-share";
import { withLiveHandles } from "@/lib/handles/mode-handle";
import { ownerModeHandles } from "@/lib/handles/mode-server";
import { loadCreatorStudio } from "@/lib/creator/studio-server";
import { createClient } from "@/lib/supabase/server";

const ORDER: ModeSlug[] = ["personal", "event", "business"];

export default async function AppHomePage({ searchParams }: { searchParams: Promise<{ mode?: string; launch?: string }> }) {
  const query = await searchParams;
  const supabase = await createClient();
  const { data: claims, error } = await supabase.auth.getClaims();
  const userId = typeof claims?.claims?.sub === "string" ? claims.claims.sub : null;
  if (error || !userId) redirect("/login?next=/app");
  const cookieStore = await cookies();
  const guestSessionToken = cookieStore.get("sv-guest-session")?.value;
  if (guestSessionToken) await supabase.rpc("claim_guest_connections", { p_session_token: guestSessionToken });

  // Identity is the only required source. People and Passport stream in behind their own boundaries.
  const [{ data: profile }, { data: modeRows }, requestHeaders, billing] = await Promise.all([
    supabase.from("profiles").select("username, display_name, bio, is_published").eq("id", userId).maybeSingle(),
    supabase.from("profile_modes").select("slug, label, is_enabled, settings, appearance, image_path, image_original_path, image_crop, image_focus_x, image_focus_y, connect_policy").eq("profile_id", userId).order("sort_order"),
    headers(),
    getViewerPlan(userId),
  ]);
  if (!profile) redirect("/login?next=/app");
  const creatorRow = modeRows?.find((row) => row.slug === "creator");
  if (query.mode === "creator" && creatorRow?.is_enabled) {
    const studio = await loadCreatorStudio("/app?mode=creator");
    if (studio.mode) return <CreatorDashboard plan={billing.plan} studio={studio} />;
  }
  const publicOrigin = await getPublicOrigin(requestHeaders);
  // Creator sits on the same stage as the other Modes once it is on; its studio stays one link away.
  const stageOrder: ModeSlug[] = creatorRow?.is_enabled ? [...ORDER, "creator"] : ORDER;
  // Share links and photo signing are independent, so they run side by side.
  const [shortUrls, modes, modeHandles] = await Promise.all([
    ownerModeShareUrls(userId, profile.username, stageOrder.filter((slug) => modeRows?.some((row) => row.slug === slug)), publicOrigin),
    Promise.all(stageOrder.map(async (slug): Promise<StageMode> => {
      const row = modeRows?.find((item) => item.slug === slug);
      const settings = (row?.settings ?? {}) as Record<string, string | boolean>;
      const [imageUrl, imageOriginalUrl] = await Promise.all([signHomeImage(supabase, row?.image_path), row?.image_path ? signHomeImage(supabase, row?.image_original_path) : null]);
      const imageSource = photoSource({ image_url: imageUrl, image_original_url: imageOriginalUrl, image_crop: row?.image_crop, image_focus_x: row?.image_focus_x, image_focus_y: row?.image_focus_y });
      return { slug, enabled: row?.is_enabled ?? false, appearance: (row?.appearance ?? { qrStyle: "standard", accent: "#FF5A4F" }) as StageMode["appearance"], imageUrl, imageSource, imageFocus: readFocus(row?.image_focus_x, row?.image_focus_y), connectPolicy: parseConnectPolicy(row?.connect_policy), ...describeMode(slug, settings, profile.bio) };
    })),
    ownerModeHandles(userId),
  ]);
  const modeShareUrls = withLiveHandles(shortUrls, modeHandles, publicOrigin);
  // Opened from the Home Screen: Share opens at once, on the Mode chosen for this device.
  const launch = query.launch === LAUNCH_VALUE;
  const initialMode = launch ? parseLaunchMode(cookieStore.get(LAUNCH_MODE_COOKIE)?.value) : ORDER.includes(query.mode as ModeSlug) ? (query.mode as ModeSlug) : "personal";

  const tiles: HomeModeTile[] = (["personal", "event", "business", "creator"] as ModeSlug[]).filter((slug) => modeRows?.some((row) => row.slug === slug)).map((slug) => {
    const row = modeRows!.find((item) => item.slug === slug)!;
    const settings = (row.settings ?? {}) as Record<string, string | boolean>;
    const tagline = typeof settings.tagline === "string" ? settings.tagline.trim() : "";
    const summary = slug === "creator" ? tagline || "Add what you make." : describeMode(slug, settings, profile.bio).line;
    return { slug, enabled: Boolean(row.is_enabled), summary };
  });
  const firstName = profile.display_name.trim().split(/\s+/)[0] || "there";
  const publicUrl = `${publicOrigin.replace(/^https?:\/\//, "")}/${profile.username}`;

  return (
    <main className="mx-auto w-full max-w-[1480px] px-3.5 pb-10 pt-1 md:px-8 md:pt-8">
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 px-1 pb-5 md:pb-7">
        <div className="min-w-0">
          <h1 className="font-display text-[30px] font-bold leading-none tracking-[-0.045em] md:text-[40px]">{profile.is_published ? `Hi, ${firstName}.` : `Welcome, ${firstName}.`}</h1>
          <p className="mt-2 text-[14.5px] text-black/58">
            {profile.is_published
              ? <>Here&apos;s what&apos;s happening across your Setuvara · <span className="font-label text-[13px] text-black/70">{publicUrl}</span></>
              : "Your Setuvara is a draft. Finish a few steps and publish it when you're ready."}
          </p>
        </div>
        {!profile.is_published && <Link className="inline-flex min-h-11 items-center rounded-full bg-[#0D0D0D] px-5 text-[14px] font-semibold text-[#F5F4EF] transition hover:bg-black/85 focus-visible:outline-2 focus-visible:outline-offset-2" href="/app/identity?mode=personal&section=share">Publish your Setuvara</Link>}
      </header>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(340px,1fr)] lg:gap-6">
        <div className="lg:h-[min(680px,calc(100dvh-180px))] lg:min-h-[560px]">
          <IdentityStage
            displayName={profile.display_name}
            initialMode={initialMode}
            key={launch ? "launch" : query.mode ?? "home"}
            hasRequestedMode={launch || ORDER.includes(query.mode as ModeSlug)}
            launch={launch}
            isPublished={profile.is_published}
            modes={modes}
            plan={billing.plan}
            publicOrigin={publicOrigin}
            modeShareUrls={modeShareUrls}
            creatorStudioHref={creatorRow?.is_enabled ? "/app?mode=creator" : null}
            username={profile.username}
          />
        </div>
        <div className="flex min-w-0 flex-col gap-5 lg:gap-6">
          <Suspense fallback={null}><SetupSection bio={profile.bio ?? ""} isPublished={profile.is_published} userId={userId} /></Suspense>
          <Suspense fallback={<PeopleSkeleton />}><PeopleSection userId={userId} /></Suspense>
        </div>
      </div>

      <div className="mt-10 md:mt-12"><ModesSection modes={tiles} published={profile.is_published} /></div>

      <div className="mt-10 grid gap-5 md:mt-12 md:grid-cols-2 lg:gap-6 xl:grid-cols-3">
        <Suspense fallback={null}><PulseSection isPublished={profile.is_published} plan={billing.plan} userId={userId} /></Suspense>
        <Suspense fallback={<PassportSkeleton />}><PassportSection plan={billing.plan} /></Suspense>
        <Suspense fallback={null}><GoalsSection /></Suspense>
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
  if (slug === "creator") {
    return {
      sub: s("category") || s("tagline") || "Creator",
      line: s("tagline") || "Your work, audience and creative identity.",
      configured: Boolean(s("tagline")),
    };
  }
  return {
    sub: s("location") || "Personal",
    line: personalBio.trim() || s("note") || "Add a note so people know who they just met.",
    configured: Boolean(personalBio.trim() || s("note")),
  };
}
