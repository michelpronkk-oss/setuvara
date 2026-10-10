"use client";

import { useCallback, useEffect, useState } from "react";

import type { ModeSlug } from "@/components/profile/types";
import { endConnectPasses, getConnectPass, type ConnectPassResult } from "@/lib/connections/pass-actions";

type PassState = { mode: ModeSlug; result: ConnectPassResult };

/**
 * Loads the owner's Connection Pass for one Mode only while Connect in person is
 * chosen. Results are kept per Mode, so rerenders never request another pass.
 */
export function useConnectPass(mode: ModeSlug, active: boolean) {
  const [passes, setPasses] = useState<Partial<Record<ModeSlug, PassState>>>({});
  const current = passes[mode];

  useEffect(() => {
    if (!active || current) return;
    let cancelled = false;
    void getConnectPass(mode)
      .catch((): ConnectPassResult => ({ ok: false, message: "Connect in person isn’t available right now." }))
      .then((result) => { if (!cancelled) setPasses((all) => ({ ...all, [mode]: { mode, result } })); });
    return () => { cancelled = true; };
  }, [active, current, mode]);

  const end = useCallback(async () => {
    await endConnectPasses(mode).catch(() => null);
    setPasses((all) => ({ ...all, [mode]: undefined }));
  }, [mode]);

  return { pass: active ? current?.result ?? null : null, end };
}

export function passExpiryLabel(expiresAt: string) {
  return new Intl.DateTimeFormat(undefined, { weekday: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(expiresAt));
}
