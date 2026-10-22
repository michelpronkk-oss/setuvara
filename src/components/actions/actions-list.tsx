"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { ACTION_KIND_SHORT, ACTION_STATUS_LABEL, actionWindow, type ProfileAction } from "@/lib/actions/model";
import { createClient } from "@/lib/supabase/client";
import { shortDate } from "./action-card";
import { KindTile } from "./kind-picker";

export type ActionRow = ProfileAction & { responses: number; fresh: number };

const STATUS_TONE: Record<ProfileAction["status"], string> = {
  published: "bg-[#C7FF4A] text-[#0D0D0D]",
  draft: "bg-[#E6E4DC] text-[#0D0D0D]",
  closed: "bg-transparent text-black/60 shadow-[inset_0_0_0_1px_rgba(13,13,13,.2)]",
  archived: "bg-transparent text-black/45 shadow-[inset_0_0_0_1px_rgba(13,13,13,.12)]",
};

/** Actions in page order. Order is the order visitors see; archived ones stay out of the way. */
export function ActionsList({ rows, profileId, base }: { rows: ActionRow[]; profileId: string; base: string }) {
  const router = useRouter();
  const [showArchived, setShowArchived] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const active = rows.filter((row) => row.status !== "archived");
  const archived = rows.filter((row) => row.status === "archived");
  const shown = showArchived ? rows : active;

  async function move(row: ActionRow, by: -1 | 1) {
    const order = [...active];
    const at = order.findIndex((item) => item.id === row.id);
    const to = at + by;
    if (to < 0 || to >= order.length) return;
    [order[at], order[to]] = [order[to], order[at]];
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const results = await Promise.all(order.map((item, index) => item.sort_order === index ? null : supabase.from("profile_actions").update({ sort_order: index }).eq("id", item.id).eq("profile_id", profileId)));
    setBusy(false);
    if (results.some((result) => result?.error)) setError("The order didn't save. Try again.");
    router.refresh();
  }

  return (
    <div>
      <ul className="divide-y divide-black/[0.07]">
        {shown.map((row) => {
          const index = active.indexOf(row);
          const when = actionWindow(row);
          const timing = row.kind === "giveaway" && row.ends_at ? (when === "ended" ? `ended ${shortDate(row.ends_at)}` : `ends ${shortDate(row.ends_at)}`) : row.ends_at && row.status === "published" ? `open until ${shortDate(row.ends_at)}` : null;
          return (
            <li className="flex items-center gap-3 py-3 md:gap-4" data-action-row={row.kind} key={row.id}>
              {row.status !== "archived" && (
                <span className="flex flex-col">
                  <button aria-label={`Move ${row.title} up`} className="grid h-5 w-8 place-items-center rounded text-black/45 hover:text-black disabled:opacity-25" disabled={busy || index <= 0} onClick={() => void move(row, -1)} type="button">▲</button>
                  <button aria-label={`Move ${row.title} down`} className="grid h-5 w-8 place-items-center rounded text-black/45 hover:text-black disabled:opacity-25" disabled={busy || index === active.length - 1} onClick={() => void move(row, 1)} type="button">▼</button>
                </span>
              )}
              <Link className="flex min-w-0 flex-1 items-center gap-3.5 rounded-[16px] py-1 focus-visible:outline-2 md:gap-4" href={`${base}/${row.id}`}>
                <KindTile kind={row.kind} size={44} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[16px] font-semibold">{row.title}</span>
                  <span className="block truncate text-[14px] text-black/60">{[ACTION_KIND_SHORT[row.kind], timing].filter(Boolean).join(" · ")}</span>
                </span>
                <span className="hidden text-right sm:block">
                  <span className="block font-display text-[22px] font-bold leading-none tracking-[-0.04em] tabular-nums">{row.responses}</span>
                  <span className="block text-[12px] text-black/55">{row.kind === "giveaway" ? "entries" : row.kind === "newsletter" ? "subscribers" : "responses"}</span>
                </span>
                <span className="flex w-[92px] shrink-0 flex-col items-end gap-1.5">
                  <span className={`rounded-[5px] px-2 py-[3px] font-label text-[10px] tracking-[0.12em] ${STATUS_TONE[row.status]}`}>{(row.status === "published" && when === "ended" ? "Ended" : ACTION_STATUS_LABEL[row.status]).toUpperCase()}</span>
                  {row.fresh > 0 && <span className="text-[12px] font-semibold text-[#FF5A4F]">{row.fresh} new</span>}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      {error && <p className="mt-3 text-sm font-medium text-[#B42318]" role="alert">{error}</p>}
      {archived.length > 0 && <button className="mt-3 min-h-11 rounded-full px-3 text-[14px] font-semibold text-black/60 hover:bg-black/[0.04]" onClick={() => setShowArchived(!showArchived)} type="button">{showArchived ? "Hide archived" : `Show archived (${archived.length})`}</button>}
    </div>
  );
}
