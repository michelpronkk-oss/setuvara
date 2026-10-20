import "server-only";

import { createActionsServiceClient } from "@/lib/actions/server";
import { openToken, sealToken } from "./crypto";
import { MANUAL_REFRESH_MINUTES, type SocialProvider } from "./model";
import { CREDENTIAL_ENV, PROVIDERS, ProviderError, validateTwitchToken, type Credentials, type Snapshot, type Tokens } from "./providers";

/**
 * Platform sign-in stays off until SOCIAL_CONNECT_ENABLED is true and the token key is set. Each
 * provider then needs its own app credentials, so one platform can go live before the others.
 */
export function socialConnectEnabled() {
  return process.env.SOCIAL_CONNECT_ENABLED === "true" && Boolean(process.env.SOCIAL_TOKEN_KEY?.trim());
}

export function providerCredentials(provider: SocialProvider): Credentials | null {
  const [idKey, secretKey] = CREDENTIAL_ENV[provider];
  const clientId = process.env[idKey]?.trim();
  const clientSecret = process.env[secretKey]?.trim();
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

export function socialProviderReady(provider: SocialProvider) {
  return socialConnectEnabled() && providerCredentials(provider) !== null;
}

/** The exact callback registered with each provider. */
export function redirectUri(origin: string, provider: SocialProvider) {
  const base = process.env.SOCIAL_REDIRECT_ORIGIN?.trim().replace(/\/$/, "") || origin;
  return `${base}/api/social/${provider}/callback`;
}

const binding = (accountId: string, provider: SocialProvider) => `social:${provider}:${accountId}`;
/** Short, log-safe error text. Never includes a token or a provider body. */
const errorText = (error: unknown) => (error instanceof ProviderError ? error.code : "unexpected");

function sealTokens(accountId: string, provider: SocialProvider, tokens: Tokens) {
  const bind = binding(accountId, provider);
  return {
    account_id: accountId,
    access_token_enc: sealToken(tokens.accessToken, bind),
    refresh_token_enc: tokens.refreshToken ? sealToken(tokens.refreshToken, bind) : null,
    expires_at: tokens.expiresAt?.toISOString() ?? null,
    refresh_expires_at: tokens.refreshExpiresAt?.toISOString() ?? null,
    scopes: tokens.scopes.slice(0, 500),
    updated_at: new Date().toISOString(),
  };
}

function snapshotRow(snapshot: Snapshot) {
  return {
    provider_account_id: snapshot.accountId.slice(0, 200),
    provider_scoped_id: snapshot.scopedId ?? null,
    username: snapshot.username.slice(0, 120),
    display_name: snapshot.displayName.slice(0, 120),
    profile_url: snapshot.profileUrl && snapshot.profileUrl.length <= 500 ? snapshot.profileUrl : null,
    avatar_url: snapshot.avatarUrl,
    audience_count: snapshot.audience,
    audience_hidden: snapshot.audienceHidden,
    status: "connected" as const,
    last_synced_at: new Date().toISOString(),
    last_error: null,
  };
}

/**
 * Stores a fresh sign-in. One platform account belongs to one Setuvara member, so someone else's
 * channel can't be claimed by signing in with it twice.
 */
export async function saveConnection(userId: string, provider: SocialProvider, tokens: Tokens, snapshot: Snapshot): Promise<"connected" | "account_taken"> {
  const db = createActionsServiceClient();
  const { data: owner } = await db.from("social_accounts").select("profile_id").eq("provider", provider).eq("provider_account_id", snapshot.accountId).maybeSingle();
  if (owner && owner.profile_id !== userId) return "account_taken";
  const { data: row, error } = await db.from("social_accounts")
    .upsert({ profile_id: userId, provider, ...snapshotRow(snapshot), connected_at: new Date().toISOString() }, { onConflict: "profile_id,provider" })
    .select("id").single();
  if (error || !row) throw new Error(error?.code === "23505" ? "account_taken" : "social_save_failed");
  const { error: secretError } = await db.from("social_account_secrets").upsert(sealTokens(row.id, provider, tokens), { onConflict: "account_id" });
  if (secretError) {
    await db.from("social_accounts").delete().eq("id", row.id);
    throw new Error("social_save_failed");
  }
  return "connected";
}

type Stored = { id: string; profile_id: string; provider: SocialProvider; last_synced_at: string | null; status: string };

async function loadTokens(account: Stored): Promise<Tokens | null> {
  const db = createActionsServiceClient();
  const { data } = await db.from("social_account_secrets").select("access_token_enc, refresh_token_enc, expires_at, refresh_expires_at, scopes").eq("account_id", account.id).maybeSingle();
  if (!data) return null;
  const bind = binding(account.id, account.provider);
  return {
    accessToken: openToken(data.access_token_enc, bind),
    refreshToken: data.refresh_token_enc ? openToken(data.refresh_token_enc, bind) : null,
    expiresAt: data.expires_at ? new Date(data.expires_at) : null,
    refreshExpiresAt: data.refresh_expires_at ? new Date(data.refresh_expires_at) : null,
    scopes: data.scopes ?? "",
  };
}

/** Refresh ahead of expiry: Instagram's 60-day token is renewed in its last 10 days. */
function needsRefresh(provider: SocialProvider, tokens: Tokens, now = Date.now()) {
  if (!tokens.expiresAt) return false;
  const margin = provider === "instagram" ? 10 * 24 * 60 * 60 * 1000 : 5 * 60 * 1000;
  return tokens.expiresAt.getTime() - now < margin;
}

/**
 * Reads the platform again and stores the result. A refused token marks the account for a new
 * sign-in; any other failure keeps the last good numbers and records why.
 */
export async function syncAccount(account: Stored): Promise<"synced" | "needs_reauth" | "error"> {
  const db = createActionsServiceClient();
  const creds = providerCredentials(account.provider);
  const spec = PROVIDERS[account.provider];
  try {
    if (!creds) throw new ProviderError("unavailable", "not configured");
    let tokens = await loadTokens(account);
    if (!tokens) throw new ProviderError("unauthorized", "no tokens");
    if (needsRefresh(account.provider, tokens)) {
      tokens = await spec.refresh({ creds, tokens });
      await db.from("social_account_secrets").update(sealTokens(account.id, account.provider, tokens)).eq("account_id", account.id);
    }
    if (account.provider === "twitch") await validateTwitchToken(tokens.accessToken);
    const snapshot = await spec.snapshot({ creds, accessToken: tokens.accessToken });
    const { provider_account_id: accountId, ...fields } = snapshotRow(snapshot);
    // A different account behind the same token means the member switched accounts on the platform.
    const { data: existing } = await db.from("social_accounts").select("provider_account_id").eq("id", account.id).maybeSingle();
    if (existing && existing.provider_account_id !== accountId) throw new ProviderError("unauthorized", "account changed");
    await db.from("social_accounts").update(fields).eq("id", account.id);
    return "synced";
  } catch (error) {
    const reauth = error instanceof ProviderError && error.code === "unauthorized";
    await db.from("social_accounts").update({ status: reauth ? "needs_reauth" : "error", last_error: errorText(error) }).eq("id", account.id);
    return reauth ? "needs_reauth" : "error";
  }
}

export async function ownAccount(userId: string, provider: SocialProvider): Promise<Stored | null> {
  const db = createActionsServiceClient();
  const { data } = await db.from("social_accounts").select("id, profile_id, provider, last_synced_at, status").eq("profile_id", userId).eq("provider", provider).maybeSingle();
  return (data as Stored | null) ?? null;
}

export function refreshAllowed(account: Pick<Stored, "last_synced_at" | "status">, now = Date.now()) {
  if (account.status !== "connected" || !account.last_synced_at) return true;
  return now - new Date(account.last_synced_at).getTime() >= MANUAL_REFRESH_MINUTES * 60 * 1000;
}

/**
 * Revokes at the platform where it offers that, then deletes the account, its synced details and its
 * tokens (social_account_secrets cascades). Throws if the delete did not happen, so nobody is told
 * an account is gone while it is still stored.
 */
export async function disconnectAccount(account: Stored) {
  const db = createActionsServiceClient();
  const creds = providerCredentials(account.provider);
  const revoke = PROVIDERS[account.provider].revoke;
  if (creds && revoke) {
    try {
      const tokens = await loadTokens(account);
      if (tokens) await revoke({ creds, tokens });
    } catch {
      // The platform may already have dropped the token. Deleting ours is what matters.
    }
  }
  const { error } = await db.from("social_accounts").delete().eq("id", account.id).eq("profile_id", account.profile_id);
  if (error) throw new Error("social_delete_failed");
}

/** Accounts the scheduled job should refresh: Twitch hourly (its validation rule), others every 6 hours. */
export async function dueAccounts(limit = 50): Promise<Stored[]> {
  const db = createActionsServiceClient();
  const now = Date.now();
  const [hourly, slow] = await Promise.all([
    db.from("social_accounts").select("id, profile_id, provider, last_synced_at, status").eq("provider", "twitch").neq("status", "needs_reauth").lt("last_synced_at", new Date(now - 55 * 60 * 1000).toISOString()).order("last_synced_at").limit(limit),
    db.from("social_accounts").select("id, profile_id, provider, last_synced_at, status").neq("provider", "twitch").neq("status", "needs_reauth").lt("last_synced_at", new Date(now - 6 * 60 * 60 * 1000).toISOString()).order("last_synced_at").limit(limit),
  ]);
  return [...(hourly.data ?? []), ...(slow.data ?? [])].slice(0, limit) as Stored[];
}
