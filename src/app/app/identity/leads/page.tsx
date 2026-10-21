import type { Metadata } from "next";

import { ActionsFrame } from "@/components/actions/actions-frame";
import { LeadsIndex } from "@/components/business/leads-pages";

export const metadata: Metadata = { title: "Leads · Setuvara" };

const WINDOWS = [7, 30, 90, 365];

export default async function LeadsPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const { days } = await searchParams;
  const asked = Number(days);
  return <ActionsFrame page="leads" slug="business"><LeadsIndex days={WINDOWS.includes(asked) ? asked : 30} /></ActionsFrame>;
}
