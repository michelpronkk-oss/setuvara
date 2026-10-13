import { TeamsPage } from "@/components/marketing/teams/teams-page";
import { marketingMetadata } from "@/lib/marketing/metadata";

export const metadata = marketingMetadata({
  title: "Setuvara for Teams",
  description: "A people-first foundation for teams and the connections they make.",
  path: "/teams",
});

export default function TeamsRoute() {
  return <TeamsPage />;
}
