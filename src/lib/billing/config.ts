import "server-only";

import type { BillingInterval, PlanCode } from "./catalog";
import { isDodoEnvironmentAllowed, type DodoEnvironment } from "./environment";
export { isDodoEnvironmentAllowed } from "./environment";

export type { DodoEnvironment } from "./environment";
export type PaidPlanCode = Exclude<PlanCode, "free">;

export type DodoConfiguration = {
  apiKey: string;
  webhookKey: string;
  environment: DodoEnvironment;
  products: Readonly<Record<PaidPlanCode, Readonly<Record<BillingInterval, string | null>>>>;
};

export class BillingUnavailableError extends Error {
  readonly code: string;

  constructor(code = "billing_unavailable") {
    super(code);
    this.name = "BillingUnavailableError";
    this.code = code;
  }
}

export function readDodoConfiguration(): DodoConfiguration | null {
  const apiKey = process.env.DODO_PAYMENTS_API_KEY?.trim();
  const webhookKey = process.env.DODO_PAYMENTS_WEBHOOK_KEY?.trim();
  const environment = process.env.DODO_PAYMENTS_ENVIRONMENT?.trim();

  if (
    !apiKey ||
    !webhookKey ||
    !isDodoEnvironmentAllowed(environment, process.env.NODE_ENV)
  ) {
    return null;
  }

  return {
    apiKey,
    webhookKey,
    environment,
    products: {
      plus: {
        monthly: process.env.DODO_PLUS_MONTHLY_PRODUCT_ID?.trim() || null,
        yearly: process.env.DODO_PLUS_YEARLY_PRODUCT_ID?.trim() || null,
      },
      pro: {
        monthly: process.env.DODO_PRO_MONTHLY_PRODUCT_ID?.trim() || null,
        yearly: process.env.DODO_PRO_YEARLY_PRODUCT_ID?.trim() || null,
      },
    },
  };
}

export function getProductId(
  config: DodoConfiguration,
  plan: PaidPlanCode,
  interval: BillingInterval,
): string {
  const productId = config.products[plan][interval];
  if (!productId || !/^pdt_[A-Za-z0-9]+$/.test(productId)) {
    throw new BillingUnavailableError("billing_product_unconfigured");
  }
  return productId;
}

const allowedOrigins = new Set([
  "https://setuvara.com",
  "https://www.setuvara.com",
  "http://127.0.0.1:3014",
  "http://localhost:3014",
]);

export function getSetuvaraOrigin(): string {
  const candidate = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!candidate) throw new BillingUnavailableError("billing_site_url_unconfigured");

  try {
    const parsed = new URL(candidate);
    if (parsed.origin !== candidate.replace(/\/$/, "") || !allowedOrigins.has(parsed.origin)) {
      throw new Error("invalid_origin");
    }
    return parsed.origin;
  } catch {
    throw new BillingUnavailableError("billing_site_url_unconfigured");
  }
}
