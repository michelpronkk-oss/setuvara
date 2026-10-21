"use client";

import { useState, useTransition } from "react";

import { suggestBuilderFeature, voteBuilderItem } from "@/lib/builder/actions";

const line = "color-mix(in srgb, currentColor 14%, transparent)";
const label = "font-label text-[10.5px] uppercase tracking-[0.18em]";

/**
 * One vote per member per item. Signed-out visitors get a sign-in link back to this page. Colour
 * comes from the page (currentColor and accent), so it sits in any Appearance.
 */
export function VoteButton({ itemId, votes, voted, signedIn, loginHref, accent, accentInk }: { itemId: string; votes: number; voted: boolean; signedIn: boolean; loginHref: string; accent: string; accentInk: string }) {
  const [state, setState] = useState({ votes, voted });
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const style = state.voted ? { background: accent, color: accentInk } : { boxShadow: `inset 0 0 0 1px ${line}` };
  const inner = <><svg aria-hidden="true" className="size-3.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" viewBox="0 0 24 24"><path d="m6 14 6-6 6 6" /></svg><span className="tabular-nums">{state.votes}</span></>;
  if (!signedIn) return <a aria-label={`${state.votes} votes. Sign in to vote`} className="inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold" href={loginHref} style={style}>{inner}</a>;
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button aria-label={state.voted ? `Remove your vote (${state.votes} votes)` : `Vote for this (${state.votes} votes)`} aria-pressed={state.voted} className="inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold transition disabled:opacity-60" disabled={pending}
        onClick={() => start(async () => {
          const result = await voteBuilderItem(itemId, !state.voted);
          if (!result.ok) { setError(result.error); return; }
          setError(""); setState({ votes: Number(result.votes), voted: result.voted });
        })} style={style} type="button">{inner}</button>
      {error && <span className="text-[12px] opacity-75" role="status">{error}</span>}
    </span>
  );
}

const STAGE: Record<string, string> = { planned: "Planned", in_progress: "In progress", shipped: "Shipped" };

/** A signed-in member's idea for the project, and where their earlier ideas stand. */
export function SuggestForm({ projectId, signedIn, loginHref, mine, accent, accentInk }: { projectId: string; signedIn: boolean; loginHref: string; mine: { id: string; title: string; status: string; stage: string | null }[]; accent: string; accentInk: string }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [message, setMessage] = useState("");
  const [pending, start] = useTransition();
  const field = "w-full rounded-[12px] bg-transparent px-3 py-2.5 text-[15px] outline-none";
  return (
    <div className="flex flex-col gap-3">
      {mine.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className={`${label} opacity-55`}>Your ideas</p>
          <ul className="flex flex-col gap-1.5">{mine.map((item) => (
            <li className="flex items-center justify-between gap-3 text-[14px]" key={item.id}><span className="min-w-0 truncate">{item.title}</span>
              <span className={`${label} shrink-0 text-[9.5px] opacity-65`}>{item.status === "pending" ? "With the maker" : item.status === "declined" ? "Not planned" : STAGE[item.stage ?? "planned"] ?? "Planned"}</span></li>
          ))}</ul>
        </div>
      )}
      {!signedIn ? (
        <a className="inline-flex min-h-11 w-fit items-center gap-2 rounded-full px-4 text-[14px] font-semibold" href={loginHref} style={{ boxShadow: `inset 0 0 0 1px ${line}` }}>Sign in to suggest a feature</a>
      ) : !open ? (
        <button className="inline-flex min-h-11 w-fit items-center gap-2 rounded-full px-4 text-[14px] font-semibold" onClick={() => setOpen(true)} style={{ boxShadow: `inset 0 0 0 1px ${line}` }} type="button">Suggest a feature</button>
      ) : (
        <form className="flex flex-col gap-2" onSubmit={(event) => { event.preventDefault(); start(async () => {
          const result = await suggestBuilderFeature(projectId, title.trim(), body.trim());
          if (!result.ok) { setMessage(result.error); return; }
          setTitle(""); setBody(""); setOpen(false); setMessage("Sent. The maker reviews every idea before it goes on the roadmap.");
        }); }}>
          <input aria-label="Your idea" className={field} maxLength={100} minLength={3} onChange={(e) => setTitle(e.target.value)} placeholder="Your idea, in a few words" required style={{ boxShadow: `inset 0 0 0 1px ${line}` }} value={title} />
          <textarea aria-label="Why it matters" className={`${field} min-h-24`} maxLength={1000} onChange={(e) => setBody(e.target.value)} placeholder="Why it would help (optional)" style={{ boxShadow: `inset 0 0 0 1px ${line}` }} value={body} />
          <div className="flex gap-2"><button className="inline-flex min-h-11 items-center rounded-full px-4 text-[14px] font-semibold disabled:opacity-60" disabled={pending || title.trim().length < 3} style={{ background: accent, color: accentInk }} type="submit">{pending ? "Sending…" : "Send idea"}</button>
            <button className="min-h-11 px-3 text-[14px] opacity-70" onClick={() => setOpen(false)} type="button">Cancel</button></div>
          <p className="text-[12.5px] opacity-60">Only the maker sees it until they approve it. Your name isn&apos;t shown publicly.</p>
        </form>
      )}
      {message && <p className="text-[13px] opacity-75" role="status">{message}</p>}
    </div>
  );
}
