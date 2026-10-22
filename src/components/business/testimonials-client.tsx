"use client";

import { confirmDialog } from "@/components/app/confirm-dialog";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { createTestimonialLink, deleteTestimonial, revokeTestimonialLink, setTestimonialStatus } from "@/app/app/identity/testimonials/actions";
import { PlusTag } from "@/app/app/identity/editor-ui";
import { inkButton, lineButton, Mono } from "@/components/creator/studio-ui";
import { relativeTime } from "@/lib/creator/studio";
import { byline, inviteMail, requestState, type Testimonial, type TestimonialRequest } from "@/lib/business/testimonials";


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
    <li className={`relative flex flex-col gap-4 overflow-hidden rounded-[24px] p-6 shadow-[inset_0_0_0_1px_rgba(13,13,13,.08),0_24px_50px_-44px_#0D0D0D] ${item.status === "approved" ? "bg-[#FFFBF2]" : "bg-white"}`} data-testimonial={item.status}>
      <div className="flex items-start justify-between gap-3">
        <span aria-hidden="true" className="font-display text-[64px] font-bold leading-[0.55] text-[#FFB547]">&ldquo;</span>
        <span className="flex items-center gap-2">
          {item.verified && <span className="rounded-full bg-[#C7FF4A] px-2.5 py-1 font-label text-[10px] uppercase tracking-[0.12em]">Verified client</span>}
          <Stars rating={item.rating} />
        </span>
      </div>
      <blockquote className="whitespace-pre-line text-[18px] leading-[1.45] tracking-[-0.015em]">{item.body}</blockquote>
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-full bg-[#0D0D0D] font-display text-[16px] font-bold text-[#FFE7B8]">{item.author_name.slice(0, 1).toUpperCase()}</span>
        <p className="min-w-0 text-[14px] leading-tight"><b className="block truncate">{item.author_name}</b><span className="text-black/50">{line ? `${line} · ` : ""}{relativeTime(item.created_at)}</span></p>
      </div>
      <div className="flex flex-wrap gap-2 border-t border-black/[0.07] pt-4">
        {item.status !== "approved" && <button className={`${inkButton} min-h-10 px-4 text-[14px]`} disabled={busy} onClick={() => onStatus("approved")} type="button">Show on page</button>}
        {item.status !== "hidden" && <button className={`${lineButton} min-h-10 px-4 text-[14px]`} disabled={busy} onClick={() => onStatus("hidden")} type="button">{item.status === "approved" ? "Take off page" : "Hide"}</button>}
        <button className="ml-auto min-h-10 rounded-full px-3 text-[14px] font-semibold text-black/45 transition hover:text-[#B42318]" disabled={busy} onClick={onDelete} type="button">Delete</button>
      </div>
    </li>
  );
}

/** No testimonials yet: how it works in three steps, next to what one looks like on the page. */
function EmptyShowcase({ owner }: { owner: string }) {
  const steps = [
    { n: "01", title: "Make a private link", body: "One link per client. It works once and expires in 30 days." },
    { n: "02", title: "They write it", body: "A short form: their words, their name, a star rating if they like." },
    { n: "03", title: "You approve it", body: "Nothing shows until you choose. Won leads show as verified clients." },
  ];
  return (
    <section aria-label="How testimonials work" className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-stretch">
      <ol className="flex flex-col gap-2">
        {steps.map((step) => (
          <li className="flex gap-4 rounded-[22px] bg-white p-5 shadow-[inset_0_0_0_1px_rgba(13,13,13,.07)]" key={step.n}>
            <span className="font-label text-[12px] text-[#C9851A]">{step.n}</span>
            <span><span className="block text-[16px] font-semibold tracking-[-0.01em]">{step.title}</span><span className="mt-1 block text-[14px] leading-[1.45] text-black/55">{step.body}</span></span>
          </li>
        ))}
      </ol>
      <figure aria-label="Example" className="relative flex flex-col justify-between gap-6 overflow-hidden rounded-[28px] bg-[#FFFBF2] p-7 shadow-[inset_0_0_0_1px_rgba(201,133,26,.18),0_30px_60px_-50px_#0D0D0D]">
        <span className="absolute right-5 top-5 rounded-full bg-white px-2.5 py-1 font-label text-[10px] uppercase tracking-[0.14em] text-black/50 shadow-[inset_0_0_0_1px_rgba(13,13,13,.08)]">Example</span>
        <div>
          <span aria-hidden="true" className="font-display text-[72px] font-bold leading-[0.5] text-[#FFB547]">&ldquo;</span>
          <blockquote className="mt-2 text-[20px] leading-[1.4] tracking-[-0.015em]">Working with {owner.split(/\s+/)[0] || "them"} was the easiest decision we made this year. Clear, fast, and the result spoke for itself.</blockquote>
        </div>
        <figcaption className="flex items-center gap-3">
          <span aria-hidden="true" className="grid size-10 place-items-center rounded-full bg-[#0D0D0D] font-display text-[16px] font-bold text-[#FFE7B8]">S</span>
          <span className="text-[14px] leading-tight"><b className="block">Sam, founder at Northwind</b><span className="flex items-center gap-2 text-black/50"><Stars className="text-[#FFB547]" rating={5} />Verified client</span></span>
        </figcaption>
      </figure>
    </section>
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
        {testimonials.length === 0 && <EmptyShowcase owner={owner} />}
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
                {items.map((item) => <Card busy={pending} item={item} key={item.id} onDelete={async () => { if (await confirmDialog({ title: "Delete this testimonial?", body: "It's gone for good.", action: "Delete", tone: "danger" })) run(() => deleteTestimonial(item.id)); }} onStatus={(status) => run(() => setTestimonialStatus(item.id, status))} />)}
              </ul>
            </section>
          );
        })}
      </div>

      <aside className="flex flex-col gap-4 lg:sticky lg:top-24">
        <section aria-labelledby="ask-title" className="relative isolate flex flex-col gap-3 overflow-hidden rounded-[28px] bg-[#0D0D0D] p-6 text-[#F5F4EF] shadow-[0_30px_60px_-40px_#0D0D0D]">
          <span aria-hidden="true" className="pointer-events-none absolute -right-16 -top-20 -z-10 size-60 rounded-full opacity-80 blur-2xl" style={{ background: "radial-gradient(circle, #FFB54766, transparent 65%)" }} />
          <span aria-hidden="true" className="font-display text-[56px] font-bold leading-[0.5] text-[#FFB547]">&ldquo;</span>
          <h2 className="font-display text-[26px] font-bold tracking-[-0.04em]" id="ask-title">Ask for one</h2>
          <p className="text-[14px] leading-[1.45] text-[#F5F4EF]/65">A private link for one person. From a lead, use Ask for a testimonial in its sheet.</p>
          <label className="sr-only" htmlFor="ask-name">Who it&apos;s for</label>
          <input className="min-h-12 w-full rounded-full bg-[#F5F4EF]/[0.08] px-4 text-[15px] text-[#F5F4EF] outline-none placeholder:text-[#F5F4EF]/40 shadow-[inset_0_0_0_1px_rgba(245,244,239,.16)] focus:shadow-[inset_0_0_0_2px_#FFB547]" id="ask-name" maxLength={80} onChange={(event) => setName(event.target.value)} placeholder="Who it's for (optional)" value={name} />
          <button className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#FFB547] px-5 text-[15px] font-semibold text-[#0D0D0D] transition hover:brightness-95 disabled:opacity-50" disabled={pending} onClick={create} type="button">{pending ? "Making…" : "Make a link"}</button>
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
                    <span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${state === "open" ? "bg-[#3BD17A]" : state === "used" ? "bg-[#FFB547]" : "bg-black/20"}`} />
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
