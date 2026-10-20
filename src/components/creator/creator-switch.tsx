"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { createClient } from "@/lib/supabase/client";

/** Turns Creator Mode on or off. Nothing is deleted when it is off; the page just doesn't open. */
export function useCreatorSwitch(modeId: string, profileId: string) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function set(next: boolean) {
    setBusy(true);
    setError(null);
    const { error: updateError } = await createClient().from("profile_modes").update({ is_enabled: next }).eq("id", modeId).eq("profile_id", profileId);
    setBusy(false);
    if (updateError) { setError("That didn’t save. Try again."); return; }
    router.refresh();
  }
  return { busy, error, set };
}

export function CreatorOffBanner({ modeId, profileId, published }: { modeId: string; profileId: string; published: boolean }) {
  const { busy, error, set } = useCreatorSwitch(modeId, profileId);
  return (
    <div className="mx-auto w-full max-w-[1320px] px-4 pt-4 sm:px-6 lg:px-10 lg:pt-6 xl:px-11" role="status">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[20px] bg-white py-3 pl-4 pr-3 shadow-[inset_0_0_0_1px_rgba(13,13,13,.08)] md:pl-5">
        <p className="flex min-w-0 items-center gap-3 text-[14px]">
          <span aria-hidden="true" className="relative grid size-8 shrink-0 place-items-center rounded-full bg-[#E8A6FF]/25"><span className="size-2 rounded-full bg-[#E8A6FF] opacity-60" /></span>
          <span><span className="font-semibold">Creator Mode is off.</span> <span className="text-black/60">{published ? "Set it up here, then turn it on to open your page." : "Publish your identity and turn Creator on to open your page."}</span></span>
        </p>
        <div className="flex items-center gap-3">
          {error && <span className="text-sm text-[#B42318]">{error}</span>}
          <button className="inline-flex min-h-10 items-center rounded-full bg-[#0D0D0D] px-4 text-sm font-semibold text-[#F5F4EF] transition hover:bg-black/85 disabled:opacity-50" disabled={busy} onClick={() => void set(true)} type="button">{busy ? "Turning on…" : "Turn Creator on"}</button>
        </div>
      </div>
    </div>
  );
}
