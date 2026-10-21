"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { createTestimonialLink, deleteTestimonial, revokeTestimonialLink, setTestimonialStatus } from "@/app/app/identity/testimonials/actions";
import { PlusTag } from "@/app/app/identity/editor-ui";
import { inkButton, lineButton, Mono } from "@/components/creator/studio-ui";
import { relativeTime } from "@/lib/creator/studio";
import { byline, inviteMail, requestState, type Testimonial, type TestimonialRequest } from "@/lib/business/testimonials";

const field = "min-h-11 w-full rounded-full bg-white px-4 text-[15px] shadow-[inset_0_0_0_1px_rgba(13,13,13,.12)] outline-none focus:shadow-[inset_0_0_0_2px_#0D0D0D]";

export function Stars({ rating, className = "" }: { rating: number | null; className?: string }) {
  if (!rating) return null;
  return <span aria-label={`${rating} out of 5`} className={`inline-flex gap-0.5 ${className}`} role="img">{[1, 2, 3, 4, 5].map((star) => <svg aria-hidden="true" className={`size-3.5 ${star <= rating ? "" : "opacity-20"}`} fill="currentColor" key={star} viewBox="0 0 20 20"><path d="m10 1.8 2.5 5.3 5.8.7-4.3 4 1.1 5.7L10 14.7l-5.1 2.8L6 11.8l-4.3-4 5.8-.7L10 1.8Z" /></svg>)}</span>;
}

/** The link the owner just made, with copy and a prefilled email. Shown once: only a hash is stored. */
export function FreshLink({ url, name, owner, email = null }: { url: string; name: string; owner: string; email?: string | null }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-col gap-3 rounded-[20px] bg-[#0D0D0D] p-4 text-[#F5F4EF]" data-fresh-link>
      <Mono className="text-[#FFE7B8]">Private link · works once · 30 days</Mono>
      <p className="break-all font-label text-[13px] text-white/85">{url}</p>
      <div className="flex flex-wrap gap-2">
        <button className="inline-flex min-h-10 items-center rounded-full bg-[#F5F4EF] px-4 text-[14px] font-semibold text-[#0D0D0D]" onClick={() => void navigator.clipboard?.writeText(url).then(() => setCopied(true))} type="button">{copied ? "Copied" : "Copy link"}</button>
        <a className="inline-flex min-h-10 items-center rounded-full px-4 text-[14px] font-semibold text-[#F5F4EF] shadow-[inset_0_0_0_1px_rgba(245,244,239,.3)]" href={inviteMail({ to: email, name, owner, url })}>Email it</a>
      </div>
      <p className="text-[12.5px] text-white/55">Copy it now. For safety Setuvara keeps only a fingerprint, so this link can&apos;t be shown again.</p>
    </div>
  );
}

function Card({ item, busy, onStatus, onDelete }: { item: Testimonial; busy: boolean; onStatus: (status: "approved" | "hidden" | "pending") => void; onDelete: () => void }) {
  const line = byline(item);
  return (
    <li className="flex flex-col gap-4 rounded-[22px] bg-white p-5 shadow-[inset_0_0_0_1px_rgba(13,13,13,.08)]" data-testimonial={item.status}>
      <div className="flex items-start justify-between gap-3">
        <span aria-hidden="true" className="font-display text-[44px] font-bold leading-[0.6] text-[#FFB547]">&ldquo;</span>
        <span className="flex items-center gap-2">
          {item.verified && <span className="rounded-full bg-[#C7FF4A] px-2.5 py-1 font-label text-[10px] uppercase tracking-[0.12em]">Verified client</span>}
          <Stars rating={item.rating} />
        </span>
      </div>
      <blockquote className="whitespace-pre-line text-[17px] leading-[1.45] tracking-[-0.01em]">{item.body}</blockquote>
      <p className="text-[14px]"><b>{item.author_name}</b>{line && <span className="text-black/55"> · {line}</span>}<span className="text-black/40"> · {relativeTime(item.created_at)}</span></p>
      <div className="flex flex-wrap gap-2 border-t border-black/[0.07] pt-4">
        {item.status !== "approved" && <button className={`${inkButton} min-h-10 px-4 text-[14px]`} disabled={busy} onClick={() => onStatus("approved")} type="button">Show on page</button>}
        {item.status !== "hidden" && <button className={`${lineButton} min-h-10 px-4 text-[14px]`} disabled={busy} onClick={() => onStatus("hidden")} type="button">{item.status === "approved" ? "Take off page" : "Hide"}</button>}
        <button className="ml-auto min-h-10 rounded-full px-3 text-[14px] font-semibold text-black/45 transition hover:text-[#B42318]" disabled={busy} onClick={onDelete} type="button">Delete</button>
      </div>
    </li>
  );
}

const STATE_LABEL = { open: "Open", used: "Answered", revoked: "Revoked", expired: "Expired" } as const;

/**
 * Ask, review, choose. Every testimonial comes from a private link the owner made; none is public
 * until approved, and the plan sets how many show on the page.
 */
export function TestimonialsBoard({ testimonials, requests, shown, plan, owner }: { testimonials: Testimonial[]; requests: TestimonialRequest[]; shown: number; plan: "free" | "plus" | "pro"; owner: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [name, setName] = useState("");
  const [fresh, setFresh] = useState<{ url: string; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const run = (task: () => Promise<{ ok: boolean; error?: string }>) => { setError(null); start(async () => { const result = await task(); if (!result.ok) setError(result.error ?? "Try again."); else router.refresh(); }); };
  const create = () => { setError(null); start(async () => { const result = await createTestimonialLink(null, name.trim()); if (!result.ok) { setError(result.error); return; } setFresh({ url: result.url, name: name.trim() }); setName(""); router.refresh(); }); };
  const groups = [
    { key: "pending", title: "Waiting for you", note: "Read it first. Nothing shows until you choose." },
    { key: "approved", title: "On your page", note: plan === "pro" ? `Your newest ${shown} approved show on Business Mode.` : `Your plan shows the newest ${shown} on Business Mode.` },
    { key: "hidden", title: "Hidden", note: "Kept here, never shown." },
  ] as const;
  const approved = testimonials.filter((item) => item.status === "approved").length;

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
      <div className="flex flex-col gap-9">
        {error && <p className="text-[14px] font-semibold text-[#B42318]" role="alert">{error}</p>}
        {testimonials.length === 0 && (
          <div className="rounded-[28px] bg-white p-7 shadow-[inset_0_0_0_1px_rgba(13,13,13,.07)]">
            <p className="font-display text-[30px] font-bold leading-[1] tracking-[-0.045em]">Let clients say it.</p>
            <p className="mt-3 max-w-[52ch] text-[15px] leading-[1.5] text-black/60">Make a private link, send it to someone you worked with, and approve what they write. From a lead you marked Won, it shows as a verified client.</p>
          </div>
        )}
        {groups.map((group) => {
          const items = testimonials.filter((item) => item.status === group.key);
          if (!items.length) return null;
          return (
            <section aria-labelledby={`t-${group.key}`} key={group.key}>
              <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
                <h2 className="font-display text-[26px] font-bold tracking-[-0.045em]" id={`t-${group.key}`}>{group.title} <span className="text-black/35">{items.length}</span></h2>
                <p className="flex items-center gap-2 text-[13px] text-black/50">{group.key === "approved" && approved > shown && <PlusTag />}{group.note}</p>
              </div>
              <ul className="grid gap-3 md:grid-cols-2">
                {items.map((item) => <Card busy={pending} item={item} key={item.id} onDelete={() => { if (window.confirm("Delete this testimonial for good?")) run(() => deleteTestimonial(item.id)); }} onStatus={(status) => run(() => setTestimonialStatus(item.id, status))} />)}
              </ul>
            </section>
          );
        })}
      </div>

      <aside className="flex flex-col gap-4 lg:sticky lg:top-24">
        <section aria-labelledby="ask-title" className="flex flex-col gap-3 rounded-[24px] bg-white p-5 shadow-[inset_0_0_0_1px_rgba(13,13,13,.08)]">
          <h2 className="font-display text-[22px] font-bold tracking-[-0.035em]" id="ask-title">Ask for one</h2>
          <p className="text-[14px] leading-[1.45] text-black/55">A private link for one person. From a lead, use Ask for a testimonial in its sheet.</p>
          <label className="sr-only" htmlFor="ask-name">Who it&apos;s for</label>
          <input className={field} id="ask-name" maxLength={80} onChange={(event) => setName(event.target.value)} placeholder="Who it's for (optional)" value={name} />
          <button className={inkButton} disabled={pending} onClick={create} type="button">{pending ? "Making…" : "Make a link"}</button>
          {fresh && <FreshLink name={fresh.name} owner={owner} url={fresh.url} />}
        </section>
        {requests.length > 0 && (
          <section aria-labelledby="links-title">
            <h2 className="mb-2 font-display text-[18px] font-bold tracking-[-0.03em]" id="links-title">Links</h2>
            <ul className="divide-y divide-black/[0.07] overflow-hidden rounded-[20px] bg-white shadow-[inset_0_0_0_1px_rgba(13,13,13,.08)]">
              {requests.slice(0, 12).map((request) => {
                const state = requestState(request);
                return (
                  <li className="flex items-center gap-3 px-4 py-2.5" data-request={state} key={request.id}>
                    <span className="min-w-0 flex-1"><span className="block truncate text-[14px] font-semibold">{request.name || "Anyone with the link"}</span><span className="block text-[12.5px] text-black/50">{STATE_LABEL[state]} · made {relativeTime(request.created_at)}</span></span>
                    {state === "open" && <button className="min-h-9 rounded-full px-3 text-[13px] font-semibold text-black/55 transition hover:bg-black/[0.05] hover:text-black" disabled={pending} onClick={() => run(() => revokeTestimonialLink(request.id))} type="button">Revoke</button>}
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </aside>
    </div>
  );
}
