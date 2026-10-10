import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";

import { isSameOriginJsonRequest } from "@/lib/billing/http";
import { getSetuvaraOrigin } from "@/lib/billing/config";
import { createClient } from "@/lib/supabase/server";

export const tapTokenPattern = /^[A-Za-z0-9_-]{43}$/;
export const tapModes = ["personal", "event", "business"] as const;
export const tapIntents = ["view_profile", "connect_in_person"] as const;
export const tapDeviceKinds = ["card", "ring", "sticker", "badge", "other"] as const;
export const tapDeviceStatuses = ["unclaimed", "active", "disabled", "lost", "retired"] as const;

export const tapModeSchema = z.enum(tapModes);
export const tapIntentSchema = z.enum(tapIntents);
export const tapDeviceKindSchema = z.enum(tapDeviceKinds);
export const tapDeviceStatusSchema = z.enum(tapDeviceStatuses);

export type TapMode = (typeof tapModes)[number];
export type TapIntent = (typeof tapIntents)[number];
export type TapDeviceKind = (typeof tapDeviceKinds)[number];
export type TapDeviceStatus = (typeof tapDeviceStatuses)[number];

export function tapJson(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function readTapJson<T extends z.ZodType>(request: Request, schema: T) {
  try {
    if (!isSameOriginJsonRequest(request)) return { ok: false as const };
  } catch {
    return { ok: false as const };
  }
  const length = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(length) && length > 8_192) return { ok: false as const };
  try {
    if (!request.body) return { ok: false as const };
    const reader = request.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > 8_192) {
          await reader.cancel();
          return { ok: false as const };
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
    const payload: unknown = JSON.parse(new TextDecoder().decode(bytes));
    const parsed = schema.safeParse(payload);
    return parsed.success ? { ok: true as const, data: parsed.data } : { ok: false as const };
  } catch {
    return { ok: false as const };
  }
}

export async function getTapOwner() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getClaims();
    const profileId = data?.claims?.sub;
    return error || typeof profileId !== "string" || !profileId
      ? null
      : { supabase, profileId };
  } catch {
    return null;
  }
}

/** A 256-bit URL token; only its SHA-256 digest is sent to the database. */
export function createTapToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: sha256Bytea(token) };
}

export function sha256Bytea(value: string) {
  return `\\x${createHash("sha256").update(value, "utf8").digest("hex")}`;
}

/** Fixed Setuvara/local origins only; request Host headers never shape Tap links. */
export function getTapOrigin() {
  return getSetuvaraOrigin();
}

export function createTapUrl(token: string, origin = getTapOrigin()) {
  return `${origin}/t/${token}`;
}

export function parseTapDeviceList(value: unknown) {
  const raw = Array.isArray(value) ? value : null;
  if (!raw) return null;
  const devices = raw.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;
    const row = item as Record<string, unknown>;
    const id = z.string().uuid().safeParse(row.id ?? row.device_id);
    const label = z.string().max(60).safeParse(row.label);
    const kind = tapDeviceKindSchema.safeParse(row.kind);
    const status = tapDeviceStatusSchema.safeParse(row.status);
    if (!id.success || !label.success || !kind.success || !status.success) return null;
    const result: Record<string, unknown> = {
      id: id.data,
      label: label.data,
      kind: kind.data,
      status: status.data,
    };
    for (const [key, aliases] of Object.entries({
      createdAt: ["created_at", "createdAt"],
      lastTappedAt: ["last_tapped_at", "lastTappedAt"],
      claimedAt: ["claimed_at", "claimedAt"],
    })) {
      const candidate = aliases.map((alias) => row[alias]).find((entry) => entry !== undefined);
      if (candidate === null || typeof candidate === "string") result[key] = candidate;
    }
    return result;
  });
  return devices.some((device) => device === null) ? null : devices;
}

export function parseEquippedState(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const mode = tapModeSchema.safeParse(row.mode ?? row.mode_slug);
  const intent = tapIntentSchema.safeParse(row.intent);
  if (!mode.success || !intent.success) return null;
  return { mode: mode.data, intent: intent.data };
}

export function parseClaimResult(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const id = z.string().uuid().safeParse(row.device_id ?? row.id);
  const status = tapDeviceStatusSchema.safeParse(row.status);
  if (!id.success || !status.success || status.data !== "active") return null;
  const result: Record<string, unknown> = { claimed: true, deviceId: id.data };
  const label = z.string().max(60).safeParse(row.label);
  if (label.success) result.label = label.data;
  const kind = tapDeviceKindSchema.safeParse(row.kind);
  if (kind.success) result.kind = kind.data;
  return result;
}
