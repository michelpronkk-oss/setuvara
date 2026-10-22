"use client";

import { useEffect, useMemo, useState } from "react";

import { isModeHandleSlug } from "@/lib/handles/mode-handle";
import { createClient } from "@/lib/supabase/client";
import type { EditorApi } from "./editor-types";
import { Toggle, modeMeta } from "./editor-ui";

const errorCopy: Record<string, string> = {
  not_published: "Publish your Setuvara first.",
  needs_public_handle: "Turn on the public link first.",
  mode_disabled: "Turn this Mode on first.",
};

/**
 * "Show in the gallery": lists this Mode's page at setuvara.com/gallery. Off by default. Only pages
 * with a public address qualify (Personal on a published Setuvara, Business and Creator with a live
 * public link); the database enforces it and drops a page from the gallery the moment that stops.
 */
export function GalleryRow({ api }: { api: EditorApi }) {
  const { slug, profile, mode } = api;
  const supabase = useMemo(() => createClient(), []);
  const [listed, setListed] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const name = modeMeta[slug].name;
  const handle = isModeHandleSlug(slug) ? api.modeHandles[slug] ?? null : null;
  const blocker = !profile.is_published ? "not_published" : !mode.is_enabled ? "mode_disabled" : slug !== "personal" && !handle?.is_live ? "needs_public_handle" : null;

  useEffect(() => {
    let live = true;
    void supabase.rpc("my_gallery_listings").then(({ data }) => {
      if (live) setListed(Array.isArray(data) && (data as unknown[]).includes(slug));
    });
    return () => { live = false; };
  }, [slug, supabase]);

  async function change(next: boolean) {
    setBusy(true);
    setError(null);
    const { data, error: saveError } = await supabase.rpc("set_gallery_listing", { p_mode: slug, p_listed: next });
    setBusy(false);
    if (saveError) { setError(errorCopy[saveError.message] ?? "That didn’t save. Try again."); return; }
    setListed(data === true);
    api.toast(data === true ? `${name} Mode is in the gallery.` : `${name} Mode is out of the gallery.`);
  }

  const on = Boolean(listed) && !blocker;
  const description = error
    ?? (blocker && !listed ? errorCopy[blocker]
      : listed && blocker ? `Listed, but hidden until you ${blocker === "not_published" ? "publish again" : blocker === "mode_disabled" ? `turn ${name} Mode on` : "turn the public link on"}.`
      : on ? "Your page is in the Setuvara gallery for anyone to find."
      : "Off. Put your page in the Setuvara gallery, next to other members’ pages.");

  return (
    <div className="flex items-center justify-between gap-4 py-4" data-gallery-row={on ? "on" : "off"}>
      <div className="min-w-0">
        <p className="text-[15px] font-semibold">Show in the gallery</p>
        <p className={`mt-0.5 text-[13px] leading-5 ${error ? "text-[#c2372e]" : "text-black/55"}`}>{description}</p>
      </div>
      <Toggle disabled={busy || listed === null || (!listed && Boolean(blocker))} label="Show in the gallery" on={Boolean(listed)} onChange={(next) => void change(next)} />
    </div>
  );
}
