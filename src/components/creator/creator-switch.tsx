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
    <div className="mx-3.5 mt-3 flex flex-wrap items-center justify-between gap-3 rounded-[18px] bg-[#0D0D0D] px-4 py-3 text-[#F5F4EF] md:mx-8 md:px-5" role="status">
      <p className="text-[15px]"><span className="font-semibold">Creator is off.</span> <span className="text-white/70">{published ? "Set it up here, then turn it on to open your page." : "Publish your identity and turn Creator on to open your page."}</span></p>
      <div className="flex items-center gap-3">
        {error && <span className="text-sm text-[#FF9A92]">{error}</span>}
        <button className="inline-flex min-h-10 items-center rounded-full bg-[#F5F4EF] px-4 text-sm font-semibold text-[#0D0D0D] disabled:opacity-50" disabled={busy} onClick={() => void set(true)} type="button">{busy ? "Turning on…" : "Turn Creator on"}</button>
      </div>
    </div>
  );
}
