import "server-only";

import { createPrivateKey, createSign } from "node:crypto";

import type { GoogleWalletConfig } from "./config";

const issuerScope = "https://www.googleapis.com/auth/wallet_object.issuer";
const oauthTokenUrl = "https://oauth2.googleapis.com/token";
const walletApi = "https://walletobjects.googleapis.com/walletobjects/v1";

export class WalletProviderError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "WalletProviderError";
  }
}

function encode(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

export function signGoogleWalletSaveJwt(
  config: GoogleWalletConfig,
  object: Record<string, unknown>,
  origin: string,
  issuedAt = Math.floor(Date.now() / 1000),
) {
  const header = encode({ alg: "RS256", typ: "JWT" });
  const claims = encode({
    iss: config.serviceAccountEmail,
    aud: "google",
    typ: "savetowallet",
    iat: issuedAt,
    origins: [origin],
    payload: { genericObjects: [object] },
  });
  const signingInput = `${header}.${claims}`;
  const signer = createSign("RSA-SHA256");
  signer.update(signingInput);
  signer.end();
  const signature = signer.sign(createPrivateKey(config.serviceAccountPrivateKey)).toString("base64url");
  return `${signingInput}.${signature}`;
}

async function getGoogleAccessToken(config: GoogleWalletConfig) {
  const now = Math.floor(Date.now() / 1000);
  const header = encode({ alg: "RS256", typ: "JWT" });
  const claims = encode({
    iss: config.serviceAccountEmail,
    scope: issuerScope,
    aud: oauthTokenUrl,
    iat: now,
    exp: now + 3600,
  });
  const signingInput = `${header}.${claims}`;
  const signer = createSign("RSA-SHA256");
  signer.update(signingInput);
  signer.end();
  const assertion = `${signingInput}.${signer.sign(createPrivateKey(config.serviceAccountPrivateKey)).toString("base64url")}`;
  const response = await fetch(oauthTokenUrl, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new WalletProviderError("google_wallet_auth_unavailable");
  const result = await response.json() as { access_token?: unknown };
  if (typeof result.access_token !== "string" || !result.access_token) {
    throw new WalletProviderError("google_wallet_auth_unavailable");
  }
  return result.access_token;
}

async function patchObject(config: GoogleWalletConfig, accessToken: string, object: Record<string, unknown>) {
  const objectId = object.id;
  if (typeof objectId !== "string") throw new WalletProviderError("google_wallet_object_invalid");
  const response = await fetch(`${walletApi}/genericObject/${encodeURIComponent(objectId)}`, {
    method: "PATCH",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(object),
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new WalletProviderError("google_wallet_update_unavailable");
}

export async function upsertGoogleWalletObject(config: GoogleWalletConfig, object: Record<string, unknown>) {
  const accessToken = await getGoogleAccessToken(config);
  const objectId = object.id;
  if (typeof objectId !== "string") throw new WalletProviderError("google_wallet_object_invalid");
  const existing = await fetch(`${walletApi}/genericObject/${encodeURIComponent(objectId)}`, {
    headers: { authorization: `Bearer ${accessToken}` },
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (existing.ok) {
    await patchObject(config, accessToken, object);
    return;
  }
  if (existing.status !== 404) throw new WalletProviderError("google_wallet_provider_unavailable");

  const inserted = await fetch(`${walletApi}/genericObject`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(object),
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (inserted.status === 409) {
    await patchObject(config, accessToken, object);
    return;
  }
  if (!inserted.ok) throw new WalletProviderError("google_wallet_provider_unavailable");
}

export function googleSaveUrl(jwt: string) {
  return `https://pay.google.com/gp/v/save/${jwt}`;
}
