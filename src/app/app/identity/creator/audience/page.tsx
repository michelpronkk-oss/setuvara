import type { Metadata } from "next";

import { AudienceIndex } from "@/components/audience/audience-pages";

export const metadata: Metadata = { title: "Audience · Creator · Setuvara" };

export default function CreatorAudiencePage() {
  return <AudienceIndex slug="creator" />;
}
