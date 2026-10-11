import { PricingPlans } from "@/components/marketing/pricing-plans";
import { PUBLIC_PLAN_CATALOG } from "@/lib/billing/catalog";
import { getViewerPlan } from "@/lib/app/viewer";
import { createClient } from "@/lib/supabase/server";
import { marketingMetadata } from "@/lib/marketing/metadata";

export const metadata = marketingMetadata({
  title: "Pricing | Setuvara",
  description: "Keep the Setuvara network open on Free. Add member status and deeper product analytics with Plus or Pro.",
  path: "/pricing",
});

export default async function PricingPage() {
  const supabase = await createClient();
  const { data: claims, error } = await supabase.auth.getClaims();
  const userId = !error && typeof claims?.claims?.sub === "string" ? claims.claims.sub : null;
  const billing = userId
    ? await getViewerPlan(userId)
    : { plan: "free" as const, canManageBilling: false, available: true };

  return (
    <PricingPlans
      billingAvailable={billing.available}
      currentPlan={billing.plan}
      plans={PUBLIC_PLAN_CATALOG.map(({ code, displayName, monthlyPriceMinor, yearlyPriceMinor, capabilities }) => ({ code, displayName, monthlyPriceMinor, yearlyPriceMinor, capabilities }))}
      signedIn={Boolean(userId)}
    />
  );
}
