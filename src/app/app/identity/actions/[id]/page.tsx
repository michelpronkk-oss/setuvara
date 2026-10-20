import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { ActionsFrame } from "@/components/actions/actions-frame";
import { ActionDetail } from "@/components/actions/actions-pages";
import { isActionMode } from "@/lib/actions/studio-server";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Action · Setuvara" };

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ModeActionPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string; response?: string }> }) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  if (!uuid.test(id)) notFound();
  // The Action names its Mode; RLS shows only the owner's own.
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (typeof claims?.claims?.sub !== "string") redirect(`/login?next=${encodeURIComponent(`/app/identity/actions/${id}`)}`);
  const { data: row } = await supabase.from("profile_actions").select("profile_modes(slug)").eq("id", id).maybeSingle();
  const slug = (row?.profile_modes as { slug?: string } | null)?.slug;
  if (!isActionMode(slug)) notFound();
  if (slug === "creator") redirect(`/app/identity/creator/actions/${id}${query.tab ? `?tab=${encodeURIComponent(query.tab)}` : ""}`);
  return <ActionsFrame slug={slug}><ActionDetail id={id} query={query} slug={slug} /></ActionsFrame>;
}
