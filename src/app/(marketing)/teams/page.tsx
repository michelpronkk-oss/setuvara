import { TeamsPage } from "@/components/marketing/teams/teams-page";
import { marketingMetadata } from "@/lib/marketing/metadata";

export const metadata = marketingMetadata({
  title: "Setuvara for Teams",
  description: "Your company’s Business Mode, worn by your people. Setuvara for Teams is in development: start with your own Setuvara today and tell us what your team needs.",
  path: "/teams",
});

export default function TeamsRoute() {
  return <TeamsPage />;
}
