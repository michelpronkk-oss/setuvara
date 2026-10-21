import type { Metadata } from "next";

import { TeamsIndex } from "@/components/business/workspace-pages";

export const metadata: Metadata = { title: "Teams" };

export default function TeamsPage() {
  return <TeamsIndex />;
}
