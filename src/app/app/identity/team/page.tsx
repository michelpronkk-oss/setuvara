import type { Metadata } from "next";

import { ActionsFrame } from "@/components/actions/actions-frame";
import { TeamIndex } from "@/components/business/team-pages";

export const metadata: Metadata = { title: "Team · Setuvara" };

export default function TeamPage() {
  return <ActionsFrame page="team" slug="business"><TeamIndex /></ActionsFrame>;
}
