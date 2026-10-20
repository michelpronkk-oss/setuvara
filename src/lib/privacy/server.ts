import "server-only";

import { createHmac, randomBytes } from "node:crypto";

import { createActionsServiceClient } from "@/lib/actions/server";
import type { SocialProvider } from "@/lib/social/model";
import { CONFIRMATION_ALPHABET, type PrivacyKind, type PrivacyStatus } from "./model";
import type { SignedRequest } from "./signed-request";

/**
 * Privacy requests. Callbacks from Meta and members' own requests both land in privacy_requests,
 * so every one has a code and an honest status. Nothing here logs a platform id, token or payload.
 */

export type PrivacyRequestRow = { id: string; confirmation_code: string; status: PrivacyStatus; kind: PrivacyKind };

/** The secrets Meta may sign with: the Instagram app secret, and the Meta app secret if set. */
export function metaCallbackSecrets() {
  return [process.env.INSTAGRAM_APP_SECRET?.trim(), process.env.META_APP_SECRET?.trim()].filter((value): value is string => Boolean(value));
}

/** Unbiased random code from the shared alphabet (rejection sampling). */
export function newConfirmationCode(length = 20) {
  const limit = 256 - (256 % CONFIRMATION_ALPHABET.length);
  let code = "";
  while (code.length < length) {
    for (const byte of randomBytes(length * 2)) {
      if (byte < limit && code.length < length) code += CONFIRMATION_ALPHABET[byte % CONFIRMATION_ALPHABET.length];
    }
  }
  return code;
}

/** HMAC of the platform user id. The raw id is never stored with a request. */
export function subjectHash(provider: SocialProvider, userId: string) {
  const key = process.env.SOCIAL_TOKEN_KEY?.trim() || metaCallbackSecrets()[0];
  if (!key) throw new Error("privacy_hash_key_missing");
  return createHmac("sha256", key).update(`privacy-subject:${provider}:${userId}`).digest("hex");
}

const COLUMNS = "id, confirmation_code, status, kind";

async function findOrCreateSignal(kind: PrivacyKind, provider: SocialProvider, hash: string, issuedAt: Date): Promise<PrivacyRequestRow> {
  const db = createActionsServiceClient();
  const match = () => db.from("privacy_requests").select(COLUMNS).eq("kind", kind).eq("source", "meta_callback").eq("subject_hash", hash).eq("signal_issued_at", issuedAt.toISOString()).maybeSingle();
  const { data: existing } = await match();
  if (existing) return existing as PrivacyRequestRow;
  const { data, error } = await db.from("privacy_requests")
    .insert({ kind, source: "meta_callback", provider, subject_hash: hash, signal_issued_at: issuedAt.toISOString(), confirmation_code: newConfirmationCode() })
    .select(COLUMNS).single();
  if (data) return data as PrivacyRequestRow;
  // Two deliveries of one signal at once: the other insert won.
  if (error?.code === "23505") {
    const { data: raced } = await match();
    if (raced) return raced as PrivacyRequestRow;
  }
  throw new Error("privacy_request_unavailable");
}

export type SignalResult = { request: PrivacyRequestRow; finished: boolean };

/**
 * Handles a verified deauthorize or data deletion signal for one platform user. Deletes only the
 * connected accounts that match that user id and were connected before the signal was issued, so
 * a replayed old signal can't remove a later reconnection, and no other member is touched.
 * Retries of the same signal return the same request; a failed one is tried again.
 */
export async function handlePlatformSignal(kind: Exclude<PrivacyKind, "account_deletion">, provider: SocialProvider, signal: SignedRequest): Promise<SignalResult> {
  const db = createActionsServiceClient();
  const request = await findOrCreateSignal(kind, provider, subjectHash(provider, signal.userId), signal.issuedAt);
  if (request.status === "completed" || request.status === "no_data") return { request, finished: true };

  const { data: attempt } = await db.from("privacy_requests").select("attempts").eq("id", request.id).single();
  await db.from("privacy_requests").update({ status: "processing", attempts: (attempt?.attempts ?? 0) + 1, error_code: null }).eq("id", request.id);

  const fail = async (code: string): Promise<SignalResult> => {
    await db.from("privacy_requests").update({ status: "failed", error_code: code }).eq("id", request.id);
    return { request: { ...request, status: "failed" }, finished: false };
  };

  // user_id is validated as [A-Za-z0-9_-], so it is safe inside the or() filter.
  const { data: accounts, error: findError } = await db.from("social_accounts")
    .select("id, profile_id")
    .eq("provider", provider)
    .or(`provider_account_id.eq.${signal.userId},provider_scoped_id.eq.${signal.userId}`)
    .lte("connected_at", signal.issuedAt.toISOString());
  if (findError) return fail("lookup_failed");

  let removed = 0;
  for (const account of accounts ?? []) {
    // Tokens go with the account (social_account_secrets cascades). Instagram Login has no revoke call.
    const { data: gone, error } = await db.from("social_accounts").delete().eq("id", account.id).eq("provider", provider).lte("connected_at", signal.issuedAt.toISOString()).select("id");
    if (error) return fail("delete_failed");
    removed += gone?.length ?? 0;
  }

  const owners = [...new Set((accounts ?? []).map((account) => account.profile_id as string))];
  const status: PrivacyStatus = removed > 0 ? "completed" : "no_data";
  const { error: doneError } = await db.from("privacy_requests")
    .update({ status, accounts_removed: removed, completed_at: new Date().toISOString(), error_code: null, ...(owners.length === 1 ? { profile_id: owners[0] } : {}) })
    .eq("id", request.id);
  if (doneError) return fail("record_failed");
  return { request: { ...request, status }, finished: true };
}

export async function requestStatusByCode(code: string) {
  const db = createActionsServiceClient();
  const { data } = await db.from("privacy_requests").select("kind, status, created_at, completed_at").eq("confirmation_code", code).maybeSingle();
  return data as { kind: PrivacyKind; status: PrivacyStatus; created_at: string; completed_at: string | null } | null;
}

/** One open account deletion request per member; asking again returns the open one. */
export async function requestAccountDeletion(userId: string): Promise<{ request: PrivacyRequestRow; created: boolean }> {
  const db = createActionsServiceClient();
  const open = () => db.from("privacy_requests").select(COLUMNS).eq("profile_id", userId).eq("kind", "account_deletion").in("status", ["received", "processing"]).maybeSingle();
  const { data: existing } = await open();
  if (existing) return { request: existing as PrivacyRequestRow, created: false };
  const { data, error } = await db.from("privacy_requests")
    .insert({ kind: "account_deletion", source: "member", profile_id: userId, confirmation_code: newConfirmationCode() })
    .select(COLUMNS).single();
  if (data) return { request: data as PrivacyRequestRow, created: true };
  if (error?.code === "23505") {
    const { data: raced } = await open();
    if (raced) return { request: raced as PrivacyRequestRow, created: false };
  }
  throw new Error("privacy_request_unavailable");
}

/** A member withdraws their own open account deletion request. */
export async function cancelAccountDeletion(userId: string) {
  const db = createActionsServiceClient();
  const { data, error } = await db.from("privacy_requests").update({ status: "cancelled", completed_at: new Date().toISOString() })
    .eq("profile_id", userId).eq("kind", "account_deletion").eq("status", "received").select("id");
  if (error) throw new Error("privacy_request_unavailable");
  return (data?.length ?? 0) > 0;
}
