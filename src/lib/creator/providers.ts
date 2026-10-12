import type { CreatorOrderStatus } from "./types";

export type CreatorPaymentEvent = {
  provider: string;
  providerEventId: string;
  eventType: string;
  orderId: string | null;
  status: CreatorOrderStatus | null;
};

/** Provider contracts only. Implementations must be added after provider selection. */
export interface CreatorPaymentProvider {
  createCheckout(input: { orderId: string; amountMinor: number; currency: string; idempotencyKey: string }): Promise<{ checkoutUrl: string; providerPaymentId: string }>;
  verifyEvent(input: { rawBody: Uint8Array; headers: Headers }): Promise<CreatorPaymentEvent>;
}

export interface CreatorVerificationProvider {
  createOnboarding(input: { userId: string; countryCode: string; returnUrl: string }): Promise<{ providerAccountId: string; onboardingUrl: string }>;
}

export interface CreatorPayoutProvider {
  createPayout(input: { providerAccountId: string; amountMinor: number; currency: string; idempotencyKey: string }): Promise<{ providerPayoutId: string }>;
}
