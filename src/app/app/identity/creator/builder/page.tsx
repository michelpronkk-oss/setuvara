import type { Metadata } from "next";

import { BuilderView } from "@/components/builder/builder-view";

export const metadata: Metadata = { title: "Builder · Creator · Setuvara" };

export default async function CreatorBuilderPage({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const { project } = await searchParams;
  return <BuilderView project={project ?? null} slug="creator" />;
}
