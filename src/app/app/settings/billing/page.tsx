import { redirect } from "next/navigation";

import { readDodoConfiguration } from "@/lib/billing/config";
import { readPlanIntent } from "@/lib/billing/intent";
import { getProviderPlanState, getUserBillingState } from "@/lib/billing/service";
import type { BillingSnapshot } from "@/lib/billing/state";
import { createClient } from "@/lib/supabase/server";

import { BillingPanel } from "./billing-panel";

export const metadata = { title: "Billing" };

type BillingPageProps = {
  searchParams: Promise<{ billing?: string; start?: string | string[]; interval?: string | string[] }>;
};

export default async function BillingSettingsPage({ searchParams }: BillingPageProps) {
  const supabase = await createClient();
  const { data: claims, error } = await supabase.auth.getClaims();
  const userId = !error && typeof claims?.claims?.sub === "string" ? claims.claims.sub : null;
  if (!userId) redirect("/login?next=/app/settings/billing");

  const query = await searchParams;
  let billing: BillingSnapshot | null = null;
  try {
    billing = await getUserBillingState(userId);
  } catch {
    billing = null;
  }
  const provider = billing && billing.plan !== "free" ? await getProviderPlanState(userId) : null;

  return (
    <BillingPanel
      billing={billing}
      checkoutConfigured={readDodoConfiguration() !== null}
      intent={readPlanIntent(query.start, query.interval, billing?.interval ?? "yearly")}
      notice={query.billing === "return" ? "return" : query.billing === "cancelled" ? "cancelled" : null}
      granted={provider?.linked === false}
      scheduled={provider?.linked ? provider.scheduled : null}
    />
  );
}
