"use server";

import { revalidatePath } from "next/cache";

import { createCommerceServiceClient } from "@/lib/commerce/server";
import { createClient } from "@/lib/supabase/server";

import { RevenueKeyError, type ProviderCode } from "./metrics";
import { ADAPTERS, syncConnection } from "./server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ERRORS: Record<string, string> = {
  plan_limit: "Your plan doesn't include another revenue provider.",
  already_connected: "This provider is already connected to the project.",
  project_not_found: "That project isn't here anymore.",
  connection_not_found: "That connection isn't here anymore.",
};
const say = (message?: string) => Object.entries(ERRORS).find(([key]) => message?.includes(key))?.[1] ?? "That didn't go through. Try again.";
const refresh = () => { revalidatePath("/app/identity/creator/builder"); revalidatePath("/app/identity/builder"); };

/** Verifies a member's read-only key with the provider, stores it in Vault and runs a first sync. The key never comes back. */
export async function connectRevenue(projectId: string, provider: ProviderCode, key: string) {
  const adapter = ADAPTERS[provider];
  if (!UUID.test(projectId) || !adapter) return { ok: false as const, error: "That provider isn't available yet." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Sign in again." };
  const { data: project } = await supabase.from("builder_projects").select("id").eq("id", projectId).maybeSingle();
  if (!project) return { ok: false as const, error: ERRORS.project_not_found };
  let verified;
  try { verified = await adapter.verify(key.trim()); }
  catch (error) { return { ok: false as const, error: error instanceof RevenueKeyError ? error.message : "We couldn't reach the provider. Try again." }; }
  const service = createCommerceServiceClient();
  const { data: id, error } = await service.rpc("revenue_connect", { p_user: user.id, p_project: projectId, p_provider: provider,
    p_environment: verified.environment, p_account_ref: verified.accountRef, p_key_hint: verified.keyHint, p_secret: key.trim() });
  if (error) return { ok: false as const, error: say(error.message) };
  await syncConnection(service, { id: id as string, provider });
  refresh();
  return { ok: true as const, environment: verified.environment };
}

/** Destroys the stored key. History stays for the owner; nothing shows as verified anymore. */
export async function disconnectRevenue(connectionId: string) {
  if (!UUID.test(connectionId)) return { ok: false as const, error: ERRORS.connection_not_found };
  const supabase = await createClient();
  const { error } = await supabase.rpc("revenue_disconnect", { p_connection: connectionId });
  if (error) return { ok: false as const, error: say(error.message) };
  refresh();
  return { ok: true as const };
}

/** Fetches fresh numbers now with the stored key. At most once every five minutes per connection. */
export async function syncRevenueNow(connectionId: string) {
  if (!UUID.test(connectionId)) return { ok: false as const, error: ERRORS.connection_not_found };
  const supabase = await createClient();
  const [{ data: connection }, { data: limits }] = await Promise.all([
    supabase.from("revenue_connections").select("id, provider, last_sync_at").eq("id", connectionId).neq("status", "revoked").maybeSingle(),
    supabase.rpc("my_revenue_limits"),
  ]);
  if (!connection) return { ok: false as const, error: ERRORS.connection_not_found };
  if (!((limits as { providers?: number } | null)?.providers)) return { ok: false as const, error: ERRORS.plan_limit };
  if (connection.last_sync_at && Date.now() - new Date(connection.last_sync_at).getTime() < 5 * 60_000) return { ok: false as const, error: "Synced a moment ago. Try again in a few minutes." };
  const synced = await syncConnection(createCommerceServiceClient(), connection);
  refresh();
  return synced ? { ok: true as const } : { ok: false as const, error: "The sync didn't go through. The reason is shown on the connection." };
}
