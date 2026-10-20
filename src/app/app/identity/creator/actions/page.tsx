import type { Metadata } from "next";

import { ActionsIndex } from "@/components/actions/actions-pages";

export const metadata: Metadata = { title: "Actions · Creator · Setuvara" };

export default function CreatorActionsPage() {
  return <ActionsIndex slug="creator" />;
}
