import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { ProviderCode, RevenueAdapter } from "./metrics";
import { stripeRevenue } from "./stripe";

/** Adapters that can be connected today. RevenueCat and Dodo Payments join here. */
export const ADAPTERS: Partial<Record<ProviderCode, RevenueAdapter>> = { stripe: stripeRevenue };

/** One sync of one connection. Provider errors are recorded on the connection, never as numbers. */
export async function syncConnection(service: SupabaseClient, connection: { id: string; provider: string }) {
  const adapter = ADAPTERS[connection.provider as ProviderCode];
  const { data: key } = await service.rpc("revenue_connection_secret", { p_connection: connection.id });
  if (!adapter || typeof key !== "string") return false;
  try {
    const { rows, method } = await adapter.sync(key);
    await service.rpc("revenue_record_sync", { p_connection: connection.id, p_ok: true, p_error: null, p_rows: rows, p_method: method });
    return true;
  } catch (failure) {
    const message = failure instanceof Error && /permission|authentic|api key|expired|revoked/i.test(failure.message)
      ? "The provider refused the key. Reconnect with a new read-only key." : "The provider didn't answer. We'll try again.";
    await service.rpc("revenue_record_sync", { p_connection: connection.id, p_ok: false, p_error: message, p_rows: null, p_method: adapter.code });
    return false;
  }
}
