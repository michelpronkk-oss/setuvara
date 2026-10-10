import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { InternalAnalyticsDashboard } from "@/components/internal/analytics-dashboard";
import { isSetuvaraInternalAnalyticsAdmin } from "@/lib/analytics/internal-auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Internal analytics | Setuvara",
  robots: { index: false, follow: false },
};

export default async function InternalAnalyticsPage() {
  let userId: string | null = null;
  let confirmed = false;

  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (!error && user?.id) {
      userId = user.id;
      confirmed = Boolean(user.email_confirmed_at);
    }
  } catch {
    // Treat unavailable auth configuration as an unauthenticated request.
  }

  if (!userId || !confirmed) redirect("/login?next=%2Finternal%2Fanalytics");
  if (!isSetuvaraInternalAnalyticsAdmin(userId)) notFound();

  return <InternalAnalyticsDashboard />;
}
