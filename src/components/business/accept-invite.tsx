"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { acceptTeamInvite } from "@/app/app/identity/team/actions";
import { inkButton } from "@/components/creator/studio-ui";

/** One press to join; the workspace opens straight after. */
export function AcceptInvite({ token }: { token: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button className={`${inkButton} self-start`} disabled={pending} onClick={() => { setError(null); start(async () => { const result = await acceptTeamInvite(token); if (!result.ok) { setError(result.error); return; } router.push(result.href); }); }} type="button">
        {pending ? "Joining…" : "Accept and open the leads"}
      </button>
      {error && <p className="text-[14px] font-semibold text-[#B42318]" role="alert">{error}</p>}
    </>
  );
}
