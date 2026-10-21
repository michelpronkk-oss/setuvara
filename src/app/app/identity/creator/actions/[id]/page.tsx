import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ActionDetail } from "@/components/actions/actions-pages";

export const metadata: Metadata = { title: "Action · Creator · Setuvara" };

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function CreatorActionPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string; response?: string; days?: string }> }) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  if (!uuid.test(id)) notFound();
  return <ActionDetail id={id} query={query} slug="creator" />;
}
