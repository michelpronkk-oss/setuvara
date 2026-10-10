import type { Metadata } from "next";

import { AnalyticsDashboard } from "@/components/app/analytics/analytics-dashboard";

export const metadata: Metadata = {
  title: "Analytics · Setuvara",
  description: "See how people find and connect through your Setuvara.",
};

export default function AnalyticsPage() {
  return <AnalyticsDashboard />;
}
