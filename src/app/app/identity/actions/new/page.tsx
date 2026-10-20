import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ActionsFrame } from "@/components/actions/actions-frame";
import { NewAction } from "@/components/actions/actions-pages";
import { isActionMode } from "@/lib/actions/studio-server";

export const metadata: Metadata = { title: "New Action · Setuvara" };

export default async function NewModeActionPage({ searchParams }: { searchParams: Promise<{ mode?: string; kind?: string }> }) {
  const { mode, kind } = await searchParams;
  const slug = isActionMode(mode) ? mode : "personal";
  if (slug === "creator") redirect(`/app/identity/creator/actions/new${kind ? `?kind=${encodeURIComponent(kind)}` : ""}`);
  return <ActionsFrame slug={slug}><NewAction kind={kind} slug={slug} /></ActionsFrame>;
}
