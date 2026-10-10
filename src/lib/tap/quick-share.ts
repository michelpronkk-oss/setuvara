import "server-only";

import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { z } from "zod";

import { getTapOrigin } from "@/lib/tap/server";

const hex32 = /^[a-f0-9]{64}$/;
const keyPattern = /^[A-Za-z0-9_-]{43}$/;

const locatorSchema = z.object({
  nonce: z.string().regex(hex32),
  token_hash: z.string().regex(hex32),
});

export type QuickShareLocator = z.infer<typeof locatorSchema>;

/** A server-only key lets the owner redisplay a stable URL without storing its bearer token. */
function getQuickShareKey() {
  const encoded = process.env.QUICK_SHARE_TOKEN_KEY?.trim();
  if (!encoded || !keyPattern.test(encoded)) throw new Error("Quick Share is unavailable");
  const key = Buffer.from(encoded, "base64url");
  if (key.length !== 32 || key.toString("base64url") !== encoded) {
    throw new Error("Quick Share is unavailable");
  }
  return key;
}

export function parseQuickShareLocator(value: unknown): QuickShareLocator | null {
  const parsed = locatorSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function deriveToken(profileId: string, nonce: string) {
  if (!z.string().uuid().safeParse(profileId).success || !hex32.test(nonce)) {
    throw new Error("Quick Share is unavailable");
  }
  return createHmac("sha256", getQuickShareKey())
    .update("setuvara-quick-share-v1\0", "utf8")
    .update(profileId.toLowerCase(), "utf8")
    .update(Buffer.from(nonce, "hex"))
    .digest("base64url");
}

function tokenHash(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function createQuickShareCandidate(profileId: string) {
  const nonce = randomBytes(32).toString("hex");
  const token = deriveToken(profileId, nonce);
  return { nonce: `\\x${nonce}`, tokenHash: `\\x${tokenHash(token)}` };
}

export function quickShareUrl(profileId: string, locator: QuickShareLocator, origin = getTapOrigin()) {
  const token = deriveToken(profileId, locator.nonce);
  const actualHash = Buffer.from(tokenHash(token), "hex");
  const expectedHash = Buffer.from(locator.token_hash, "hex");
  if (!timingSafeEqual(actualHash, expectedHash)) throw new Error("Quick Share is unavailable");
  return `${origin}/q/${token}`;
}
