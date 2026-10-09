import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

type RecentConnection = {
  id: string;
  user_id: string;
  connected_user_id: string | null;
  user_display_name_snapshot: string;
  connected_display_name_snapshot: string;
  guest_display_name: string | null;
  created_at: string;
};

export default async function AppHomePage() {
  const supabase = await createClient();
  const { data: claims, error } = await supabase.auth.getClaims();
  const userId = typeof claims?.claims?.sub === "string" ? claims.claims.sub : null;
  if (error || !userId) redirect("/login?next=/app");

  const [{ data: profile }, { data: connections }, { data: passport }] = await Promise.all([
    supabase.from("profiles").select("username, display_name, is_published").eq("id", userId).maybeSingle(),
    supabase.from("connections").select("id,user_id,connected_user_id,user_display_name_snapshot,connected_display_name_snapshot,guest_display_name,created_at").order("created_at", { ascending: false }).limit(5),
    supabase.rpc("get_passport_overview"),
  ]);
  if (!profile) redirect("/login?next=/app");

  const latest = (connections ?? []) as RecentConnection[];
  const people = latest.map((connection) => ({
    id: connection.id,
    name: connection.guest_display_name ?? (connection.user_id === userId ? connection.connected_display_name_snapshot : connection.user_display_name_snapshot),
    date: new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(connection.created_at)),
  }));
  const connectionCount = typeof passport === "object" && passport !== null && "connectionCount" in passport && typeof passport.connectionCount === "number" ? passport.connectionCount : latest.length;
  const greeting = profile.display_name.trim().split(/\s+/)[0] || "there";

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-7 sm:px-6 sm:py-10 lg:px-10 lg:py-12">
      <section className="relative overflow-hidden rounded-[2rem] bg-[#0d0d0d] px-6 py-8 text-[#f5f4ef] sm:px-10 sm:py-11">
        <div aria-hidden="true" className="absolute -right-16 -top-24 size-72 rounded-full border border-white/10 sm:right-0 sm:size-96" />
        <div className="relative max-w-2xl">
          <p className="text-[10px] font-bold tracking-[0.22em] text-[#ff827b]">YOUR SETUVARA, IN MOTION</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-[-0.065em] sm:text-6xl">Good to see you, {greeting}.</h1>
          <p className="mt-4 max-w-xl text-sm leading-6 text-white/60">One identity for all the ways you show up. Choose a Mode, then share the version that fits this moment.</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link className="inline-flex min-h-12 items-center rounded-full bg-[#ff5a4f] px-5 text-sm font-semibold text-[#0d0d0d] transition-transform hover:-translate-y-0.5" href="/app/identity?mode=personal&section=share">Share your Setuvara <span aria-hidden="true" className="ml-2">↗</span></Link>
            <Link className="inline-flex min-h-12 items-center rounded-full border border-white/20 px-5 text-sm font-semibold text-white hover:bg-white/10" href="/app/identity?mode=personal&section=profile">Edit identity</Link>
          </div>
        </div>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="rounded-[1.7rem] border border-black/10 bg-white p-5 sm:p-7">
          <div className="flex items-end justify-between gap-4">
            <div><p className="text-[10px] font-bold tracking-[0.2em] text-black/40">YOUR PEOPLE</p><h2 className="mt-2 text-2xl font-semibold tracking-[-0.045em]">Latest connections</h2></div>
            <Link className="inline-flex min-h-11 items-center text-xs font-semibold underline underline-offset-4" href="/app/connections">See all</Link>
          </div>
          {people.length ? <ul className="mt-5 divide-y divide-black/10">{people.slice(0, 4).map((person) => <li className="flex min-h-[68px] items-center gap-3 py-3" key={person.id}>
            <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-full bg-[#f5f4ef] text-sm font-semibold">{person.name.slice(0, 1).toUpperCase()}</span>
            <span className="min-w-0 flex-1 truncate text-sm font-semibold">{person.name}</span><span className="text-xs text-black/45">{person.date}</span>
          </li>)}</ul> : <div className="mt-5 rounded-2xl bg-[#f5f4ef] px-5 py-6"><p className="font-semibold">A little room for the people you meet.</p><p className="mt-1 max-w-md text-sm leading-6 text-black/55">When you connect in person, Setuvara helps you keep the context and find each other again.</p></div>}
        </section>

        <section className="flex flex-col rounded-[1.7rem] bg-[#ff5a4f] p-5 sm:p-7">
          <p className="text-[10px] font-bold tracking-[0.2em]">PASSPORT</p><p className="mt-4 text-5xl font-semibold tracking-[-0.07em]">{connectionCount.toLocaleString()}</p><p className="mt-1 text-xs font-bold tracking-[0.18em]">CONNECTIONS KEPT</p>
          <p className="mt-4 max-w-sm text-sm leading-6 text-black/65">Your Passport keeps the milestones and places that make your network yours.</p>
          <Link className="mt-auto inline-flex min-h-11 items-center self-start pt-5 text-xs font-semibold underline underline-offset-4" href="/app/passport">Open your Passport <span aria-hidden="true" className="ml-2">↗</span></Link>
        </section>
      </div>

      <section className="mt-6 rounded-[1.7rem] border border-black/10 bg-[#fbfaf7] p-5 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-5">
          <div><p className="text-[10px] font-bold tracking-[0.2em] text-black/40">READY TO SHARE</p><h2 className="mt-2 text-xl font-semibold tracking-[-0.04em]">Pick the version for this moment.</h2><p className="mt-1 text-sm text-black/55">Your profile is {profile.is_published ? "live" : "still private"}. Each Mode has its own link.</p></div>
          <div className="flex flex-wrap gap-2">{(["personal", "event", "business"] as const).map((mode) => <Link className="inline-flex min-h-11 items-center rounded-full border border-black/10 bg-white px-4 text-xs font-semibold capitalize hover:border-black/30" href={`/app/identity?mode=${mode}&section=share`} key={mode}>{mode} QR ↗</Link>)}</div>
        </div>
      </section>
    </div>
  );
}
