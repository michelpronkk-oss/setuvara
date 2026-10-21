"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { Counter, Field, PlusTag, Sheet, TextArea, TextInput } from "@/app/app/identity/editor-ui";
import { coralButton, FilterPill, inkButton, lineButton, Mono } from "@/components/creator/studio-ui";
import type { ModeSlug } from "@/components/profile/types";
import { audienceErrorMessage, BODY_MAX, campaignParagraphs, PREHEADER_MAX, SUBJECT_MAX, type AudienceLimits, type Campaign } from "@/lib/audience/model";
import type { AudiencePerson } from "@/lib/audience/studio-server";
import { relativeTime } from "@/lib/creator/studio";
import { createClient } from "@/lib/supabase/client";

const MODE_DOT: Record<ModeSlug, string> = { personal: "#FF5A4F", event: "#C7FF4A", business: "#AFCBFF", creator: "#E8A6FF" };
type ListOption = { id: string; title: string; mode: ModeSlug; subscribed?: number };
const post = (url: string) => fetch(url, { method: "POST", headers: { "Content-Type": "application/json", "x-setuvara-request": "same-origin" }, body: "{}" })
  .then(async (response) => ({ ok: response.ok, body: await response.json().catch(() => ({})) as { error?: string; recipients?: number; to?: string } }))
  .catch(() => ({ ok: false, body: { error: "Check your connection and try again." } as { error?: string; recipients?: number; to?: string } }));

/** Starts a draft for this Mode's lists and opens it. */
export function NewCampaignButton({ profileId, modeId, listIds, hrefPrefix, hrefSuffix }: { profileId: string; modeId: string; listIds: string[]; hrefPrefix: string; hrefSuffix: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function start() {
    setBusy(true);
    const { data } = await createClient().from("audience_campaigns").insert({ profile_id: profileId, mode_id: modeId, list_ids: listIds }).select("id").single();
    if (data?.id) router.push(`${hrefPrefix}${data.id}${hrefSuffix}`); else setBusy(false);
  }
  return <button className={coralButton} disabled={busy} onClick={() => void start()} type="button"><span aria-hidden="true">+</span>New campaign</button>;
}

/** Everyone on the lists, one row per address, newest first: search, filter and export. */
export function PeopleList({ people, lists, canExport }: { people: AudiencePerson[]; lists: ListOption[]; canExport: boolean }) {
  const [filter, setFilter] = useState<"subscribed" | "pending_verification">("subscribed");
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(40);
  const listById = useMemo(() => new Map(lists.map((list) => [list.id, list])), [lists]);
  // Someone on two lists is still one person.
  const grouped = useMemo(() => {
    const byEmail = new Map<string, { key: string; name: string; email: string | null; status: AudiencePerson["status"]; lists: ListOption[]; at: string }>();
    for (const person of people) {
      const key = `${person.status}:${(person.email ?? person.id).toLowerCase()}`;
      const entry = byEmail.get(key) ?? { key, name: person.name, email: person.email, status: person.status, lists: [], at: person.verified_at ?? person.created_at };
      const list = listById.get(person.action_id);
      if (list && !entry.lists.includes(list)) entry.lists.push(list);
      if (!entry.name && person.name) entry.name = person.name;
      byEmail.set(key, entry);
    }
    return [...byEmail.values()];
  }, [listById, people]);
  const needle = query.trim().toLowerCase();
  const shown = grouped.filter((person) => person.status === filter && (!needle || person.name.toLowerCase().includes(needle) || (person.email ?? "").toLowerCase().includes(needle)));
  const count = (status: AudiencePerson["status"]) => grouped.filter((person) => person.status === status).length;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-2 overflow-x-auto [scrollbar-width:none]">
          <FilterPill count={count("subscribed")} label="Subscribed" on={filter === "subscribed"} onClick={() => setFilter("subscribed")} />
          <FilterPill count={count("pending_verification")} label="Unconfirmed" on={filter === "pending_verification"} onClick={() => setFilter("pending_verification")} />
        </div>
        <input aria-label="Search people" className="order-last min-h-10 min-w-0 basis-full rounded-full sm:order-none sm:basis-auto sm:flex-1 bg-white px-4 text-[15px] shadow-[inset_0_0_0_1px_rgba(13,13,13,.1)] outline-none focus:shadow-[inset_0_0_0_2px_#0D0D0D] sm:max-w-[260px]" onChange={(event) => setQuery(event.target.value)} placeholder="Search name or email" value={query} />
        {canExport
          ? <a className={`${lineButton} sm:ml-auto`} download href="/api/audience/export">Export CSV</a>
          : <span className="flex items-center gap-2 text-[14px] text-black/60 sm:ml-auto"><PlusTag /> Export comes with Plus</span>}
      </div>
      {shown.length ? (
        <ul className="divide-y divide-black/10 border-y border-black/10">
          {shown.slice(0, limit).map((person) => (
            <li className="flex items-center gap-4 py-3" key={person.key}>
              <span className="min-w-0 flex-1"><span className="block truncate text-[16px] font-semibold">{person.name || person.email || "No name"}</span>{person.name && <span className="block truncate text-[14px] text-black/60">{person.email}</span>}</span>
              <span className="hidden min-w-0 max-w-[40%] items-center gap-1.5 truncate text-[13px] text-black/60 sm:flex">{person.lists.map((list) => <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full" key={list.id} style={{ background: MODE_DOT[list.mode] }} />)}<span className="truncate">{person.lists.map((list) => list.title).join(", ")}</span></span>
              <span className="shrink-0 text-[13px] text-black/50">{relativeTime(person.at)}</span>
            </li>
          ))}
        </ul>
      ) : <p className="py-2 text-[15px] text-black/60">{people.length ? "No one matches." : "No one yet. Share a page with a Newsletter on it."}</p>}
      {shown.length > limit && <button className={`${lineButton} self-center`} onClick={() => setLimit((value) => value + 80)} type="button">Show more</button>}
    </div>
  );
}

/** The email as readers get it: the sender, the words, and why they get it. */
function EmailPreview({ senderName, subject, preheader, body, lists }: { senderName: string; subject: string; preheader: string; body: string; lists: string[] }) {
  const paragraphs = campaignParagraphs(body);
  return (
    <div className="overflow-hidden rounded-[24px] bg-[#EEEDE7] shadow-[inset_0_0_0_1px_rgba(13,13,13,.06)]">
      <div className="border-b border-black/[0.08] bg-white px-5 py-4">
        <p className="truncate text-[14px] font-semibold">{senderName || "You"} via Setuvara</p>
        <p className="mt-0.5 truncate text-[15px] font-semibold">{subject || <span className="text-black/35">Subject</span>}</p>
        <p className="mt-0.5 truncate text-[13px] text-black/50">{preheader || paragraphs[0] || "Preview text"}</p>
      </div>
      <div className="p-4 sm:p-6">
        <div className="rounded-[18px] bg-white px-5 py-6 text-[15px] leading-[1.6] sm:px-6">
          {paragraphs.length ? paragraphs.map((part, index) => <p className="mb-4 whitespace-pre-line break-words last:mb-0" key={index}>{part}</p>) : <p className="text-black/35">Your message appears here.</p>}
        </div>
        <p className="mt-4 px-1 text-[12px] leading-[1.5] text-black/50">You get this because you subscribed to {lists.length ? lists.join(", ") : "a newsletter"} by {senderName || "you"} on Setuvara. <span className="underline">Unsubscribe</span></p>
      </div>
    </div>
  );
}

/** A draft: lists, subject, words and a live preview; then a test, then send. */
export function CampaignComposer({ campaign, lists, subscribed, complete, limits, sendEnabled, senderName, audienceHref }: {
  campaign: Campaign; lists: (ListOption & { subscribed: number })[]; subscribed: { action_id: string; email: string }[]; complete: boolean;
  limits: AudienceLimits; sendEnabled: boolean; senderName: string; audienceHref: string;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState({ list_ids: campaign.list_ids, subject: campaign.subject, preheader: campaign.preheader, body: campaign.body, reply_to: campaign.reply_to ?? "" });
  const [saved, setSaved] = useState(true);
  const [busy, setBusy] = useState<null | "save" | "test" | "send" | "delete">(null);
  const [note, setNote] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const set = <K extends keyof typeof draft>(key: K, value: (typeof draft)[K]) => { setDraft((current) => ({ ...current, [key]: value })); setSaved(false); };

  // A fair count before sending: one per address across the picked lists (the database has the final say).
  const recipients = useMemo(() => {
    if (!complete) return lists.filter((list) => draft.list_ids.includes(list.id)).reduce((sum, list) => sum + list.subscribed, 0);
    return new Set(subscribed.filter((item) => draft.list_ids.includes(item.action_id)).map((item) => item.email.toLowerCase())).size;
  }, [complete, draft.list_ids, lists, subscribed]);
  const left = Math.max(0, limits.monthly_emails - limits.used_this_month);
  const replyValid = !draft.reply_to.trim() || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(draft.reply_to.trim());
  const ready = draft.subject.trim() && draft.body.trim() && draft.list_ids.length && recipients > 0 && replyValid;

  async function save() {
    if (!replyValid) { setNote({ tone: "error", text: "Check the reply-to address." }); return false; }
    setBusy("save");
    const { error } = await createClient().from("audience_campaigns").update({ ...draft, reply_to: draft.reply_to.trim() || null }).eq("id", campaign.id);
    setBusy(null);
    if (error) { setNote({ tone: "error", text: audienceErrorMessage(error.message) }); return false; }
    setSaved(true);
    return true;
  }
  // Drafts keep themselves: a quiet save a moment after the last keystroke.
  useEffect(() => {
    if (saved) return;
    const timer = setTimeout(() => void save(), 1200);
    return () => clearTimeout(timer);
  });

  async function test() {
    if (!(await save())) return;
    setBusy("test");
    const result = await post(`/api/audience/campaigns/${campaign.id}/test`);
    setBusy(null);
    setNote(result.ok ? { tone: "ok", text: `Test sent to ${result.body.to}.` } : { tone: "error", text: result.body.error ?? "The test didn't send." });
  }
  async function send() {
    if (!(await save())) return;
    setBusy("send");
    const result = await post(`/api/audience/campaigns/${campaign.id}/send`);
    setBusy(null);
    setConfirming(false);
    if (!result.ok) { setNote({ tone: "error", text: result.body.error ?? "That didn't send." }); return; }
    router.refresh();
  }
  async function remove() {
    setBusy("delete");
    await createClient().from("audience_campaigns").delete().eq("id", campaign.id);
    router.push(audienceHref);
  }

  const toggle = (id: string) => set("list_ids", draft.list_ids.includes(id) ? draft.list_ids.filter((item) => item !== id) : [...draft.list_ids, id]);
  const blocked = !limits.can_send ? "Sending to your list comes with Plus." : !sendEnabled ? "Sending isn't switched on for this site yet." : recipients > left ? `This month has ${left.toLocaleString("en")} emails left on ${limits.plan === "pro" ? "Pro" : "Plus"}.` : limits.campaigns_today >= limits.daily_campaigns ? "You've sent today's campaigns. Try again tomorrow." : null;

  return (
    <div className="grid gap-8 pb-28 lg:grid-cols-[minmax(0,1fr)_minmax(0,460px)] lg:gap-10 lg:pb-0">
      <div className="flex min-w-0 flex-col gap-6">
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">To</legend>
          <div className="flex flex-wrap gap-2">
            {lists.map((list) => {
              const on = draft.list_ids.includes(list.id);
              return (
                <button aria-pressed={on} className={`inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-[15px] font-semibold transition ${on ? "bg-[#0D0D0D] text-[#F5F4EF]" : "bg-white shadow-[inset_0_0_0_1px_rgba(13,13,13,.12)] hover:bg-black/[0.03]"}`} key={list.id} onClick={() => toggle(list.id)} type="button">
                  <span aria-hidden="true" className="size-2 rounded-full" style={{ background: MODE_DOT[list.mode] }} />{list.title}<span className={`font-label text-[11px] ${on ? "text-white/65" : "text-black/45"}`}>{list.subscribed}</span>
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-[13px] text-black/55">{recipients} {recipients === 1 ? "person" : "people"}, one email per address. Only confirmed subscribers get it.</p>
        </fieldset>
        <Field hint={<Counter max={SUBJECT_MAX} value={draft.subject} />} htmlFor="sv-subject" label="Subject">
          <TextInput id="sv-subject" maxLength={SUBJECT_MAX} onChange={(event) => set("subject", event.target.value)} placeholder="What's new this month" value={draft.subject} />
        </Field>
        <Field hint={<Counter max={PREHEADER_MAX} value={draft.preheader} />} htmlFor="sv-preheader" label="Preview text">
          <TextInput id="sv-preheader" maxLength={PREHEADER_MAX} onChange={(event) => set("preheader", event.target.value)} placeholder="The line inboxes show after the subject" value={draft.preheader} />
        </Field>
        <Field hint="Blank line for a new paragraph. Links start with https://" htmlFor="sv-body" label="Message">
          <TextArea className="min-h-[280px]" id="sv-body" maxLength={BODY_MAX} onChange={(event) => set("body", event.target.value)} placeholder="Write it like a letter." value={draft.body} />
        </Field>
        <Field error={replyValid ? undefined : "Check this address."} hint="Optional" htmlFor="sv-reply" label="Replies go to">
          <TextInput aria-invalid={!replyValid} autoComplete="email" id="sv-reply" inputMode="email" maxLength={254} onChange={(event) => set("reply_to", event.target.value)} placeholder="you@example.com" type="email" value={draft.reply_to} />
        </Field>
        <button className="self-start text-[14px] font-semibold text-black/55 underline-offset-4 hover:text-black hover:underline disabled:opacity-50" disabled={busy !== null} onClick={() => void remove()} type="button">Delete draft</button>
      </div>

      <aside className="min-w-0 lg:sticky lg:top-[100px] lg:self-start">
        <Mono className="mb-3 text-black/55">Preview</Mono>
        <EmailPreview body={draft.body} lists={lists.filter((list) => draft.list_ids.includes(list.id)).map((list) => list.title)} preheader={draft.preheader} senderName={senderName} subject={draft.subject} />
        <div className="fixed inset-x-0 bottom-[calc(72px+env(safe-area-inset-bottom))] z-30 border-t border-black/10 bg-[#F5F4EF]/95 px-3.5 py-3 backdrop-blur-md lg:static lg:mt-5 lg:border-0 lg:bg-transparent lg:p-0">
          <div className="mx-auto flex max-w-[1520px] flex-wrap items-center gap-2">
            <button className={lineButton} disabled={busy !== null || !limits.can_send || !sendEnabled || !draft.subject.trim() || !draft.body.trim()} onClick={() => void test()} type="button">{busy === "test" ? "Sending…" : "Send test to me"}</button>
            <button className={`${coralButton} flex-1 lg:flex-none`} disabled={busy !== null || !ready || Boolean(blocked)} onClick={() => setConfirming(true)} type="button">Send to {recipients} {recipients === 1 ? "person" : "people"}</button>
            <span aria-live="polite" className="hidden text-[13px] text-black/55 lg:inline">{busy === "save" ? "Saving…" : saved ? "Draft saved" : ""}</span>
          </div>
          {blocked && <p className="mx-auto mt-2 flex max-w-[1520px] items-center gap-2 text-[13px] text-black/60">{!limits.can_send && <PlusTag />}{blocked}</p>}
          {note && <p className={`mx-auto mt-2 max-w-[1520px] text-[13px] font-semibold ${note.tone === "error" ? "text-[#B42318]" : "text-[#1F7A4D]"}`} role={note.tone === "error" ? "alert" : "status"}>{note.text}</p>}
        </div>
      </aside>

      {confirming && (
        <Sheet footer={<div className="flex gap-2"><button className={lineButton} onClick={() => setConfirming(false)} type="button">Not yet</button><button className={`${inkButton} flex-1`} disabled={busy === "send"} onClick={() => void send()} type="button">{busy === "send" ? "Sending…" : `Send to ${recipients} ${recipients === 1 ? "person" : "people"}`}</button></div>} onClose={() => setConfirming(false)} title="Send it now?">
          <p className="text-[15px] leading-[1.5] text-black/70">&ldquo;{draft.subject}&rdquo; goes to {recipients} confirmed {recipients === 1 ? "subscriber" : "subscribers"}. Once it&apos;s out, it can&apos;t be changed or called back.</p>
          <p className="mt-3 text-[13px] text-black/55">Uses {recipients.toLocaleString("en")} of the {left.toLocaleString("en")} emails left this month.</p>
        </Sheet>
      )}
    </div>
  );
}

/** A queued or sent campaign: how far delivery got, and what went out. */
export function CampaignProgress({ campaign, lists, senderName }: { campaign: Campaign; lists: ListOption[]; senderName: string }) {
  const router = useRouter();
  const going = campaign.status === "queued" || campaign.status === "sending";
  const [resuming, setResuming] = useState(false);
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (!going) return;
    const timer = setInterval(() => { setNow(Date.now()); router.refresh(); }, 4000);
    return () => clearInterval(timer);
  }, [going, router]);
  const done = campaign.sent_count + campaign.failed_count + campaign.skipped_count;
  const share = campaign.recipient_count ? Math.round((done / campaign.recipient_count) * 100) : 0;
  // A run that stopped mid-way is picked up by the scheduled job; the owner can nudge it too.
  const stalled = going && now > 0 && now - new Date(campaign.updated_at).getTime() > 2 * 60 * 1000;
  const cards = [
    { label: "Recipients", value: campaign.recipient_count },
    { label: "Sent", value: campaign.sent_count },
    { label: "Skipped", value: campaign.skipped_count, note: "left before it went out" },
    { label: "Failed", value: campaign.failed_count },
  ];
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,460px)] lg:gap-10">
      <div className="flex min-w-0 flex-col gap-6">
        <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {cards.map((card) => (
            <div className="rounded-[22px] bg-white p-4 shadow-[inset_0_0_0_1px_rgba(13,13,13,.06)] md:p-5" key={card.label}>
              <dt><Mono className="text-black/55">{card.label}</Mono></dt>
              <dd className="mt-2 font-display text-[36px] font-bold leading-none tracking-[-0.05em]">{card.value}</dd>
              {card.note && <dd className="mt-1 text-[12px] text-black/55">{card.note}</dd>}
            </div>
          ))}
        </dl>
        <div>
          <div aria-label="Delivery" aria-valuemax={100} aria-valuemin={0} aria-valuenow={share} className="h-2 overflow-hidden rounded-full bg-black/[0.07]" role="progressbar"><div className="h-2 rounded-full bg-[#0D0D0D] transition-[width] duration-700" style={{ width: `${share}%` }} /></div>
          <p className="mt-2 text-[14px] text-black/60" role="status">
            {going ? `Sending… ${done} of ${campaign.recipient_count}` : campaign.status === "sent" ? `Sent ${campaign.finished_at ? relativeTime(campaign.finished_at) : ""}` : "Delivery stopped. People who didn't get it are listed as failed."}
          </p>
          {stalled && <button className={`${lineButton} mt-3`} disabled={resuming} onClick={() => { setResuming(true); void post(`/api/audience/campaigns/${campaign.id}/send`).then(() => { setResuming(false); router.refresh(); }); }} type="button">{resuming ? "Resuming…" : "Resume sending"}</button>}
        </div>
        <p className="max-w-[60ch] text-[13px] leading-[1.5] text-black/55">Each address gets this once. Anyone who unsubscribed before their turn was skipped, and people who leave from this email are removed from {campaign.list_ids.length === 1 ? "the list" : "these lists"} for good.</p>
      </div>
      <aside className="min-w-0">
        <Mono className="mb-3 text-black/55">What went out</Mono>
        <EmailPreview body={campaign.body} lists={lists.filter((list) => campaign.list_ids.includes(list.id)).map((list) => list.title)} preheader={campaign.preheader} senderName={senderName} subject={campaign.subject} />
      </aside>
    </div>
  );
}
