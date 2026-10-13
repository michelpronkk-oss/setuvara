import { Faq, FinalCta } from "@/components/marketing/pricing/closing";
import { Compare } from "@/components/marketing/pricing/compare";
import { HeroPlans } from "@/components/marketing/pricing/hero-plans";
import { Insights } from "@/components/marketing/pricing/insights";
import { ConnectChoice, Looks } from "@/components/marketing/pricing/looks";
import { PlusShowcase } from "@/components/marketing/pricing/plus-showcase";
import { PricingProvider, type PricingViewer } from "@/components/marketing/pricing/pricing-context";
import { ProShowcase } from "@/components/marketing/pricing/pro-showcase";
import { Tap } from "@/components/marketing/pricing/tap";
import { getUserBillingState } from "@/lib/billing/service";
import { marketingMetadata } from "@/lib/marketing/metadata";
import { createClient } from "@/lib/supabase/server";

export const metadata = marketingMetadata({
  title: "Pricing | Setuvara",
  description: "Free is complete, for good. Plus adds the badge, all ten Appearances and insights. Pro adds the full picture.",
  path: "/pricing",
});

async function readViewer(): Promise<PricingViewer> {
  const supabase = await createClient();
  const { data: claims, error } = await supabase.auth.getClaims();
  const userId = !error && typeof claims?.claims?.sub === "string" ? claims.claims.sub : null;
  if (!userId) return { signedIn: false, plan: "free", interval: null, available: true };
  try {
    const billing = await getUserBillingState(userId);
    return { signedIn: true, plan: billing.plan, interval: billing.interval, available: true };
  } catch {
    return { signedIn: true, plan: "free", interval: null, available: false };
  }
}

export default async function PricingPage() {
  return (
    <PricingProvider viewer={await readViewer()}>
      <HeroPlans />
      <Looks />
      <ConnectChoice />
      <PlusShowcase />
      <Insights />
      <ProShowcase />
      <Tap />
      <Compare />
      <Faq />
      <FinalCta />
    </PricingProvider>
  );
}
