"use client";

export type ShareMetricAction = "copy" | "native_share" | "qr_open";

export function recordProfileShare(mode: "personal" | "event" | "business", action: ShareMetricAction) {
  if (!globalThis.crypto?.randomUUID) return;
  void fetch("/api/analytics/share", {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ mode, action, requestId: crypto.randomUUID() }),
    keepalive: true,
  }).catch(() => undefined);
}
