import "server-only";

import {
  deriveAppleAuthenticationToken,
  isAppleAuthenticationTokenValid,
  validApplePushToken,
} from "./model";
import type { AppleWalletConfig } from "./config";
import type { WalletPassRecord } from "./server";

export function readApplePassToken(request: Request) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("ApplePass ")) return null;
  const token = authorization.slice("ApplePass ".length);
  return /^[A-Za-z0-9_-]{32,128}$/.test(token) ? token : null;
}

export function canAccessApplePass(request: Request, record: WalletPassRecord, config: AppleWalletConfig) {
  const candidate = readApplePassToken(request);
  if (!candidate) return false;
  const expected = deriveAppleAuthenticationToken(record.profile_id, record.apple_serial_number, config.passAuthSecret);
  return isAppleAuthenticationTokenValid(expected, candidate);
}

export function appleServiceError(status: number) {
  return Response.json({}, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "WWW-Authenticate": "ApplePass",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function readApplePushToken(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > 2_048) return null;
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return null;
  if (!request.body) return null;
  try {
    const reader = request.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > 2_048) {
          await reader.cancel();
          return null;
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    const body: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (!body || typeof body !== "object" || Array.isArray(body)) return null;
    const pushToken = (body as Record<string, unknown>).pushToken;
    return typeof pushToken === "string" && validApplePushToken(pushToken)
      ? pushToken
      : null;
  } catch {
    return null;
  }
}
