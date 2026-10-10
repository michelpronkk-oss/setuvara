import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { cookies } from "next/headers";
import { ConnectionMemoryEditor } from "@/components/connections/connection-memory-editor";
import type { ModeSlug } from "@/components/profile/types";
import { createClient } from "@/lib/supabase/server";

type ConnectionDetailProps = { params: Promise<{ id: string }> };
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type CurrentProfileMode = {
  slug: ModeSlug;
  is_enabled: boolean;
  settings: Record<string, unknown>;
  image_path: string | null;
};

export default async function ConnectionDetailPage({ params }: ConnectionDetailProps) {
  const { id } = await params;
  if (!uuidPattern.test(id)) notFound();
  const supabase = await createClient();
  const { data: claims, error: claimsError } = await supabase.auth.getClaims();
  const userId = typeof claims?.claims?.sub === "string" ? claims.claims.sub : null;
  if (claimsError || !userId) redirect(`/login?next=${encodeURIComponent(`/app/connections/${id}`)}`);
  const guestSessionToken = (await cookies()).get("sv-guest-session")?.value;
  if (guestSessionToken) await supabase.rpc("claim_guest_connections", { p_session_token: guestSessionToken });

  const { data: connection } = await supabase.from("connections")
    .select("id,user_id,connected_user_id,user_display_name_snapshot,connected_display_name_snapshot,guest_display_name,created_at")
    .eq("id", id).maybeSingle();
  if (!connection) notFound();
  const counterpartId = connection.user_id === userId ? connection.connected_user_id : connection.user_id;
  const [{ data: counterpart }, { data: currentModes }, { data: encounters }, { data: note }] = await Promise.all([
    counterpartId ? supabase.from("profiles").select("id,username,display_name,bio").eq("id", counterpartId).eq("is_published", true).maybeSingle() : Promise.resolve({ data: null }),
    counterpartId ? supabase.from("profile_modes").select("slug,is_enabled,settings,image_path").eq("profile_id", counterpartId).in("slug", ["personal", "event", "business"]) : Promise.resolve({ data: [] }),
    supabase.from("connection_encounters").select("id,connection_id,created_by_user_id,shared_by_user_id,shared_mode_slug,share_back_mode_slug,shared_display_name,shared_role,shared_company,share_back_display_name,share_back_role,share_back_company,event_name,city,date_label,source,created_at").eq("connection_id", id).order("created_at", { ascending: false }),
    supabase.from("connection_notes").select("note").eq("connection_id", id).eq("user_id", userId).maybeSingle(),
  ]);
  if (!encounters?.length) notFound();
  const encounterIds = encounters.map((item) => item.id);
  const { data: contexts } = await supabase.from("encounter_context").select("encounter_id,city,venue,event_label,updated_at").eq("user_id", userId).in("encounter_id", encounterIds).order("updated_at", { ascending: false });
  const contextMap = new Map((contexts ?? []).map((item) => [item.encounter_id, item]));
  const latest = encounters[0];
  const viewerIsSharedBy = latest.shared_by_user_id === userId;
  const snapshotName = viewerIsSharedBy
    ? latest.share_back_display_name ?? connection.connected_display_name_snapshot
    : latest.shared_display_name ?? connection.user_display_name_snapshot;
  const displayName = counterpart?.display_name ?? (connection.connected_user_id ? snapshotName : connection.guest_display_name ?? connection.connected_display_name_snapshot);
  const mode = counterpartModeSlug(viewerIsSharedBy ? latest.share_back_mode_slug : latest.shared_mode_slug, latest.shared_mode_slug);
  const modeRows = (currentModes ?? []) as unknown as CurrentProfileMode[];
  const currentMode = modeRows.find((item) => item.slug === mode && item.is_enabled);
  const personalMode = modeRows.find((item) => item.slug === "personal" && item.is_enabled);
  const currentSettings = currentMode?.settings ?? {};
  const role = readText(currentSettings, "role") ?? (viewerIsSharedBy ? latest.share_back_role : latest.shared_role);
  const company = readText(currentSettings, "company") ?? (viewerIsSharedBy ? latest.share_back_company : latest.shared_company);
  const location = mode === "personal" ? readText(currentSettings, "location") : readText(currentSettings, "city");
  const pronouns = mode === "personal" ? readText(currentSettings, "pronouns") : null;
  const publicBio = mode === "personal"
    ? [counterpart?.bio?.trim(), readText(currentSettings, "note")].filter(Boolean).join(" · ")
    : mode === "event" ? readText(currentSettings, "hereToMeet") : readText(currentSettings, "description");
  const latestContext = contextMap.get(latest.id);
  const imagePaths = [...new Set([currentMode?.image_path, personalMode?.image_path].filter((path): path is string => Boolean(path)))];
  const imageResults = await Promise.all(imagePaths.map((path) => supabase.storage.from("profile-media").createSignedUrl(path, 3600)));
  const counterpartImageUrl = imageResults.find((result) => !result.error && result.data?.signedUrl)?.data?.signedUrl ?? null;
  const modeLabel = mode[0].toUpperCase() + mode.slice(1);

  return (
    <main className="min-h-screen bg-[#f5f4ef] px-4 py-6 text-[#0d0d0d] sm:px-6 sm:py-10">
      <div className="mx-auto max-w-4xl">
        <Link className="mt-2 inline-flex min-h-11 items-center text-xs font-semibold text-black/55 underline underline-offset-4" href="/app/connections">← All connections</Link>
        <section className="relative isolate mt-7 overflow-hidden rounded-[2rem] bg-[#0d0d0d] p-6 text-[#f5f4ef] sm:p-10">
          {counterpartImageUrl && <>
            {/* The current header card already carries the identity hierarchy; use its media layer without changing its geometry. */}
            {/* eslint-disable-next-line @next/next/no-img-element -- signed, private-bucket profile image */}
            <img alt={`${displayName} · ${modeLabel} Mode`} className="absolute inset-0 size-full object-cover opacity-[0.72]" decoding="async" src={counterpartImageUrl} />
            <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(90deg,rgba(13,13,13,.7),rgba(13,13,13,.44))]" />
          </>}
          <div className="relative">
            <p className="text-[10px] font-bold tracking-[0.2em] text-white/55">A CONNECTION THAT STAYS</p>
            <h1 className="mt-4 text-4xl font-semibold tracking-[-0.055em] sm:text-5xl">{displayName}</h1>
            {(role || company) && <p className="mt-3 text-sm text-white/65">{[role, company].filter(Boolean).join(" · ")}</p>}
            {(location || pronouns) && <p className="mt-2 text-sm text-white/65">{[location, pronouns].filter(Boolean).join(" · ")}</p>}
            {publicBio && <p className="mt-3 max-w-2xl text-sm leading-6 text-white/75">{publicBio}</p>}
            {counterpart?.username && <Link className="mt-2 inline-flex min-h-11 items-center text-xs text-white/55 underline underline-offset-4" href={`/${counterpart.username}`}>@{counterpart.username}</Link>}
            <p className="mt-7 inline-flex min-h-10 items-center rounded-full bg-white/10 px-4 text-[10px] font-bold tracking-[0.15em]">CONNECTED ✓</p>
          </div>
        </section>

        <section className="mt-6 rounded-[1.7rem] border border-black/10 bg-white p-5 sm:p-7">
          <p className="text-[10px] font-bold tracking-[0.2em] text-black/45">WHERE YOU MET</p>
          <h2 className="mt-2 text-xl font-semibold">{latestContext?.event_label ?? latest.event_name ?? "A moment worth remembering"}</h2>
          {(latestContext?.city ?? latest.city) && <p className="mt-1 text-sm text-black/55">{latestContext?.city ?? latest.city}{latestContext?.venue ? ` · ${latestContext.venue}` : ""}</p>}
          <p className="mt-3 text-xs text-black/45">{new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(latest.created_at))} · {mode} Mode</p>
        </section>

        {encounters.length > 1 && <section className="mt-6 rounded-[1.7rem] bg-white p-5 sm:p-7"><p className="text-[10px] font-bold tracking-[0.2em] text-black/45">MEETINGS</p><ol className="mt-4 divide-y divide-black/10">{encounters.map((item) => { const context = contextMap.get(item.id); return <li className="py-4 first:pt-0 last:pb-0" key={item.id}><p className="text-sm font-semibold">{context?.event_label ?? item.event_name ?? `${item.shared_mode_slug[0]?.toUpperCase()}${item.shared_mode_slug.slice(1)} Mode`}</p><p className="mt-1 text-xs text-black/55">{[context?.city ?? item.city, context?.venue].filter(Boolean).join(" · ") || new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(item.created_at))}</p><p className="mt-1 text-[10px] uppercase tracking-wide text-black/40">{item.shared_mode_slug} Mode · {new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(item.created_at))}</p></li>; })}</ol></section>}

        <ConnectionMemoryEditor connectionId={id} encounterId={latest.id} userId={userId} initialNote={note?.note ?? ""} initialContext={latestContext ? { city: latestContext.city ?? "", venue: latestContext.venue ?? "", eventLabel: latestContext.event_label ?? "" } : null} />
      </div>
    </main>
  );
}

function counterpartModeSlug(mode: string | null, fallback: string): ModeSlug {
  if (mode === "personal" || mode === "event" || mode === "business") return mode;
  if (fallback === "personal" || fallback === "event" || fallback === "business") return fallback;
  return "personal";
}

function readText(settings: Record<string, unknown>, key: string): string | null {
  const value = settings[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
