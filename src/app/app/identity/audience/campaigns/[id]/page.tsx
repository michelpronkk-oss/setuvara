import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { ActionsFrame } from "@/components/actions/actions-frame";
import { CampaignDetail } from "@/components/audience/audience-pages";
import { isActionMode } from "@/lib/actions/studio-server";

export const metadata: Metadata = { title: "Campaign · Setuvara" };

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function CampaignPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ mode?: string }> }) {
  const [{ id }, { mode }] = await Promise.all([params, searchParams]);
  if (!uuid.test(id)) notFound();
  const slug = isActionMode(mode) ? mode : "personal";
  if (slug === "creator") redirect(`/app/identity/creator/audience/campaigns/${id}`);
  return <ActionsFrame page="audience" slug={slug}><CampaignDetail id={id} slug={slug} /></ActionsFrame>;
}
