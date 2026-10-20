import type { Metadata } from "next";

import { NewAction } from "@/components/actions/actions-pages";

export const metadata: Metadata = { title: "New Action · Creator · Setuvara" };

export default async function NewCreatorActionPage({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const { kind } = await searchParams;
  return <NewAction kind={kind} slug="creator" />;
}
