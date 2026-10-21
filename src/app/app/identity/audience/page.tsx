import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ActionsFrame } from "@/components/actions/actions-frame";
import { AudienceIndex } from "@/components/audience/audience-pages";
import { isActionMode } from "@/lib/actions/studio-server";

export const metadata: Metadata = { title: "Audience · Setuvara" };

export default async function AudiencePage({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
  const { mode } = await searchParams;
  const slug = isActionMode(mode) ? mode : "personal";
  if (slug === "creator") redirect("/app/identity/creator/audience");
  return <ActionsFrame page="audience" slug={slug}><AudienceIndex slug={slug} /></ActionsFrame>;
}
