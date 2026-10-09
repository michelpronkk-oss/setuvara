import "server-only";

import DodoPayments from "dodopayments";

import { BillingUnavailableError, readDodoConfiguration } from "./config";
import { isDodoEnvironmentAllowed } from "./environment";

export function getDodoApiClient(): DodoPayments {
  const config = readDodoConfiguration();
  if (!config) throw new BillingUnavailableError();

  return new DodoPayments({
    bearerToken: config.apiKey,
    webhookKey: config.webhookKey,
    environment: config.environment,
    timeout: 12_000,
    maxRetries: 1,
    logLevel: "error",
  });
}

export function getDodoWebhookClient(): DodoPayments {
  const webhookKey = process.env.DODO_PAYMENTS_WEBHOOK_KEY?.trim();
  const environment = process.env.DODO_PAYMENTS_ENVIRONMENT?.trim();
  if (!webhookKey || !isDodoEnvironmentAllowed(environment, process.env.NODE_ENV)) {
    throw new BillingUnavailableError("billing_environment_unconfigured");
  }

  return new DodoPayments({
    webhookKey,
    environment,
    timeout: 12_000,
    maxRetries: 0,
    logLevel: "error",
  });
}
