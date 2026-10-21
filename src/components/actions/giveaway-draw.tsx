"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { inkButton, lineButton, Mono } from "@/components/creator/studio-ui";
import type { Submission } from "@/lib/actions/model";
import { relativeTime } from "@/lib/creator/studio";
import { createClient } from "@/lib/supabase/client";

type Draw = {
  id: string; draw_number: number; winners_requested: number; eligible_count: number; eligible_digest: string; seed: string;
  winner_submission_ids: string[]; reason: string | null; announced_at: string | null; announced_names: string[] | null; created_at: string;
};
const DRAW_COLUMNS = "id, draw_number, winners_requested, eligible_count, eligible_digest, seed, winner_submission_ids, reason, announced_at, announced_names, created_at";
const ERRORS: Record<string, string> = {
  giveaway_not_ended: "Draw once the giveaway has ended.",
  no_eligible_entries: "There are no confirmed entries left to draw from.",
  reason_required: "Say why you're drawing again.",
  invalid_winners: "Pick between 1 and 10 winners.",
};

const fetchDraws = (actionId: string) => createClient().from("action_giveaway_draws").select(DRAW_COLUMNS).eq("action_id", actionId).order("draw_number", { ascending: false })
  .then(({ data }) => (data ?? []) as Draw[]);

/**
 * The winner picker for an ended giveaway. Setuvara draws on the server among confirmed entries,
 * with a secure random seed, and keeps every draw: who could win, the seed, and who did.
 */
export function GiveawayDraw({ actionId, submissions }: { actionId: string; submissions: Submission[] }) {
  const router = useRouter();
  const [draws, setDraws] = useState<Draw[] | null>(null);
  const [winners, setWinners] = useState(1);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audit, setAudit] = useState<string | null>(null);
  const byId = new Map(submissions.map((item) => [item.id, item]));

  useEffect(() => {
    let live = true;
    void fetchDraws(actionId).then((rows) => { if (live) setDraws(rows); });
    return () => { live = false; };
  }, [actionId]);
  const load = async () => setDraws(await fetchDraws(actionId));

  async function draw() {
    const again = Boolean(draws?.length);
    if (!window.confirm(again ? "Draw again? Earlier winners are left out, and this draw is kept with your reason." : `Draw ${winners} winner${winners === 1 ? "" : "s"} now? The result is final and kept on record.`)) return;
    setBusy(true); setError(null);
    const { error: drawError } = await createClient().rpc("draw_giveaway_winners", { p_action_id: actionId, p_winners: winners, p_reason: again ? reason : null });
    setBusy(false);
    if (drawError) { setError(Object.entries(ERRORS).find(([key]) => drawError.message?.includes(key))?.[1] ?? "That didn't go through. Try again."); return; }
    setReason("");
    await load();
  }
  async function announce(target: Draw, on: boolean) {
    setBusy(true); setError(null);
    const { error: announceError } = await createClient().rpc("announce_giveaway_draw", { p_draw_id: target.id, p_announce: on });
    setBusy(false);
    if (announceError) { setError("That didn't go through. Try again."); return; }
    await load();
    router.refresh();
  }

  if (!draws) return null;
  const latest = draws[0];
  const eligible = submissions.filter((item) => item.status === "entered" && item.verified_at && !draws.some((d) => d.winner_submission_ids.includes(item.id))).length;
  return (
    <section aria-labelledby="draw-title" className="rounded-[26px] bg-[#0D0D0D] p-5 text-[#F5F4EF] md:p-7" data-giveaway-draw={latest ? "drawn" : "ready"}>
      <Mono className="text-[#E8A6FF]">Winner draw</Mono>
      <h3 className="mt-2 font-display text-[30px] font-bold leading-[1] tracking-[-0.05em]" id="draw-title">{latest ? (latest.winner_submission_ids.length === 1 ? "Your winner" : "Your winners") : "Draw a winner"}</h3>

      {latest && (
        <ol className="mt-5 flex flex-col gap-2">
          {latest.winner_submission_ids.map((id, index) => {
            const entry = byId.get(id);
            return (
              <li className="flex items-center gap-3 rounded-[18px] bg-white/[0.06] px-4 py-3" data-winner key={id}>
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#E8A6FF] font-display text-[15px] font-bold text-[#0D0D0D]">{index + 1}</span>
                <span className="min-w-0 flex-1"><span className="block truncate text-[16px] font-semibold">{entry?.name || "Entrant"}</span><span className="block truncate text-[13px] text-[#F5F4EF]/60">{entry?.email ?? "Contact details removed"}</span></span>
                {entry?.email && <a className="shrink-0 rounded-full px-3 py-2 text-[13px] font-semibold text-[#E8A6FF] hover:bg-white/[0.06]" href={`mailto:${entry.email}`}>Email</a>}
              </li>
            );
          })}
        </ol>
      )}

      {latest && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button className={latest.announced_at ? "inline-flex min-h-11 items-center rounded-full px-[18px] text-[15px] font-semibold shadow-[inset_0_0_0_1px_rgba(245,244,239,.25)] hover:bg-white/[0.06]" : "inline-flex min-h-11 items-center rounded-full bg-[#E8A6FF] px-[18px] text-[15px] font-semibold text-[#0D0D0D] hover:brightness-95"} disabled={busy} onClick={() => void announce(latest, !latest.announced_at)} type="button">
            {latest.announced_at ? "Take announcement down" : "Announce on the page"}
          </button>
          {latest.announced_at && <span className="text-[13px] text-[#F5F4EF]/60">Showing {latest.announced_names?.join(", ")} since {relativeTime(latest.announced_at)}</span>}
        </div>
      )}

      <div className="mt-6 border-t border-white/10 pt-5">
        {latest ? <p className="text-[14px] text-[#F5F4EF]/70">Winner didn&apos;t reply, or broke the rules? Disqualify them in the list below, then draw again. {eligible} confirmed {eligible === 1 ? "entry" : "entries"} can still win.</p>
          : <p className="text-[14px] text-[#F5F4EF]/70">{eligible} confirmed {eligible === 1 ? "entry" : "entries"} can win. Unconfirmed and disqualified entries can&apos;t.</p>}
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          {latest ? (
            <input aria-label="Why draw again" className="min-h-11 flex-1 rounded-full bg-white/[0.08] px-4 text-[15px] text-[#F5F4EF] outline-none placeholder:text-[#F5F4EF]/40 focus:shadow-[inset_0_0_0_2px_#E8A6FF]" maxLength={200} onChange={(change) => setReason(change.target.value)} placeholder="Why draw again" value={reason} />
          ) : (
            <label className="flex items-center gap-2 text-[14px]">Winners
              <select aria-label="Number of winners" className="min-h-11 rounded-full bg-white/[0.08] px-4 text-[15px] text-[#F5F4EF] outline-none" onChange={(change) => setWinners(Number(change.target.value))} value={winners}>
                {Array.from({ length: 10 }, (_, index) => index + 1).map((count) => <option className="text-[#0D0D0D]" key={count} value={count}>{count}</option>)}
              </select>
            </label>
          )}
          <button className={latest ? lineButton : `${inkButton} bg-[#F5F4EF] text-[#0D0D0D] hover:bg-white`} disabled={busy || eligible === 0 || (Boolean(latest) && !reason.trim())} onClick={() => void draw()} type="button">{busy ? "Drawing…" : latest ? "Draw again" : "Draw"}</button>
        </div>
        {error && <p className="mt-3 text-[14px] font-semibold text-[#FF8A80]" role="alert">{error}</p>}
      </div>

      {draws.length > 0 && (
        <details className="mt-6 border-t border-white/10 pt-4" onToggle={(event) => setAudit((event.currentTarget as HTMLDetailsElement).open ? "open" : null)} open={audit === "open"}>
          <summary className="cursor-pointer text-[14px] font-semibold text-[#F5F4EF]/80">Draw record</summary>
          <ol className="mt-3 flex flex-col gap-3 text-[13px] text-[#F5F4EF]/70">
            {draws.map((item) => (
              <li className="rounded-[16px] bg-white/[0.04] p-3.5" data-draw-record key={item.id}>
                <p className="font-semibold text-[#F5F4EF]">Draw {item.draw_number} · {new Date(item.created_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}{item.reason ? ` · ${item.reason}` : ""}</p>
                <p className="mt-1">{item.eligible_count} eligible · {item.winners_requested} drawn</p>
                <p className="mt-1 break-all font-mono text-[11.5px]">seed {item.seed}</p>
                <p className="break-all font-mono text-[11.5px]">eligible list sha256 {item.eligible_digest}</p>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-[12.5px] leading-[1.5] text-[#F5F4EF]/50">Each eligible entry is ranked by sha256(seed:entry id); the lowest ranks win. The seed is random and only exists once the draw is saved, so anyone with this record and the entry list can check it.</p>
        </details>
      )}
    </section>
  );
}
