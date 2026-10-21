import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { WorkspaceIndex } from "@/components/business/workspace-pages";

export const metadata: Metadata = { title: "Leads" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function WorkspacePage({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  if (!UUID.test(businessId)) notFound();
  return <WorkspaceIndex businessId={businessId} />;
}
