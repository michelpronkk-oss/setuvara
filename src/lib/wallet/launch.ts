import "server-only";

/**
 * Product launch gate for consumer-facing Wallet surfaces.
 * Keep this separate from provider credentials: configuration alone must never
 * make Wallet appear launched.
 */
export const WALLET_PUBLICLY_LAUNCHED = false;
