import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ActionsFrame } from "@/components/actions/actions-frame";
import { BuilderView } from "@/components/builder/builder-view";

export const metadata: Metadata = { title: "Builder · Setuvara" };

/** Business Mode's Builder; Creator's lives inside the Creator studio. */
export default async function BuilderPage({ searchParams }: { searchParams: Promise<{ mode?: string; project?: string }> }) {
  const query = await searchParams;
  if (query.mode !== "business") redirect(`/app/identity/creator/builder${query.project ? `?project=${encodeURIComponent(query.project)}` : ""}`);
  return <ActionsFrame page="builder" slug="business"><BuilderView project={query.project ?? null} slug="business" /></ActionsFrame>;
}
