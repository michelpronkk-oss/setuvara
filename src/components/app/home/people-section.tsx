import Link from "next/link";

import { ConnectionAvatar } from "@/components/connections/connection-avatar";
import type { ModeSlug } from "@/components/profile/types";
import { resolveConnectionProfiles, signHomeImage } from "@/lib/app/media";
import { createClient } from "@/lib/supabase/server";

type ConnectionRow = { id: string; user_id: string; connected_user_id: string | null; user_display_name_snapshot: string; connected_display_name_snapshot: string; guest_display_name: string | null; created_at: string };
type EncounterRow = { id: string; connection_id: string; shared_by_user_id: string; shared_mode_slug: string; share_back_mode_slug: string | null; shared_display_name: string; shared_company: string | null; share_back_display_name: string | null; share_back_company: string | null; event_name: string | null; city: string | null; created_at: string };

const DOT: Record<string, string> = { personal: "#FF5A4F", event: "#C7FF4A", business: "#AFCBFF" };
const LIMIT = 5;

/** Same resolution rules as /app/connections, limited to the latest five people. */
export async function PeopleSection({ userId }: { userId: string }) {
  const supabase = await createClient();
  const [{ data: connections, error }, { count }] = await Promise.all([
    supabase.from("connections").select("id,user_id,connected_user_id,user_display_name_snapshot,connected_display_name_snapshot,guest_display_name,created_at").order("created_at", { ascending: false }).limit(LIMIT),
    supabase.from("connections").select("id", { count: "exact", head: true }),
  ]);
  if (error) return <PeopleFallback />;
  const rows = (connections ?? []) as ConnectionRow[];
  if (!rows.length) return <FirstPeople />;

  const ids = rows.map((row) => row.id);
  const profileIds = [...new Set(rows.flatMap((row) => [row.user_id, row.connected_user_id].filter((id): id is string => Boolean(id))))];
  const [encounters, { data: profiles }] = await Promise.all([
    Promise.all(ids.map((id) => supabase.from("connection_encounters").select("id,connection_id,shared_by_user_id,shared_mode_slug,share_back_mode_slug,shared_display_name,shared_company,share_back_display_name,share_back_company,event_name,city,created_at").eq("connection_id", id).order("created_at", { ascending: false }).limit(1))),
    supabase.from("profiles").select("id,display_name").in("id", profileIds),
  ]);
  const encounterRows = encounters.flatMap((result) => result.data ?? []) as EncounterRow[];
  const { data: contexts } = encounterRows.length
    ? await supabase.from("encounter_context").select("encounter_id,city,venue,event_label").eq("user_id", userId).in("encounter_id", encounterRows.map((item) => item.id))
    : { data: [] };
  const contextMap = new Map((contexts ?? []).map((item) => [item.encounter_id, item]));
  const profileMap = new Map((profiles ?? []).map((item) => [item.id, item]));
  const latest = new Map<string, EncounterRow>();
  for (const encounter of encounterRows) if (!latest.has(encounter.connection_id)) latest.set(encounter.connection_id, encounter);

  const people = rows.map((row) => {
    const encounter = latest.get(row.id);
    const context = encounter ? contextMap.get(encounter.id) : undefined;
    const isGuest = !row.connected_user_id;
    const viewerShared = encounter?.shared_by_user_id === userId;
    const counterpart = row.user_id === userId ? row.connected_user_id : row.user_id;
    const name = (counterpart ? profileMap.get(counterpart)?.display_name : undefined)
      ?? (isGuest ? row.guest_display_name ?? row.connected_display_name_snapshot : viewerShared ? encounter?.share_back_display_name ?? row.connected_display_name_snapshot : encounter?.shared_display_name ?? row.user_display_name_snapshot);
    const mode = ((viewerShared ? encounter?.share_back_mode_slug : encounter?.shared_mode_slug) ?? encounter?.shared_mode_slug ?? "personal");
    const event = encounter?.event_name ?? context?.event_label ?? null;
    const city = context?.city ?? encounter?.city ?? null;
    const company = viewerShared ? encounter?.share_back_company : encounter?.shared_company;
    const where = event ? `Met at ${event}${city ? ` · ${city}` : ""}` : [company, context?.venue, city].filter(Boolean).join(" · ") || (isGuest ? "Guest connect" : "Connected on Setuvara");
    const modeSlug: ModeSlug = mode === "event" || mode === "business" ? mode : "personal";
    return {
      id: row.id,
      name,
      where,
      mode: modeSlug,
      when: relative(encounter?.created_at ?? row.created_at),
      profileId: counterpart && counterpart !== userId && !isGuest ? counterpart : null,
    };
  });
  const resolved = await resolveConnectionProfiles(supabase, people.map((person) => ({
    connectionId: person.id,
    profileId: person.profileId,
    mode: person.mode,
  })));
  const peopleWithImages = await Promise.all(people.map(async (person) => ({
    ...person,
    imageUrl: await signHomeImage(supabase, resolved.imagePathsByConnection.get(person.id), true),
  })));

  return (
    <section aria-labelledby="home-people" className="flex min-h-0 flex-col pt-1 lg:flex-1 lg:px-1.5 lg:pt-[18px]">
      <div className="flex items-baseline justify-between border-b-[1.5px] border-[#0d0d0d] pb-2 lg:pb-3.5">
        <h2 className="font-display text-2xl font-bold tracking-[-0.035em] lg:text-[34px] lg:tracking-[-0.04em]" id="home-people">People you met</h2>
        <Link className="flex min-h-11 items-center gap-2 text-sm font-semibold hover:text-[#ff5a4f] lg:text-[15px]" href="/app/connections">All {(count ?? rows.length).toLocaleString()}<span aria-hidden="true">→</span></Link>
      </div>
      <ul className="min-h-0 overflow-y-auto">
        {peopleWithImages.map((person) => (
          <li key={person.id}>
            <Link className="grid grid-cols-[42px_minmax(0,1fr)_auto] items-center gap-3 border-b border-black/10 py-[11px] transition-colors hover:bg-black/[0.03] focus-visible:outline-2 lg:grid-cols-[48px_minmax(0,1fr)_auto] lg:gap-4 lg:py-[13px] min-[1800px]:py-[18px]" href={`/app/connections/${person.id}`}>
              <ConnectionAvatar className="size-[42px] text-[15px] font-semibold lg:size-12 lg:text-[17px]" imageUrl={person.imageUrl} name={person.name} style={{ background: DOT[person.mode] }} />
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate text-base font-semibold tracking-[-0.01em] lg:text-lg">{person.name}</span>
                <span className="truncate text-[13px] text-black/70 lg:text-sm">{person.where}</span>
              </span>
              <span className="flex flex-col items-end gap-1">
                <span className="text-xs text-black/70 lg:text-[13px]">{person.when}</span>
                <span className="font-label text-[10px] uppercase tracking-[0.12em] text-black/60">{person.mode}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

const LOOP = [
  { n: "1", t: "Share your Personal Mode", b: "Open Share and let them scan your QR.", c: "#FF5A4F" },
  { n: "2", t: "Scan each other", b: "They connect back in one tap. No app needed.", c: "#0D0D0D" },
  { n: "3", t: "They land here", b: "With where you met, when, and which Mode you shared.", c: "#0D0D0D" },
];

function FirstPeople() {
  return (
    <section aria-labelledby="home-people" className="flex flex-col pt-1 lg:flex-1 lg:px-1.5 lg:pt-[18px]">
      <h2 className="border-b-[1.5px] border-[#0d0d0d] pb-2 font-display text-2xl font-bold tracking-[-0.035em] lg:pb-3.5 lg:text-[34px]" id="home-people">Meet your first people</h2>
      <ol>
        {LOOP.map((step) => (
          <li className="grid grid-cols-[36px_minmax(0,1fr)] gap-2.5 border-b border-black/10 py-3 lg:grid-cols-[52px_minmax(0,1fr)] lg:gap-4 lg:py-[22px]" key={step.n}>
            <span aria-hidden="true" className="font-display text-[28px] font-bold leading-[.9] tracking-[-0.04em] lg:text-[40px]" style={{ color: step.c }}>{step.n}</span>
            <span className="flex flex-col gap-0.5"><span className="text-[15px] font-semibold lg:text-[19px]">{step.t}</span><span className="text-[13px] leading-[1.45] text-black/70 lg:text-[15px]">{step.b}</span></span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function PeopleFallback() {
  return (
    <section aria-labelledby="home-people" className="flex flex-col pt-1 lg:flex-1 lg:px-1.5 lg:pt-[18px]">
      <h2 className="border-b-[1.5px] border-[#0d0d0d] pb-2 font-display text-2xl font-bold tracking-[-0.035em] lg:text-[34px]" id="home-people">People you met</h2>
      <p className="py-5 text-[15px] text-black/70">Your people are taking a moment to load. <Link className="font-semibold text-[#0d0d0d] underline underline-offset-4" href="/app/connections">Open Connections</Link></p>
    </section>
  );
}

export function PeopleSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col pt-1 lg:flex-1 lg:px-1.5 lg:pt-[18px]">
      <div className="h-9 w-48 rounded-md bg-black/[0.07] lg:h-10" />
      <div className="mt-2 h-[1.5px] bg-[#0d0d0d]" />
      {[0, 1, 2, 3].map((item) => <div className="flex items-center gap-3 border-b border-black/10 py-3.5" key={item}><span className="size-11 rounded-full bg-black/[0.07]" /><span className="flex flex-1 flex-col gap-1.5"><span className="h-3.5 w-2/5 rounded bg-black/[0.07]" /><span className="h-3 w-3/5 rounded bg-black/[0.05]" /></span></div>)}
    </div>
  );
}

function relative(iso: string) {
  const days = Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return new Intl.DateTimeFormat("en", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(iso));
}
