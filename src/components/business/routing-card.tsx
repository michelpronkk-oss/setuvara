"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { saveLeadRouting } from "@/app/app/identity/team/actions";
import { inkButton, Mono } from "@/components/creator/studio-ui";
import type { LeadPerson } from "@/lib/business/model";
import { liveRules, type LeadRouting } from "@/lib/business/team";

const select = "min-h-10 w-full appearance-none rounded-full bg-white pl-3.5 pr-9 text-[14px] font-semibold shadow-[inset_0_0_0_1px_rgba(13,13,13,.12)] outline-none focus:shadow-[inset_0_0_0_2px_#0D0D0D]";

/**
 * Lead Routing: off, or round robin across the team, with a person per Action that wins first.
 * Applied by the database as each lead arrives; assigned teammates get an email.
 */
export function RoutingCard({ routing, actions, people }: { routing: LeadRouting; actions: { id: string; title: string }[]; people: LeadPerson[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [mode, setMode] = useState(routing.mode);
  const [includeOwner, setIncludeOwner] = useState(routing.include_owner);
  const [rules, setRules] = useState(() => liveRules(routing.rules, actions.map((action) => action.id), people.map((person) => person.user_id)));
  const [note, setNote] = useState<{ error: boolean; text: string } | null>(null);
  const teammates = people.filter((person) => person.role !== "owner");
  const save = () => { setNote(null); start(async () => { const result = await saveLeadRouting(mode, includeOwner, rules); setNote(result.ok ? { error: false, text: "Saved. New leads follow these rules." } : { error: true, text: result.error }); if (result.ok) router.refresh(); }); };

  return (
    <section aria-labelledby="routing-title" className="flex flex-col gap-4 rounded-[24px] bg-white p-5 shadow-[inset_0_0_0_1px_rgba(13,13,13,.08)]" data-routing={mode}>
      <div>
        <h2 className="font-display text-[22px] font-bold tracking-[-0.035em]" id="routing-title">Lead routing</h2>
        <p className="mt-1 text-[14px] leading-[1.45] text-black/55">Who a new lead goes to the moment it arrives. They get an email; anyone can still reassign it.</p>
      </div>
      <div aria-label="Routing" className="grid grid-cols-2 gap-1 rounded-full bg-black/[0.05] p-1" role="radiogroup">
        {([["off", "Off"], ["round_robin", "Take turns"]] as const).map(([value, label]) => (
          <button aria-checked={mode === value} className={`min-h-9 rounded-full px-3 text-[13px] font-semibold transition ${mode === value ? "bg-white text-[#0D0D0D] shadow-[0_1px_2px_rgba(13,13,13,.12)]" : "text-black/55 hover:text-[#0D0D0D]"}`} key={value} onClick={() => setMode(value)} role="radio" type="button">{label}</button>
        ))}
      </div>
      {mode === "round_robin" && (
        <>
          <label className="flex items-center justify-between gap-3 text-[14px]">
            <span><span className="font-semibold">Include me</span><span className="block text-[13px] text-black/50">{teammates.length ? `Otherwise turns go to ${teammates.length === 1 ? teammates[0].name : `${teammates.length} teammates`}.` : "Nobody has joined yet."}</span></span>
            <input checked={includeOwner} className="size-5 shrink-0 accent-[#0D0D0D]" onChange={(change) => setIncludeOwner(change.target.checked)} type="checkbox" />
          </label>
          {actions.length > 0 && (
            <div className="flex flex-col gap-2.5 border-t border-black/[0.07] pt-4">
              <Mono className="text-black/50">By Action</Mono>
              {actions.map((action) => (
                <label className="grid gap-1.5" key={action.id}>
                  <span className="truncate text-[14px] font-semibold">{action.title}</span>
                  <span className="relative block">
                    <select className={select} onChange={(change) => setRules((current) => { const next = { ...current }; if (change.target.value) next[action.id] = change.target.value; else delete next[action.id]; return next; })} value={rules[action.id] ?? ""}>
                      <option value="">Take turns</option>
                      {people.map((person) => <option key={person.user_id} value={person.user_id}>Always {person.you ? "me" : person.name}</option>)}
                    </select>
                    <svg aria-hidden="true" className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-black/45" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6" /></svg>
                  </span>
                </label>
              ))}
            </div>
          )}
        </>
      )}
      <button className={inkButton} disabled={pending} onClick={save} type="button">{pending ? "Saving…" : "Save routing"}</button>
      {note && <p className={`text-[13px] font-semibold ${note.error ? "text-[#B42318]" : "text-black/60"}`} role={note.error ? "alert" : "status"}>{note.text}</p>}
    </section>
  );
}
