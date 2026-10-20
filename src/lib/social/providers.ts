import type { SocialProvider } from "./model";

/**
 * The four official sign-ins. Each provider reads only public identity and an audience count, with
 * the narrowest scope that returns them. Nothing here can post, read messages or see private data.
 *
 * Endpoints are from each platform's developer documentation (checked 2026-10-20):
 *   YouTube   Google OAuth 2.0 for web servers + YouTube Data API v3 channels.list (1 quota unit)
 *   Twitch    Authorization code grant + Helix Get Users and Get Channel Followers
 *   TikTok    Login Kit for Web + Display API user/info
 *   Instagram Instagram API with Instagram Login (professional accounts)
 */

export type Credentials = { clientId: string; clientSecret: string };
export type Tokens = { accessToken: string; refreshToken: string | null; expiresAt: Date | null; refreshExpiresAt: Date | null; scopes: string };
export type Snapshot = {
  accountId: string;
  username: string;
  displayName: string;
  profileUrl: string | null;
  avatarUrl: string | null;
  audience: number | null;
  audienceHidden: boolean;
  /** A second platform id, kept only to match deletion callbacks (Instagram's app-scoped id). */
  scopedId?: string | null;
};

export class ProviderError extends Error {
  constructor(readonly code: "unauthorized" | "rate_limited" | "no_account" | "not_professional" | "bad_response" | "unavailable", detail?: string) {
    super(detail ? `${code}: ${detail}` : code);
  }
}

type Spec = {
  scopes: string[];
  pkce: boolean;
  authorizeUrl: (input: { creds: Credentials; redirectUri: string; state: string; challenge?: string }) => string;
  exchange: (input: { creds: Credentials; redirectUri: string; code: string; verifier?: string }) => Promise<Tokens>;
  /** Refreshes the access token. Instagram refreshes the long-lived token itself. */
  refresh: (input: { creds: Credentials; tokens: Tokens }) => Promise<Tokens>;
  revoke: ((input: { creds: Credentials; tokens: Tokens }) => Promise<void>) | null;
  snapshot: (input: { creds: Credentials; accessToken: string }) => Promise<Snapshot>;
};

const TIMEOUT_MS = 10_000;

async function call(url: string, init: RequestInit = {}) {
  let response: Response;
  try {
    response = await fetch(url, { ...init, cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch {
    throw new ProviderError("unavailable");
  }
  const text = await response.text();
  let json: unknown = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = null; }
  if (response.status === 401 || response.status === 403) throw new ProviderError("unauthorized", String(response.status));
  if (response.status === 429) throw new ProviderError("rate_limited");
  if (!response.ok) {
    // OAuth servers answer a bad or expired grant with 400 invalid_grant.
    const error = (json as { error?: unknown } | null)?.error;
    if (response.status === 400 && (error === "invalid_grant" || error === "invalid_token")) throw new ProviderError("unauthorized", String(error));
    throw new ProviderError(response.status >= 500 ? "unavailable" : "bad_response", String(response.status));
  }
  return json;
}

const form = (values: Record<string, string>) => ({ method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(values).toString() });
const str = (value: unknown) => (typeof value === "string" ? value : "");
const httpsOrNull = (value: unknown) => (typeof value === "string" && value.startsWith("https://") && value.length <= 2000 ? value : null);
const count = (value: unknown) => {
  const number = typeof value === "string" ? Number(value) : value;
  return typeof number === "number" && Number.isSafeInteger(number) && number >= 0 ? number : null;
};
const inSeconds = (value: unknown, now: number) => (typeof value === "number" && value > 0 ? new Date(now + value * 1000) : null);

/** The standard OAuth token response, as Google, Twitch and TikTok send it. */
export function parseTokenResponse(json: unknown, previous: Tokens | null = null, now = Date.now()): Tokens {
  const data = (json ?? {}) as Record<string, unknown>;
  const accessToken = str(data.access_token);
  if (!accessToken) throw new ProviderError("bad_response", "no access token");
  const scope = Array.isArray(data.scope) ? data.scope.join(" ") : str(data.scope);
  return {
    accessToken,
    // Google omits the refresh token on refresh; keep the one we have.
    refreshToken: str(data.refresh_token) || previous?.refreshToken || null,
    expiresAt: inSeconds(data.expires_in, now),
    refreshExpiresAt: inSeconds(data.refresh_expires_in, now) ?? previous?.refreshExpiresAt ?? null,
    scopes: scope || previous?.scopes || "",
  };
}

// ------------------------------------------------------------------ YouTube

export function parseYouTubeChannel(json: unknown): Snapshot {
  const item = ((json as { items?: unknown[] } | null)?.items ?? [])[0] as { id?: unknown; snippet?: Record<string, unknown>; statistics?: Record<string, unknown> } | undefined;
  if (!item || typeof item.id !== "string") throw new ProviderError("no_account", "no channel");
  const id = item.id;
  const snippet = item.snippet ?? {};
  const stats = item.statistics ?? {};
  const handle = str(snippet.customUrl);
  const thumbs = (snippet.thumbnails ?? {}) as Record<string, { url?: unknown }>;
  const hidden = stats.hiddenSubscriberCount === true;
  return {
    accountId: id,
    username: handle ? (handle.startsWith("@") ? handle : `@${handle}`) : "",
    displayName: str(snippet.title).slice(0, 120),
    profileUrl: handle ? `https://www.youtube.com/${handle.startsWith("@") ? handle : `@${handle}`}` : `https://www.youtube.com/channel/${encodeURIComponent(id)}`,
    avatarUrl: httpsOrNull(thumbs.medium?.url) ?? httpsOrNull(thumbs.default?.url),
    audience: hidden ? null : count(stats.subscriberCount),
    audienceHidden: hidden,
  };
}

const youtube: Spec = {
  scopes: ["https://www.googleapis.com/auth/youtube.readonly"],
  pkce: true,
  authorizeUrl: ({ creds, redirectUri, state, challenge }) => `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
    client_id: creds.clientId, redirect_uri: redirectUri, response_type: "code", scope: youtube.scopes.join(" "),
    access_type: "offline", prompt: "consent", include_granted_scopes: "false", state,
    ...(challenge ? { code_challenge: challenge, code_challenge_method: "S256" } : {}),
  })}`,
  exchange: async ({ creds, redirectUri, code, verifier }) => parseTokenResponse(await call("https://oauth2.googleapis.com/token", form({
    code, client_id: creds.clientId, client_secret: creds.clientSecret, redirect_uri: redirectUri, grant_type: "authorization_code", ...(verifier ? { code_verifier: verifier } : {}),
  }))),
  refresh: async ({ creds, tokens }) => {
    if (!tokens.refreshToken) throw new ProviderError("unauthorized", "no refresh token");
    return parseTokenResponse(await call("https://oauth2.googleapis.com/token", form({ client_id: creds.clientId, client_secret: creds.clientSecret, refresh_token: tokens.refreshToken, grant_type: "refresh_token" })), tokens);
  },
  revoke: async ({ tokens }) => { await call("https://oauth2.googleapis.com/revoke", form({ token: tokens.refreshToken ?? tokens.accessToken })); },
  snapshot: async ({ accessToken }) => parseYouTubeChannel(await call("https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true", { headers: { Authorization: `Bearer ${accessToken}` } })),
};

// ------------------------------------------------------------------ Twitch

export function parseTwitchUser(json: unknown) {
  const user = ((json as { data?: unknown[] } | null)?.data ?? [])[0] as Record<string, unknown> | undefined;
  if (!user || typeof user.id !== "string") throw new ProviderError("no_account", "no user");
  const login = str(user.login);
  return { id: user.id, login, displayName: str(user.display_name).slice(0, 120), avatarUrl: httpsOrNull(user.profile_image_url) };
}

const twitch: Spec = {
  // Get Channel Followers returns the total for the broadcaster with this scope.
  scopes: ["moderator:read:followers"],
  pkce: false,
  authorizeUrl: ({ creds, redirectUri, state }) => `https://id.twitch.tv/oauth2/authorize?${new URLSearchParams({
    response_type: "code", client_id: creds.clientId, redirect_uri: redirectUri, scope: twitch.scopes.join(" "), state, force_verify: "true",
  })}`,
  exchange: async ({ creds, redirectUri, code }) => parseTokenResponse(await call("https://id.twitch.tv/oauth2/token", form({
    client_id: creds.clientId, client_secret: creds.clientSecret, code, grant_type: "authorization_code", redirect_uri: redirectUri,
  }))),
  refresh: async ({ creds, tokens }) => {
    if (!tokens.refreshToken) throw new ProviderError("unauthorized", "no refresh token");
    // Twitch rotates the refresh token; the new one replaces the old.
    return parseTokenResponse(await call("https://id.twitch.tv/oauth2/token", form({ client_id: creds.clientId, client_secret: creds.clientSecret, grant_type: "refresh_token", refresh_token: tokens.refreshToken })), tokens);
  },
  revoke: async ({ creds, tokens }) => { await call("https://id.twitch.tv/oauth2/revoke", form({ client_id: creds.clientId, token: tokens.accessToken })); },
  snapshot: async ({ creds, accessToken }) => {
    const headers = { Authorization: `Bearer ${accessToken}`, "Client-Id": creds.clientId };
    const user = parseTwitchUser(await call("https://api.twitch.tv/helix/users", { headers }));
    const followers = await call(`https://api.twitch.tv/helix/channels/followers?${new URLSearchParams({ broadcaster_id: user.id, first: "1" })}`, { headers });
    return {
      accountId: user.id,
      username: user.login,
      displayName: user.displayName,
      profileUrl: /^[a-z0-9_]{1,25}$/i.test(user.login) ? `https://www.twitch.tv/${user.login}` : null,
      avatarUrl: user.avatarUrl,
      audience: count((followers as { total?: unknown } | null)?.total),
      audienceHidden: false,
    };
  },
};

/** Twitch asks apps that keep sign-ins to validate each token hourly. */
export async function validateTwitchToken(accessToken: string) {
  await call("https://id.twitch.tv/oauth2/validate", { headers: { Authorization: `OAuth ${accessToken}` } });
}

// ------------------------------------------------------------------ TikTok

export function parseTikTokUser(json: unknown): Snapshot {
  const body = (json ?? {}) as { data?: { user?: Record<string, unknown> }; error?: { code?: unknown } };
  const code = str(body.error?.code);
  if (code && code !== "ok") throw new ProviderError(code === "access_token_invalid" ? "unauthorized" : code === "rate_limit_exceeded" ? "rate_limited" : "bad_response", code);
  const user = body.data?.user;
  if (!user || typeof user.open_id !== "string") throw new ProviderError("no_account", "no user");
  const username = str(user.username);
  return {
    accountId: user.open_id,
    username,
    displayName: str(user.display_name).slice(0, 120),
    profileUrl: /^[A-Za-z0-9._]{1,40}$/.test(username) ? `https://www.tiktok.com/@${username}` : httpsOrNull(user.profile_deep_link),
    avatarUrl: httpsOrNull(user.avatar_url),
    audience: count(user.follower_count),
    audienceHidden: false,
  };
}

function tiktokTokens(json: unknown, previous: Tokens | null = null) {
  const error = str((json as { error?: unknown } | null)?.error);
  if (error) throw new ProviderError(error === "invalid_grant" ? "unauthorized" : "bad_response", error);
  return parseTokenResponse(json, previous);
}

const tiktok: Spec = {
  scopes: ["user.info.basic", "user.info.profile", "user.info.stats"],
  pkce: false,
  authorizeUrl: ({ creds, redirectUri, state }) => `https://www.tiktok.com/v2/auth/authorize/?${new URLSearchParams({
    client_key: creds.clientId, scope: tiktok.scopes.join(","), response_type: "code", redirect_uri: redirectUri, state,
  })}`,
  exchange: async ({ creds, redirectUri, code }) => tiktokTokens(await call("https://open.tiktokapis.com/v2/oauth/token/", form({
    client_key: creds.clientId, client_secret: creds.clientSecret, code, grant_type: "authorization_code", redirect_uri: redirectUri,
  }))),
  refresh: async ({ creds, tokens }) => {
    if (!tokens.refreshToken) throw new ProviderError("unauthorized", "no refresh token");
    return tiktokTokens(await call("https://open.tiktokapis.com/v2/oauth/token/", form({ client_key: creds.clientId, client_secret: creds.clientSecret, grant_type: "refresh_token", refresh_token: tokens.refreshToken })), tokens);
  },
  revoke: async ({ creds, tokens }) => { await call("https://open.tiktokapis.com/v2/oauth/revoke/", form({ client_key: creds.clientId, client_secret: creds.clientSecret, token: tokens.accessToken })); },
  snapshot: async ({ accessToken }) => parseTikTokUser(await call(`https://open.tiktokapis.com/v2/user/info/?fields=${["open_id", "avatar_url", "display_name", "username", "profile_deep_link", "follower_count"].join(",")}`, { headers: { Authorization: `Bearer ${accessToken}` } })),
};

// ------------------------------------------------------------------ Instagram

export const INSTAGRAM_GRAPH_VERSION = "v26.0";

export function parseInstagramMe(json: unknown): Snapshot {
  const me = (json ?? {}) as Record<string, unknown>;
  const id = str(me.user_id) || str(me.id) || (typeof me.user_id === "number" ? String(me.user_id) : "");
  if (!id) throw new ProviderError("no_account", "no user");
  const type = str(me.account_type).toUpperCase();
  if (type && type !== "BUSINESS" && type !== "MEDIA_CREATOR") throw new ProviderError("not_professional", type);
  const username = str(me.username);
  const scoped = str(me.id) || (typeof me.id === "number" ? String(me.id) : "");
  return {
    accountId: id,
    scopedId: scoped && scoped !== id && scoped.length <= 200 ? scoped : null,
    username,
    displayName: str(me.name).slice(0, 120),
    profileUrl: /^[A-Za-z0-9._]{1,30}$/.test(username) ? `https://www.instagram.com/${username}` : null,
    avatarUrl: httpsOrNull(me.profile_picture_url),
    audience: count(me.followers_count),
    audienceHidden: false,
  };
}

/** Instagram's short-lived token response, which some app versions wrap in data[]. */
export function parseInstagramShortToken(json: unknown) {
  const raw = (json ?? {}) as { data?: unknown[] } & Record<string, unknown>;
  const data = (Array.isArray(raw.data) ? raw.data[0] : raw) as Record<string, unknown> | undefined;
  const token = str(data?.access_token);
  if (!token) throw new ProviderError("bad_response", "no access token");
  return { accessToken: token, scopes: Array.isArray(data?.permissions) ? (data.permissions as string[]).join(",") : str(data?.permissions) };
}

const instagram: Spec = {
  scopes: ["instagram_business_basic"],
  pkce: false,
  authorizeUrl: ({ creds, redirectUri, state }) => `https://www.instagram.com/oauth/authorize?${new URLSearchParams({
    client_id: creds.clientId, redirect_uri: redirectUri, response_type: "code", scope: instagram.scopes.join(","), state,
  })}`,
  exchange: async ({ creds, redirectUri, code }) => {
    const short = parseInstagramShortToken(await call("https://api.instagram.com/oauth/access_token", form({
      client_id: creds.clientId, client_secret: creds.clientSecret, grant_type: "authorization_code", redirect_uri: redirectUri, code: code.replace(/#_$/, ""),
    })));
    // Swap the one-hour token for a 60-day one straight away; nothing else keeps the short one.
    const long = await call(`https://graph.instagram.com/access_token?${new URLSearchParams({ grant_type: "ig_exchange_token", client_secret: creds.clientSecret, access_token: short.accessToken })}`);
    return { ...parseTokenResponse(long), refreshToken: null, scopes: short.scopes || instagram.scopes.join(",") };
  },
  refresh: async ({ tokens }) => {
    const next = await call(`https://graph.instagram.com/refresh_access_token?${new URLSearchParams({ grant_type: "ig_refresh_token", access_token: tokens.accessToken })}`);
    return { ...parseTokenResponse(next, tokens), refreshToken: null };
  },
  // Instagram Login has no token revoke call. Disconnecting deletes the token; the member can also remove Setuvara under Instagram's app settings.
  revoke: null,
  snapshot: async ({ accessToken }) => parseInstagramMe(await call(`https://graph.instagram.com/${INSTAGRAM_GRAPH_VERSION}/me?${new URLSearchParams({ fields: "user_id,id,username,name,account_type,profile_picture_url,followers_count", access_token: accessToken })}`)),
};

export const PROVIDERS: Record<SocialProvider, Spec> = { youtube, twitch, tiktok, instagram };

/** Where each provider's app credentials live. */
export const CREDENTIAL_ENV: Record<SocialProvider, [string, string]> = {
  youtube: ["GOOGLE_OAUTH_CLIENT_ID", "GOOGLE_OAUTH_CLIENT_SECRET"],
  twitch: ["TWITCH_CLIENT_ID", "TWITCH_CLIENT_SECRET"],
  tiktok: ["TIKTOK_CLIENT_KEY", "TIKTOK_CLIENT_SECRET"],
  instagram: ["INSTAGRAM_APP_ID", "INSTAGRAM_APP_SECRET"],
};
