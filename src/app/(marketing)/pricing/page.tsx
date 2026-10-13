import { Faq, FinalCta } from "@/components/marketing/pricing/closing";
import { Compare } from "@/components/marketing/pricing/compare";
import { HeroPlans } from "@/components/marketing/pricing/hero-plans";
import { Insights } from "@/components/marketing/pricing/insights";
import { ConnectChoice, Looks } from "@/components/marketing/pricing/looks";
import { PlusShowcase } from "@/components/marketing/pricing/plus-showcase";
import { PricingProvider, type PricingViewer } from "@/components/marketing/pricing/pricing-context";
import { ProShowcase } from "@/components/marketing/pricing/pro-showcase";
import { Tap } from "@/components/marketing/pricing/tap";
import { JsonLd } from "@/components/seo/json-ld";
import { getPublicPlan, PUBLIC_PLAN_CATALOG } from "@/lib/billing/catalog";
import { formatPrice, PLAN_TAGLINES } from "@/lib/billing/plan-copy";
import { getUserBillingState } from "@/lib/billing/service";
import { marketingMetadata, SETUVARA_ORIGIN, SETUVARA_ORGANIZATION_ID } from "@/lib/marketing/metadata";
import { createClient } from "@/lib/supabase/server";

export const metadata = marketingMetadata({
  title: "Pricing | Setuvara",
  description: `Free is complete, for good. Plus (${formatPrice(getPublicPlan("plus").monthlyPriceMinor)} a month) adds the badge, all ten Appearances and insights. Pro (${formatPrice(getPublicPlan("pro").monthlyPriceMinor)} a month) adds the full picture.`,
  path: "/pricing",
});

// Prices come straight from the billing catalog, so search results never quote a stale price.
const price = (minor: number) => (minor / 100).toFixed(2);
const pricingStructuredData = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Setuvara",
  url: `${SETUVARA_ORIGIN}/`,
  applicationCategory: "SocialNetworkingApplication",
  operatingSystem: "Web",
  publisher: { "@id": SETUVARA_ORGANIZATION_ID },
  offers: PUBLIC_PLAN_CATALOG.flatMap((plan) => plan.monthlyPriceMinor === 0
    ? [{ "@type": "Offer", name: `Setuvara ${plan.displayName}`, description: PLAN_TAGLINES[plan.code], price: "0", priceCurrency: plan.currency, url: `${SETUVARA_ORIGIN}/pricing` }]
    : ([["monthly", "P1M", plan.monthlyPriceMinor], ["yearly", "P1Y", plan.yearlyPriceMinor]] as const).map(([interval, duration, minor]) => ({
      "@type": "Offer",
      name: `Setuvara ${plan.displayName} (${interval})`,
      description: PLAN_TAGLINES[plan.code],
      price: price(minor),
      priceCurrency: plan.currency,
      url: `${SETUVARA_ORIGIN}/pricing`,
      priceSpecification: { "@type": "UnitPriceSpecification", price: price(minor), priceCurrency: plan.currency, billingDuration: duration },
    }))),
};

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
      <JsonLd data={pricingStructuredData} />
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
