import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CampaignDetail } from "@/components/audience/audience-pages";

export const metadata: Metadata = { title: "Campaign · Creator · Setuvara" };

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function CreatorCampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!uuid.test(id)) notFound();
  return <CampaignDetail id={id} slug="creator" />;
}
