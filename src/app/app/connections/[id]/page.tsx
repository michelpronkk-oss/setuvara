import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { cookies } from "next/headers";
import { ConnectionMemoryEditor } from "@/components/connections/connection-memory-editor";
import type { ModeSlug } from "@/components/profile/types";
import { createClient } from "@/lib/supabase/server";

type ConnectionDetailProps = { params: Promise<{ id: string }> };
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
  const [{ data: counterpart }, { data: encounters }, { data: note }] = await Promise.all([
    counterpartId ? supabase.from("profiles").select("id,username,display_name").eq("id", counterpartId).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("connection_encounters").select("id,connection_id,created_by_user_id,shared_by_user_id,shared_mode_slug,share_back_mode_slug,shared_display_name,shared_role,shared_company,share_back_display_name,share_back_role,share_back_company,event_name,city,date_label,source,created_at").eq("connection_id", id).order("created_at", { ascending: false }),
    supabase.from("connection_notes").select("note").eq("connection_id", id).eq("user_id", userId).maybeSingle(),
  ]);
  if (!encounters?.length) notFound();
  const encounterIds = encounters.map((item) => item.id);
  const { data: contexts } = await supabase.from("encounter_context").select("encounter_id,city,venue,event_label,updated_at").eq("user_id", userId).in("encounter_id", encounterIds).order("updated_at", { ascending: false });
  const contextMap = new Map((contexts ?? []).map((item) => [item.encounter_id, item]));
  const latest = encounters[0];
  const latestContext = contextMap.get(latest.id);
  const viewerIsSharedBy = latest.shared_by_user_id === userId;
  const guestName = connection.guest_display_name ?? connection.connected_display_name_snapshot;
  const displayName = counterpart?.display_name ?? (connection.connected_user_id ? viewerIsSharedBy ? latest.share_back_display_name ?? connection.connected_display_name_snapshot : latest.shared_display_name : guestName);
  const role = viewerIsSharedBy ? latest.share_back_role : latest.shared_role;
  const company = viewerIsSharedBy ? latest.share_back_company : latest.shared_company;
  const mode = ((viewerIsSharedBy ? latest.share_back_mode_slug : latest.shared_mode_slug) ?? latest.shared_mode_slug) as ModeSlug;

  return (
    <main className="min-h-screen bg-[#f5f4ef] px-4 py-6 text-[#0d0d0d] sm:px-6 sm:py-10">
      <div className="mx-auto max-w-4xl">
        <header className="flex items-center justify-between"><Link className="text-sm font-bold lowercase tracking-[0.22em]" href="/">setuvara</Link><nav className="flex gap-2"><Link className="inline-flex min-h-11 items-center rounded-full px-4 text-xs font-semibold" href="/app/identity">Identity</Link><Link className="inline-flex min-h-11 items-center rounded-full bg-black/5 px-4 text-xs font-semibold" href="/app/connections">Connections</Link></nav></header>
        <Link className="mt-8 inline-flex min-h-11 items-center text-xs font-semibold text-black/55 underline underline-offset-4" href="/app/connections">← All connections</Link>
        <section className="mt-7 rounded-[2rem] bg-[#0d0d0d] p-6 text-[#f5f4ef] sm:p-10">
          <p className="text-[10px] font-bold tracking-[0.2em] text-white/55">A CONNECTION THAT STAYS</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-[-0.055em] sm:text-5xl">{displayName}</h1>
          {(role || company) && <p className="mt-3 text-sm text-white/65">{[role, company].filter(Boolean).join(" · ")}</p>}
          {counterpart?.username && <Link className="mt-2 inline-flex min-h-11 items-center text-xs text-white/55 underline underline-offset-4" href={`/${counterpart.username}`}>@{counterpart.username}</Link>}
          <p className="mt-7 inline-flex min-h-10 items-center rounded-full bg-white/10 px-4 text-[10px] font-bold tracking-[0.15em]">CONNECTED ✓</p>
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
