import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ActionsFrame } from "@/components/actions/actions-frame";
import { ActionsIndex } from "@/components/actions/actions-pages";
import { isActionMode } from "@/lib/actions/studio-server";

export const metadata: Metadata = { title: "Actions · Setuvara" };

export default async function ModeActionsPage({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
  const { mode } = await searchParams;
  const slug = isActionMode(mode) ? mode : "personal";
  if (slug === "creator") redirect("/app/identity/creator/actions");
  return <ActionsFrame slug={slug}><ActionsIndex slug={slug} /></ActionsFrame>;
}
