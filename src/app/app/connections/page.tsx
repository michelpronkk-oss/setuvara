import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { ConnectionsList, type ConnectionListItem } from "@/components/connections/connections-list";
import type { ModeSlug } from "@/components/profile/types";
import { resolveConnectionProfiles } from "@/lib/app/media";
import { createClient } from "@/lib/supabase/server";

type ConnectionRow = {
  id: string;
  user_id: string;
  connected_user_id: string | null;
  user_display_name_snapshot: string;
  connected_display_name_snapshot: string;
  guest_display_name: string | null;
  created_at: string;
};
type EncounterRow = {
  id: string;
  connection_id: string;
  created_by_user_id: string | null;
  shared_by_user_id: string;
  shared_mode_slug: string;
  share_back_mode_slug: string | null;
  shared_display_name: string;
  shared_role: string | null;
  shared_company: string | null;
  share_back_display_name: string | null;
  share_back_role: string | null;
  share_back_company: string | null;
  event_name: string | null;
  city: string | null;
  created_at: string;
};

export default async function ConnectionsPage() {
  const supabase = await createClient();
  const { data: claims, error: claimsError } = await supabase.auth.getClaims();
  const userId = typeof claims?.claims?.sub === "string" ? claims.claims.sub : null;
  if (claimsError || !userId) redirect("/login?next=/app/connections");
  const guestSessionToken = (await cookies()).get("sv-guest-session")?.value;
  if (guestSessionToken) await supabase.rpc("claim_guest_connections", { p_session_token: guestSessionToken });

  const { data: connections, error: connectionError } = await supabase
    .from("connections")
    .select("id,user_id,connected_user_id,user_display_name_snapshot,connected_display_name_snapshot,guest_display_name,created_at")
    .order("created_at", { ascending: false })
    .limit(250);
  if (connectionError) return <ConnectionsError />;
  const rows = (connections ?? []) as ConnectionRow[];
  const connectionIds = rows.map((item) => item.id);
  const profileIds = [...new Set(rows.flatMap((item) => [item.user_id, item.connected_user_id].filter((id): id is string => Boolean(id))))];
  const [{ data: encounters }, { data: profiles }] = await Promise.all([
    connectionIds.length ? supabase.from("connection_encounters").select("id,connection_id,created_by_user_id,shared_by_user_id,shared_mode_slug,share_back_mode_slug,shared_display_name,shared_role,shared_company,share_back_display_name,share_back_role,share_back_company,event_name,city,created_at").in("connection_id", connectionIds).order("created_at", { ascending: false }).limit(1000) : Promise.resolve({ data: [] }),
    profileIds.length ? supabase.from("profiles").select("id,username,display_name").in("id", profileIds) : Promise.resolve({ data: [] }),
  ]);
  const encounterRows = (encounters ?? []) as EncounterRow[];
  const profileMap = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
  const contextQuery = encounterRows.length
    ? await supabase.from("encounter_context").select("encounter_id,city,venue,event_label,updated_at").eq("user_id", userId).in("encounter_id", encounterRows.map((item) => item.id)).order("updated_at", { ascending: false })
    : { data: [] };
  const contextMap = new Map((contextQuery.data ?? []).map((context) => [context.encounter_id, context]));
  const latestByConnection = new Map<string, EncounterRow>();
  for (const encounter of encounterRows) if (!latestByConnection.has(encounter.connection_id)) latestByConnection.set(encounter.connection_id, encounter);
  const searchableByConnection = new Map<string, string[]>();
  for (const encounter of encounterRows) {
    const context = contextMap.get(encounter.id);
    const values = searchableByConnection.get(encounter.connection_id) ?? [];
    values.push(
      encounter.shared_display_name,
      encounter.shared_role ?? "",
      encounter.shared_company ?? "",
      encounter.share_back_display_name ?? "",
      encounter.share_back_role ?? "",
      encounter.share_back_company ?? "",
      encounter.event_name ?? "",
      encounter.city ?? "",
      context?.city ?? "",
      context?.venue ?? "",
      context?.event_label ?? "",
    );
    searchableByConnection.set(encounter.connection_id, values);
  }

  const profileIdByConnection = new Map<string, string | null>();
  const drafts = rows.map((connection) => {
    const latest = latestByConnection.get(connection.id);
    const isGuest = !connection.connected_user_id;
    const viewerIsSharedBy = latest?.shared_by_user_id === userId;
    const counterpartId = connection.user_id === userId ? connection.connected_user_id : connection.user_id;
    const otherProfile = counterpartId ? profileMap.get(counterpartId) : undefined;
    const guestName = connection.guest_display_name ?? connection.connected_display_name_snapshot;
    const displayName = otherProfile?.display_name ?? (isGuest ? guestName : viewerIsSharedBy ? (latest?.share_back_display_name ?? connection.connected_display_name_snapshot) : (latest?.shared_display_name ?? connection.user_display_name_snapshot));
    const context = latest ? contextMap.get(latest.id) : undefined;
    const mode = (viewerIsSharedBy ? latest?.share_back_mode_slug : latest?.shared_mode_slug) ?? latest?.shared_mode_slug ?? "personal";
    const modeSlug = (mode === "event" || mode === "business" ? mode : "personal") as ModeSlug;
    profileIdByConnection.set(connection.id, !isGuest && counterpartId !== userId ? counterpartId : null);
    return {
      id: connection.id,
      displayName,
      username: otherProfile?.username ?? null,
      role: viewerIsSharedBy ? latest?.share_back_role ?? null : latest?.shared_role ?? null,
      company: viewerIsSharedBy ? latest?.share_back_company ?? null : latest?.shared_company ?? null,
      mode: modeSlug,
      event: latest?.event_name ?? context?.event_label ?? null,
      city: context?.city ?? latest?.city ?? null,
      venue: context?.venue ?? null,
      lastMet: latest ? new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(latest.created_at)) : "Recently",
      isGuest,
      searchText: searchableByConnection.get(connection.id)?.join(" ") ?? "",
    };
  });
  const resolved = await resolveConnectionProfiles(supabase, drafts.map((item) => ({
    connectionId: item.id,
    profileId: profileIdByConnection.get(item.id) ?? null,
    mode: item.mode,
  })));
  const imagePaths = [...new Set(resolved.imagePathsByConnection.values())];
  const { data: signedImages } = imagePaths.length
    ? await supabase.storage.from("profile-media").createSignedUrls(imagePaths, 3600)
    : { data: [] };
  const signedUrlByPath = new Map((signedImages ?? []).flatMap((image) => image.path && image.signedUrl && !image.error ? [[image.path, image.signedUrl] as const] : []));
  const items: ConnectionListItem[] = drafts.map((item) => {
    const path = resolved.imagePathsByConnection.get(item.id);
    return { ...item, imageUrl: path ? signedUrlByPath.get(path) ?? null : null, imageFocus: resolved.imageFocusByConnection.get(item.id) ?? null };
  });

  return (
    <main className="min-h-screen bg-[#f5f4ef] px-4 py-6 text-[#0d0d0d] sm:px-6 sm:py-10">
      <div className="mx-auto max-w-4xl">
        <section className="mt-5"><p className="text-[10px] font-bold tracking-[0.2em] text-black/45">YOUR PEOPLE</p><h1 className="mt-3 text-4xl font-semibold tracking-[-0.055em] sm:text-5xl">Connections that stay.</h1><p className="mt-3 max-w-xl text-sm leading-6 text-black/55">A little memory of the people you’ve met and the moments you shared.</p></section>
        <ConnectionsList items={items} />
      </div>
    </main>
  );
}

function ConnectionsError() {
  return <main className="grid min-h-screen place-items-center bg-[#f5f4ef] px-5 text-[#0d0d0d]"><section className="max-w-md rounded-[2rem] bg-white p-8"><h1 className="text-2xl font-semibold">Your connections are taking a moment.</h1><p className="mt-2 text-sm leading-6 text-black/55">Refresh in a little while to see your people.</p><Link className="mt-5 inline-flex min-h-11 items-center underline underline-offset-4" href="/app/identity">Back to Identity</Link></section></main>;
}
