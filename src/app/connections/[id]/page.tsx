import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type GuestConnectionPageProps = { params: Promise<{ id: string }> };
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function GuestConnectionPage({ params }: GuestConnectionPageProps) {
  const { id } = await params;
  if (!uuidPattern.test(id)) notFound();
  const token = (await cookies()).get("sv-guest-session")?.value;
  if (!token) notFound();
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_guest_connection_detail", { p_connection_id: id, p_session_token: token });
  const connection = data as { profile_name?: string; encounters?: { id: string; mode: string; event: string | null; city: string | null; dateLabel: string | null; created_at: string }[] } | null;
  if (!connection) notFound();
  const latest = connection.encounters?.[0];

  return <main className="grid min-h-screen place-items-center bg-[#f5f4ef] px-4 py-8 text-[#0d0d0d]"><article className="w-full max-w-lg rounded-[2rem] bg-white p-6 shadow-sm sm:p-9"><Link className="text-xs font-bold lowercase tracking-[0.2em]" href="/">setuvara</Link><p className="mt-8 text-[10px] font-bold tracking-[0.2em] text-black/45">YOUR CONNECTION</p><h1 className="mt-3 text-3xl font-semibold tracking-[-0.05em]">Connected with {connection.profile_name}</h1><p className="mt-2 text-sm text-black/55">Your connection is remembered on this browser.</p>{latest && <section className="mt-7 rounded-2xl bg-[#f5f4ef] p-5"><p className="text-[10px] font-bold tracking-[0.16em]">YOU MET</p><p className="mt-2 font-semibold">{[latest.event, latest.city].filter(Boolean).join(" · ") || `${latest.mode} Mode`}</p>{latest.dateLabel && <p className="mt-1 text-sm text-black/55">{latest.dateLabel}</p>}<p className="mt-2 text-xs text-black/45">{new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(latest.created_at))} · {latest.mode} Mode</p></section>}<Link className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-[#ff5a4f] px-5 text-sm font-semibold" href="/signup?claim=1">Claim your Setuvara</Link><p className="mt-3 text-center text-xs leading-5 text-black/50">Create your identity and keep this connection. Your email stays private.</p></article></main>;
}
