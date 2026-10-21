"use client";

import { useState } from "react";

import { inkButton } from "@/components/creator/studio-ui";

/** The event's link, copied in one press (or shared from the phone's sheet). */
export function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    if (typeof navigator.share === "function" && window.matchMedia("(pointer: coarse)").matches) {
      await navigator.share({ url }).catch(() => null);
      return;
    }
    await navigator.clipboard?.writeText(url).catch(() => null);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }
  return <button className={inkButton} onClick={() => void copy()} type="button">{copied ? "Copied" : "Share link"}</button>;
}
