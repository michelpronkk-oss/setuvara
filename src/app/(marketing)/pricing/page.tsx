import { MarketingRoutePage } from "@/components/marketing/primitives";
import { marketingMetadata } from "@/lib/marketing/metadata";

export const metadata = marketingMetadata({
  title: "Pricing",
  description: "Setuvara pricing will be published here before paid plans begin.",
  path: "/pricing",
});

export default function PricingPage() {
  return <MarketingRoutePage eyebrow="Pricing" title="Clear pricing, when it’s time." description="Setuvara’s pricing will be published here before any paid plans begin. For now, create your identity and explore the product." note="No plan or price is being advertised on this page yet." />;
}
