import { redirect } from "next/navigation";

import { parseUpgradeChoice } from "@/lib/billing/intent";

/** Landing for a plan picked on Pricing before signup or login. Billing asks to confirm. */
export default async function UpgradeChoicePage({ params }: { params: Promise<{ choice: string }> }) {
  const intent = parseUpgradeChoice((await params).choice);
  redirect(intent ? `/app/settings/billing?start=${intent.plan}&interval=${intent.interval}` : "/app/settings/billing");
}
