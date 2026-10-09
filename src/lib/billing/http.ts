import "server-only";

import { z } from "zod";
import { getSetuvaraOrigin } from "./config";

export function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export function isSameOriginJsonRequest(request: Request): boolean {
  const origin = request.headers.get("origin");
  const contentType = request.headers.get("content-type")?.split(";")[0]?.trim();
  if (!origin || contentType !== "application/json") return false;
  try {
    return new URL(origin).origin === new URL(request.url).origin &&
      new URL(origin).origin === getSetuvaraOrigin();
  } catch {
    return false;
  }
}

export async function readJson<T extends z.ZodType>(request: Request, schema: T) {
  if (!isSameOriginJsonRequest(request)) return { ok: false as const };
  try {
    const payload: unknown = await request.json();
    const parsed = schema.safeParse(payload);
    return parsed.success ? { ok: true as const, data: parsed.data } : { ok: false as const };
  } catch {
    return { ok: false as const };
  }
}

export function safeProviderUrl(value: unknown, provider: "checkout" | "portal"): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    const allowed = provider === "checkout"
      ? ["checkout.dodopayments.com", "test.checkout.dodopayments.com"]
      : ["customer.dodopayments.com", "test.customer.dodopayments.com"];
    if (url.protocol !== "https:" || !allowed.includes(url.hostname) || url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}
