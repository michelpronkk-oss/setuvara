import { PUBLIC_PLAN_CATALOG } from "@/lib/billing/catalog";
import { json } from "@/lib/billing/http";

export function GET() {
  return json({ plans: PUBLIC_PLAN_CATALOG });
}
