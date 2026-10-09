import { MarketingRoutePage } from "@/components/marketing/primitives";
import { marketingMetadata } from "@/lib/marketing/metadata";

export const metadata = marketingMetadata({
  title: "Setuvara for Teams",
  description: "A people-first foundation for teams and the connections they make.",
  path: "/teams",
});

export default function TeamsPage() {
  return <MarketingRoutePage eyebrow="For teams" title="A better introduction starts with people." description="Setuvara begins with each person’s own identity. Team experiences are still taking shape, so there are no team plans to sign up for yet." />;
}
