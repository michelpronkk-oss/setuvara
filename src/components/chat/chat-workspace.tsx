"use client";

import Link from "next/link";
import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent } from "react";

import { createClient } from "@/lib/supabase/client";
import { chatError, chatTime, type ChatInboxItem, type ChatMessage, type ChatTarget } from "@/lib/chat/types";

type Outgoing = { clientId: string; body: string; state: "sending" | "failed" };
type ReportReason = "harassment" | "spam" | "threat" | "impersonation" | "other";
const PAGE = 30;
const reasons: { value: ReportReason; label: string }[] = [
  { value: "harassment", label: "Harassment" }, { value: "spam", label: "Spam" },
  { value: "threat", label: "Threat" }, { value: "impersonation", label: "Impersonation" },
  { value: "other", label: "Something else" },
];

function initials(name: string) {
  const words = name.trim().split(/\s+/);
  return (words.length > 1 ? `${words[0][0]}${words.at(-1)?.[0] ?? ""}` : words[0]?.slice(0, 2) || "S").toUpperCase();
}

function dayLabel(value: string) {
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return new Intl.DateTimeFormat("en", { weekday: "short", day: "numeric", month: "short",
    ...(date.getFullYear() === today.getFullYear() ? {} : { year: "numeric" }) }).format(date);
}

function relativeTime(value: string) {
  const date = new Date(value);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return chatTime(value);
  return new Intl.DateTimeFormat("en", { day: "numeric", month: "short" }).format(date);
}

export function ChatWorkspace({ viewerId, initialConversationId, target }: {
  viewerId: string; initialConversationId: string | null; target: ChatTarget | null;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [selectedId, setSelectedId] = useState(initialConversationId);
  const [newTarget, setNewTarget] = useState(target);
  const [inbox, setInbox] = useState<ChatInboxItem[]>([]);
  const [selected, setSelected] = useState<ChatInboxItem | null>(null);
  const [inboxLoading, setInboxLoading] = useState(true);
  const [threadLoading, setThreadLoading] = useState(Boolean(initialConversationId));
  const [inboxMore, setInboxMore] = useState(false);
  const [historyMore, setHistoryMore] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [outgoing, setOutgoing] = useState<Outgoing | null>(null);
  const [notice, setNotice] = useState("");
  const [offline, setOffline] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [allowRequests, setAllowRequests] = useState(true);
  const [blockedIds, setBlockedIds] = useState<string[]>([]);
  const [blockedNames, setBlockedNames] = useState<Record<string, string>>({});
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [confirmBlock, setConfirmBlock] = useState(false);
  const [reportId, setReportId] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState<ReportReason>("harassment");
  const [reportDetails, setReportDetails] = useState("");
  const [reportBusy, setReportBusy] = useState(false);
  const [reportDone, setReportDone] = useState(false);
  const newestRef = useRef(0);
  const inboxRef = useRef(inbox);
  const scrollRef = useRef<HTMLDivElement>(null);
  // Follow the newest message only while the reader is already at the bottom;
  // loading earlier history keeps the reader's place.
  const stickRef = useRef(true);
  const prependRef = useRef<number | null>(null);
  const selectedRef = useRef(selectedId);
  useEffect(() => { inboxRef.current = inbox; }, [inbox]);
  useEffect(() => { selectedRef.current = selectedId; }, [selectedId]);

  const loadInbox = useCallback(async (older = false) => {
    const cursor = older ? inboxRef.current.at(-1) : null;
    const { data, error } = await supabase.rpc("chat_inbox", {
      p_limit: PAGE,
      p_before_at: cursor?.last_activity_at ?? null,
      p_before_id: cursor?.id ?? null,
    });
    if (error) { setNotice(chatError(error, "Your messages couldn’t load. Try again.")); setInboxLoading(false); return; }
    const rows = (data ?? []) as ChatInboxItem[];
    setInbox((previous) => older
      ? [...previous, ...rows.filter((row) => !previous.some((item) => item.id === row.id))]
      : rows);
    setInboxMore(rows.length === PAGE);
    if (!older && selectedRef.current) {
      const match = rows.find((row) => row.id === selectedRef.current);
      if (match) setSelected(match);
    }
    setInboxLoading(false);
  }, [supabase]);

  const loadOne = useCallback(async (id: string) => {
    const { data: row, error } = await supabase.from("chat_conversations")
      .select("id,user_low_id,user_high_id,user_low_name,user_high_name,requester_id,status,last_sequence,last_message_body,last_message_sender_id,last_activity_at")
      .eq("id", id).maybeSingle();
    if (error || !row || (row.user_low_id !== viewerId && row.user_high_id !== viewerId)) {
      setNotice("This conversation is unavailable."); setSelected(null); return;
    }
    const otherIsLow = row.user_high_id === viewerId;
    const { data: state } = await supabase.from("chat_participant_state")
      .select("unread_count").eq("conversation_id", id).eq("user_id", viewerId).maybeSingle();
    if (selectedRef.current !== id) return;
    setSelected({ id: row.id, other_user_id: otherIsLow ? row.user_low_id : row.user_high_id,
      other_name: otherIsLow ? row.user_low_name : row.user_high_name,
      requester_id: row.requester_id, status: row.status as ChatInboxItem["status"],
      last_sequence: row.last_sequence, last_message_body: row.last_message_body,
      last_message_sender_id: row.last_message_sender_id, last_activity_at: row.last_activity_at,
      unread_count: state?.unread_count ?? 0 });
  }, [supabase, viewerId]);

  const mergeMessages = useCallback((rows: ChatMessage[]) => {
    setMessages((previous) => {
      const all = new Map(previous.map((row) => [row.id, row]));
      rows.forEach((row) => all.set(row.id, row));
      return [...all.values()].sort((a, b) => a.sequence - b.sequence);
    });
    setOutgoing((previous) => previous && rows.some((row) => row.client_id === previous.clientId) ? null : previous);
    newestRef.current = Math.max(newestRef.current, ...rows.map((row) => row.sequence), 0);
  }, []);

  const markRead = useCallback(async (id: string, sequence: number) => {
    if (!sequence || document.visibilityState !== "visible") return;
    const { error } = await supabase.rpc("chat_mark_read", { p_conversation_id: id, p_through_sequence: sequence });
    if (error) return;
    setInbox((previous) => previous.map((row) => row.id === id && row.last_sequence <= sequence
      ? { ...row, unread_count: 0 } : row));
  }, [supabase]);

  const loadHistory = useCallback(async (id: string, before?: number) => {
    let query = supabase.from("chat_messages")
      .select("id,conversation_id,sequence,sender_id,client_id,body,is_request,created_at")
      .eq("conversation_id", id).order("sequence", { ascending: false }).limit(PAGE);
    if (before) query = query.lt("sequence", before);
    const { data, error } = await query;
    if (error) { setNotice("Messages couldn’t load. Try again."); setThreadLoading(false); return; }
    if (selectedRef.current !== id) return;
    const rows = ((data ?? []) as ChatMessage[]).reverse();
    if (before) prependRef.current = scrollRef.current?.scrollHeight ?? null;
    else stickRef.current = true;
    mergeMessages(rows);
    setHistoryMore(rows.length === PAGE);
    if (!before) {
      setThreadLoading(false);
      if (rows.length) void markRead(id, rows.at(-1)!.sequence);
    }
  }, [markRead, mergeMessages, supabase]);

  const resync = useCallback(async (id: string) => {
    let after = newestRef.current;
    // Keyset catch-up is authoritative; Realtime events only wake this fetch.
    for (;;) {
      const { data, error } = await supabase.from("chat_messages")
        .select("id,conversation_id,sequence,sender_id,client_id,body,is_request,created_at")
        .eq("conversation_id", id).gt("sequence", after)
        .order("sequence", { ascending: true }).limit(100);
      if (error) { setNotice("Message sync paused. Check your connection and try again."); return; }
      if (selectedRef.current !== id) return;
      const rows = (data ?? []) as ChatMessage[];
      if (!rows.length) break;
      mergeMessages(rows);
      after = rows.at(-1)!.sequence;
      if (rows.length < 100) break;
    }
    if (after) void markRead(id, after);
  }, [markRead, mergeMessages, supabase]);

  useLayoutEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    if (prependRef.current !== null) {
      element.scrollTop += element.scrollHeight - prependRef.current;
      prependRef.current = null;
    } else if (stickRef.current) element.scrollTop = element.scrollHeight;
  }, [messages, outgoing, threadLoading]);

  // Selection lives in the URL without a server round trip; Back and Forward restore it.
  useEffect(() => {
    const onPop = () => {
      const id = new URL(window.location.href).searchParams.get("conversation");
      if (id === selectedRef.current) return;
      selectedRef.current = id;
      setNotice(""); setOutgoing(null); setSelectedId(id); setNewTarget(null);
      setSelected(null); setMessages([]); setHistoryMore(false);
      setThreadLoading(Boolean(id)); newestRef.current = 0; stickRef.current = true;
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => { void loadInbox(); }, [loadInbox]);
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("chat_blocks").select("blocked_id").eq("blocker_id", viewerId);
      setBlockedIds((data ?? []).map((row) => row.blocked_id));
    };
    void load();
  }, [supabase, viewerId]);
  useEffect(() => {
    if (!selectedId) return;
    const timer = window.setTimeout(() => {
      void loadOne(selectedId);
      void loadHistory(selectedId);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [selectedId, loadHistory, loadOne]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const refresh = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        void loadInbox();
        if (selectedRef.current) { void loadOne(selectedRef.current); void resync(selectedRef.current); }
      }, 120);
    };
    const onOnline = () => { setOffline(false); refresh(); };
    const onOffline = () => setOffline(true);
    const onVisible = () => { if (document.visibilityState === "visible") refresh(); };
    queueMicrotask(() => setOffline(!navigator.onLine));
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    document.addEventListener("visibilitychange", onVisible);
    const channel = supabase.channel(`chat:${viewerId}:${crypto.randomUUID()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_conversations", filter: `user_low_id=eq.${viewerId}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_conversations", filter: `user_high_id=eq.${viewerId}` }, refresh)
      .subscribe((status) => { if (status === "SUBSCRIBED") refresh(); });
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      document.removeEventListener("visibilitychange", onVisible);
      if (timer) clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [loadInbox, loadOne, resync, supabase, viewerId]);

  useEffect(() => {
    const dialogName = reportId ? "report" : confirmBlock ? "block" : settingsOpen ? "settings" : null;
    if (!dialogName) return;
    const before = document.activeElement as HTMLElement | null;
    const dialog = document.querySelector<HTMLElement>(`[data-chat-dialog="${dialogName}"]`);
    const items = () => [...(dialog?.querySelectorAll<HTMLElement>("button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled)") ?? [])];
    items()[0]?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (reportId) setReportId(null); else if (confirmBlock) setConfirmBlock(false); else setSettingsOpen(false);
      }
      if (event.key !== "Tab") return;
      const focusable = items();
      if (!focusable.length) return;
      const first = focusable[0]; const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => { document.removeEventListener("keydown", onKeyDown); before?.focus(); };
  }, [confirmBlock, reportId, settingsOpen]);

  const goTo = (id: string | null) => {
    selectedRef.current = id;
    setNotice(""); setOutgoing(null); setSelectedId(id); setNewTarget(null);
    setSelected(null); setMessages([]); setHistoryMore(false);
    setThreadLoading(Boolean(id)); newestRef.current = 0; stickRef.current = true;
    window.history.pushState(null, "", id ? `/app/connections/messages?conversation=${id}` : "/app/connections/messages");
  };

  const send = async (body: string, clientId = crypto.randomUUID()) => {
    const text = body.trim();
    if (!text || text.length > 2000 || outgoing?.state === "sending") return;
    setNotice(""); setOutgoing({ clientId, body: text, state: "sending" }); setDraft("");
    stickRef.current = true;
    const result = selectedId && selected?.status === "accepted"
      ? await supabase.rpc("chat_send", { p_conversation_id: selectedId, p_client_id: clientId, p_body: text })
      : newTarget || (selected?.status === "declined" && selected.requester_id !== viewerId)
        ? await supabase.rpc("chat_start_request", {
          p_target_id: newTarget?.id ?? selected?.other_user_id,
          p_client_id: clientId, p_body: text,
        })
        : { data: null, error: { message: "chat_acceptance_required" } };
    if (result.error) {
      // A response can be lost after commit. Resolve the idempotency key before
      // telling the member to retry, so a delivered message never looks failed.
      const recovered = await supabase.from("chat_messages").select("conversation_id")
        .eq("sender_id", viewerId).eq("client_id", clientId).maybeSingle();
      if (recovered.data) {
        setOutgoing(null);
        if (recovered.data.conversation_id !== selectedId) goTo(recovered.data.conversation_id);
        else { await resync(recovered.data.conversation_id); void loadInbox(); }
        return;
      }
      setOutgoing({ clientId, body: text, state: "failed" }); setNotice(chatError(result.error)); return;
    }
    const nextId = (result.data as { conversation_id?: string } | null)?.conversation_id ?? selectedId;
    if (nextId && nextId !== selectedId) goTo(nextId);
    else if (nextId) { await resync(nextId); setOutgoing(null); void loadInbox(); }
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); void send(draft); };

  const decide = async (action: "accept" | "decline") => {
    if (!selectedId) return;
    setNotice("");
    const { error } = await supabase.rpc("chat_decide_request", { p_conversation_id: selectedId, p_action: action });
    if (error) { setNotice(chatError(error)); return; }
    if (action === "decline") goTo(null);
    else { await loadOne(selectedId); void loadInbox(); }
  };

  const hide = async () => {
    if (!selectedId) return;
    const { error } = await supabase.rpc("chat_hide", { p_conversation_id: selectedId });
    if (error) { setNotice(chatError(error)); return; }
    goTo(null); void loadInbox();
  };

  const block = async () => {
    if (!selected) return;
    const { error } = await supabase.rpc("chat_block", { p_user_id: selected.other_user_id });
    setConfirmBlock(false);
    if (error) { setNotice(chatError(error)); return; }
    setBlockedIds((previous) => [...new Set([...previous, selected.other_user_id])]);
    setNotice("Messaging with this person is blocked.");
  };

  const submitReport = async () => {
    if (!selectedId || !reportId) return;
    setReportBusy(true); setNotice("");
    const { error } = await supabase.rpc("chat_report", {
      p_conversation_id: selectedId, p_message_id: reportId,
      p_reason: reportReason, p_details: reportDetails.trim() || null,
    });
    setReportBusy(false);
    if (error) { setNotice(chatError(error, "Your report couldn’t be sent. Try again.")); return; }
    setReportDone(true); setReportId(null); setReportDetails("");
    window.setTimeout(() => setReportDone(false), 5000);
  };

  const openSettings = async () => {
    setSettingsOpen(true); setNotice("");
    const [{ data: pref }, { data: blocks }, { data: connections }] = await Promise.all([
      supabase.from("chat_preferences").select("allow_requests").eq("user_id", viewerId).maybeSingle(),
      supabase.from("chat_blocks").select("blocked_id").eq("blocker_id", viewerId),
      supabase.from("connections").select("user_id,connected_user_id,user_display_name_snapshot,connected_display_name_snapshot")
        .not("connected_user_id", "is", null).limit(500),
    ]);
    setAllowRequests(pref?.allow_requests ?? true);
    setBlockedIds((blocks ?? []).map((row) => row.blocked_id));
    const names: Record<string, string> = {};
    for (const row of connections ?? []) {
      if (row.user_id === viewerId && row.connected_user_id) names[row.connected_user_id] = row.connected_display_name_snapshot;
      if (row.connected_user_id === viewerId) names[row.user_id] = row.user_display_name_snapshot;
    }
    setBlockedNames(names);
  };

  const setRequests = async (next: boolean) => {
    setSettingsBusy(true);
    const { error } = await supabase.rpc("chat_set_requests_enabled", { p_enabled: next });
    setSettingsBusy(false);
    if (error) { setNotice(chatError(error)); return; }
    setAllowRequests(next);
  };

  const unblock = async (id: string) => {
    setSettingsBusy(true);
    const { error } = await supabase.rpc("chat_unblock", { p_user_id: id });
    setSettingsBusy(false);
    if (error) { setNotice(chatError(error)); return; }
    setBlockedIds((previous) => previous.filter((value) => value !== id));
  };

  const active = selected;
  const isRecipient = active?.status === "pending" && active.requester_id !== viewerId;
  const isSenderWaiting = active?.status === "pending" && active.requester_id === viewerId;
  const isBlockedByMe = Boolean(active && blockedIds.includes(active.other_user_id));
  const canCompose = Boolean(newTarget || (active?.status === "accepted" && !isBlockedByMe)
    || (active?.status === "declined" && active.requester_id !== viewerId && !isBlockedByMe));
  const showThread = Boolean(active || newTarget || selectedId);

  // The workspace fills the viewport under the app header so the composer is always on screen.
  // On phones an open conversation takes the whole height; the page heading belongs to the inbox.
  return <main className="mx-auto flex h-[calc(100dvh-60px)] w-full max-w-[1320px] flex-col px-0 text-[#0d0d0d] sm:px-5 sm:pb-6 md:h-[calc(100dvh-76px)] lg:px-8">
    <div className={`${showThread ? "hidden lg:flex" : "flex"} shrink-0 items-center justify-between px-5 pb-4 pt-5 sm:px-1 sm:pt-6`}>
      <div><Link className="font-label text-[11px] font-bold uppercase tracking-[0.18em] text-black/50 hover:text-black" href="/app/connections">← People</Link>
        <h1 className="mt-2 font-display text-[30px] font-bold tracking-[-0.055em] sm:text-[38px]">Messages<span className="text-[#ff5a4f]">.</span></h1>
        <p className="mt-1 text-[13px] text-black/50">A place to keep the conversation going.</p></div>
      <button className="min-h-11 rounded-full border border-black/15 bg-white px-4 text-[13px] font-semibold hover:border-black/40 focus-visible:outline-2" onClick={() => void openSettings()} type="button">Privacy</button>
    </div>
    {offline && <p className="mx-4 mb-3 rounded-xl bg-[#fff0e6] px-4 py-3 text-sm" role="status">You’re offline. Your messages will refresh when you reconnect.</p>}
    {notice && <p className="mx-4 mb-3 rounded-xl bg-white px-4 py-3 text-sm text-[#9f3b31]" role="alert">{notice}</p>}
    <div className={`grid min-h-[320px] flex-1 overflow-hidden border-black/10 bg-white sm:rounded-[28px] sm:border lg:grid-cols-[350px_minmax(0,1fr)] lg:shadow-[0_18px_60px_-45px_rgba(13,13,13,.45)] ${showThread ? "" : "border-t"}`} style={{ gridTemplateRows: "minmax(0,1fr)" }}>
      <aside aria-label="Conversations" className={`${showThread ? "hidden lg:flex" : "flex"} min-h-0 flex-col border-black/10 lg:border-r`}>
        <div className="flex items-center justify-between border-b border-black/10 px-5 py-5"><div><h2 className="font-display text-[18px] font-bold tracking-tight">Your inbox</h2><p className="mt-0.5 text-xs text-black/50">One inbox for every Mode</p></div><span className="rounded-full bg-[#c7ff4a] px-2.5 py-1 font-label text-[10px] font-bold uppercase tracking-wider">Connect</span></div>
        <div className="flex-1 divide-y divide-black/[0.07] overflow-y-auto">
          {inboxLoading && !inbox.length && <div className="px-5 py-8 text-sm text-black/45" role="status">Loading conversations…</div>}
          {!inboxLoading && !inbox.length && <div className="px-7 py-16 text-center"><div className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#f5f4ef] text-2xl">✦</div><p className="mt-5 font-display text-xl font-bold">Good conversations start somewhere.</p><p className="mt-2 text-sm leading-6 text-black/50">Open someone in People to send a thoughtful first message.</p><Link className="mt-5 inline-flex min-h-11 items-center rounded-full bg-[#0d0d0d] px-5 text-sm font-semibold text-white" href="/app/connections">Explore People →</Link></div>}
          {inbox.map((row) => <button aria-current={selectedId === row.id ? "page" : undefined} className={`flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-[#f5f4ef] focus-visible:outline-2 ${selectedId === row.id ? "bg-[#f5f4ef]" : ""}`} key={row.id} onClick={() => goTo(row.id)} type="button">
            <span aria-hidden="true" className="grid size-12 shrink-0 place-items-center rounded-[17px] bg-[#e8e6dd] font-display text-sm font-bold">{initials(row.other_name)}</span>
            <span className="min-w-0 flex-1"><span className="flex items-center justify-between gap-2"><span className="truncate text-[15px] font-semibold">{row.other_name}</span><time className="shrink-0 text-[11px] text-black/40" dateTime={row.last_activity_at}>{relativeTime(row.last_activity_at)}</time></span>
              <span className="mt-1 flex items-center gap-2 text-[12px] text-black/50"><span className="min-w-0 flex-1 truncate">{row.status === "pending" ? row.requester_id === viewerId ? "Request sent · " : "Message request · " : row.status === "declined" ? "Request declined · " : ""}{row.last_message_sender_id === viewerId ? "You: " : ""}{row.last_message_body}</span>{row.unread_count > 0 && <span className="grid min-w-5 place-items-center rounded-full bg-[#ff5a4f] px-1.5 py-0.5 text-[10px] font-bold text-white" aria-label={`${row.unread_count} unread`}>{row.unread_count}</span>}</span></span>
          </button>)}
          {inboxMore && <button className="w-full min-h-12 text-sm font-semibold text-black/60 hover:text-black" onClick={() => void loadInbox(true)} type="button">Load more conversations</button>}
        </div>
      </aside>
      <section aria-label={active ? `Conversation with ${active.other_name}` : "Message"} className={`${showThread ? "flex" : "hidden lg:flex"} min-h-0 min-w-0 flex-col bg-[#faf9f5]`}>
        {!showThread ? <div className="m-auto max-w-xs px-6 py-16 text-center"><div className="mx-auto grid size-16 place-items-center rounded-[20px] bg-[#c7ff4a] text-2xl">✦</div><h2 className="mt-6 font-display text-2xl font-bold tracking-tight">Stay connected.</h2><p className="mt-2 text-sm leading-6 text-black/50">Pick a conversation, or visit a Connection to start one.</p></div> : <>
          <div className="flex items-center gap-3 border-b border-black/10 bg-white px-4 py-3 sm:px-6"><button aria-label="Back to inbox" className="grid size-11 place-items-center rounded-full hover:bg-[#f5f4ef] focus-visible:outline-2 lg:hidden" onClick={() => goTo(null)} type="button">←</button><span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-[14px] bg-[#c7ff4a] font-display text-sm font-bold">{initials(active?.other_name ?? newTarget?.name ?? "S")}</span><div className="min-w-0 flex-1"><h2 className="truncate font-display text-[17px] font-bold tracking-tight">{active?.other_name ?? newTarget?.name}</h2><p className="text-[11px] text-black/45">{active?.status === "accepted" ? "Connected on Setuvara" : active?.status === "pending" ? "Message request" : "A Connection on Setuvara"}</p></div>{active && !isBlockedByMe && <button className="min-h-10 rounded-full px-2 text-[12px] font-semibold text-[#a43d33] hover:bg-[#fff0e6]" onClick={() => setConfirmBlock(true)} type="button">Block</button>}{active && active.status !== "pending" && <button className="min-h-10 rounded-full px-2 text-[12px] font-semibold text-black/55 hover:bg-[#f5f4ef]" onClick={() => void hide()} type="button">Hide</button>}</div>
          <div className="flex flex-1 flex-col overflow-y-auto overscroll-contain px-4 py-5 sm:px-8" onScroll={(event) => { const element = event.currentTarget; stickRef.current = element.scrollHeight - element.scrollTop - element.clientHeight < 120; }} ref={scrollRef}>
            {historyMore && <button className="mx-auto mb-5 min-h-10 rounded-full border border-black/10 bg-white px-4 text-xs font-semibold" onClick={() => { const first = messages[0]; if (first && selectedId) void loadHistory(selectedId, first.sequence); }} type="button">Earlier messages</button>}
            {threadLoading && <p className="text-center text-sm text-black/45" role="status">Loading messages…</p>}
            {newTarget && <div className="mx-auto mt-8 max-w-sm rounded-[24px] bg-white p-6 text-center shadow-[0_12px_40px_-30px_rgba(13,13,13,.3)]"><span className="font-label text-[10px] font-bold uppercase tracking-widest text-[#cc5147]">A thoughtful start</span><h3 className="mt-3 font-display text-xl font-bold">Say hello to {newTarget.name}.</h3><p className="mt-2 text-sm leading-6 text-black/55">Your first message arrives as a request. They choose whether to open the conversation.</p></div>}
            <ol className="mt-auto" aria-label="Message history">{messages.map((message, index) => <Fragment key={message.id}>{(index === 0 || new Date(messages[index - 1].created_at).toDateString() !== new Date(message.created_at).toDateString()) && <li className="flex justify-center pb-1 pt-4 first:pt-0"><span className="rounded-full bg-black/[0.05] px-3 py-1 font-label text-[10px] font-bold uppercase tracking-[0.14em] text-black/45">{dayLabel(message.created_at)}</span></li>}<li className={`group flex ${index && messages[index - 1].sender_id === message.sender_id ? "mt-1.5" : "mt-3"} ${message.sender_id === viewerId ? "justify-end" : "justify-start"}`}><div className={`max-w-[min(85%,470px)] rounded-[20px] px-4 py-3 ${message.sender_id === viewerId ? "rounded-br-[5px] bg-[#0d0d0d] text-white" : "rounded-bl-[5px] bg-white text-[#0d0d0d] shadow-[0_0_0_1px_rgba(13,13,13,.06)]"}`}><p className="whitespace-pre-wrap break-words text-[14px] leading-[22px]">{message.body}</p><div className={`mt-1.5 flex items-center justify-end gap-2 text-[10px] ${message.sender_id === viewerId ? "text-white/55" : "text-black/40"}`}><time dateTime={message.created_at}>{message.sender_id === viewerId ? "Sent · " : ""}{chatTime(message.created_at)}</time>{message.sender_id !== viewerId && <button className="rounded px-1 underline-offset-2 hover:underline focus-visible:outline-2" onClick={() => { setReportDone(false); setReportId(message.id); }} type="button">Report</button>}</div></div></li></Fragment>)}</ol>
            {outgoing && <div className="mt-3 flex justify-end"><div className="max-w-[85%] rounded-[20px] rounded-br-[5px] bg-[#0d0d0d]/75 px-4 py-3 text-white"><p className="whitespace-pre-wrap break-words text-sm">{outgoing.body}</p><div className="mt-2 flex items-center justify-end gap-3 text-[11px] text-white/70"><span>{outgoing.state === "sending" ? "Sending…" : "Failed to send"}</span>{outgoing.state === "failed" && <button className="font-semibold underline" onClick={() => void send(outgoing.body, outgoing.clientId)} type="button">Retry</button>}</div></div></div>}
          </div>
          {active && isRecipient && !isBlockedByMe && <div className="border-t border-black/10 bg-white px-5 py-5 sm:px-8"><p className="text-sm font-semibold">A message request from {active.other_name}</p><p className="mt-1 text-xs leading-5 text-black/55">Accept to reply. You can decline or block instead.</p><div className="mt-4 flex flex-wrap gap-2"><button className="min-h-11 rounded-full bg-[#0d0d0d] px-5 text-sm font-semibold text-white" onClick={() => void decide("accept")} type="button">Accept request</button><button className="min-h-11 rounded-full border border-black/15 px-5 text-sm font-semibold" onClick={() => void decide("decline")} type="button">Decline</button><button className="min-h-11 rounded-full px-4 text-sm font-semibold text-[#a43d33]" onClick={() => setConfirmBlock(true)} type="button">Block</button></div></div>}
          {active && isSenderWaiting && <p className="border-t border-black/10 bg-white px-5 py-5 text-center text-sm text-black/55">Your message is waiting for {active.other_name} to accept.</p>}
          {active?.status === "declined" && active.requester_id === viewerId && <p className="border-t border-black/10 bg-white px-5 py-5 text-center text-sm text-black/55">This request was declined. You can’t send another.</p>}
          {isBlockedByMe && <p className="border-t border-black/10 bg-white px-5 py-5 text-center text-sm text-black/55">You blocked messaging with this person. Manage blocked people in Privacy.</p>}
          {canCompose && <form className="border-t border-black/10 bg-white px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-3 sm:px-6" onSubmit={onSubmit}><label className="sr-only" htmlFor="chat-composer">{newTarget || active?.status !== "accepted" ? "First message" : "Message"}</label><div className="flex items-end gap-2 rounded-[22px] border border-black/15 bg-[#faf9f5] p-2 focus-within:border-black/50"><textarea className="max-h-36 min-h-11 flex-1 resize-none bg-transparent px-3 py-2.5 text-[14px] leading-5 outline-none placeholder:text-black/35" id="chat-composer" maxLength={2000} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(draft); } }} placeholder={newTarget || active?.status !== "accepted" ? "Write a thoughtful first message…" : "Write a message…"} rows={1} value={draft} /><button className="grid min-h-11 min-w-11 place-items-center rounded-[16px] bg-[#ff5a4f] text-white disabled:opacity-40" disabled={!draft.trim() || offline || outgoing?.state === "sending"} title="Send message" type="submit"><span className="sr-only">Send message</span>↗</button></div><div className="mt-1.5 flex items-center justify-between px-2 text-[10px] text-black/40"><span>{newTarget || active?.status !== "accepted" ? "They’ll choose whether to accept." : "Enter to send · Shift+Enter for a new line"}</span><span>{draft.length}/2000</span></div></form>}
        </>}
      </section>
    </div>
    {settingsOpen && <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-6" onClick={() => setSettingsOpen(false)} role="presentation"><section aria-labelledby="chat-privacy-title" aria-modal="true" className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-[28px] bg-[#f5f4ef] p-6 shadow-2xl sm:rounded-[28px]" data-chat-dialog="settings" onClick={(event) => event.stopPropagation()} role="dialog"><div className="flex items-center justify-between"><div><p className="font-label text-[10px] font-bold uppercase tracking-widest text-[#c74c42]">Account-wide</p><h2 className="mt-2 font-display text-2xl font-bold" id="chat-privacy-title">Messaging privacy</h2></div><button aria-label="Close privacy settings" className="grid size-11 place-items-center rounded-full bg-white" onClick={() => setSettingsOpen(false)} type="button">×</button></div><p className="mt-3 text-sm leading-6 text-black/55">These settings apply across every Setuvara Mode. A Connection can request a conversation; accepting is always your choice.</p><div className="mt-6 flex items-center justify-between gap-4 rounded-[20px] bg-white p-5"><div><p className="font-semibold">Message requests</p><p className="mt-1 text-xs leading-5 text-black/55">Allow registered Connections to send one first message.</p></div><button aria-checked={allowRequests} aria-label="Allow message requests" className={`h-8 w-14 shrink-0 rounded-full p-1 transition-colors ${allowRequests ? "bg-[#0d0d0d]" : "bg-black/20"}`} disabled={settingsBusy} onClick={() => void setRequests(!allowRequests)} role="switch" type="button"><span className={`block size-6 rounded-full bg-white transition-transform ${allowRequests ? "translate-x-6" : ""}`} /></button></div><h3 className="mt-7 font-display text-lg font-bold">Blocked people</h3>{blockedIds.length ? <ul className="mt-3 divide-y divide-black/10 rounded-[20px] bg-white px-4">{blockedIds.map((id) => <li className="flex items-center justify-between gap-3 py-3" key={id}><span className="truncate text-sm font-semibold">{blockedNames[id] ?? "Setuvara member"}</span><button className="min-h-10 rounded-full border border-black/15 px-3 text-xs font-semibold" disabled={settingsBusy} onClick={() => void unblock(id)} type="button">Unblock</button></li>)}</ul> : <p className="mt-2 text-sm text-black/50">No one blocked.</p>}<p className="mt-6 text-xs leading-5 text-black/45">Blocking stops messages and requests in both directions. It does not remove your Connection.</p></section></div>}
    {confirmBlock && active && <div className="fixed inset-0 z-[90] grid place-items-center bg-black/40 p-4"><section aria-labelledby="block-title" aria-modal="true" className="w-full max-w-sm rounded-[26px] bg-white p-6" data-chat-dialog="block" role="dialog"><h2 className="font-display text-xl font-bold" id="block-title">Block {active.other_name}?</h2><p className="mt-2 text-sm leading-6 text-black/55">Neither of you will be able to message or send a request. Your Connection remains.</p><div className="mt-6 flex justify-end gap-2"><button className="min-h-11 rounded-full px-4 text-sm font-semibold" onClick={() => setConfirmBlock(false)} type="button">Cancel</button><button className="min-h-11 rounded-full bg-[#0d0d0d] px-5 text-sm font-semibold text-white" onClick={() => void block()} type="button">Block</button></div></section></div>}
    {reportId && <div className="fixed inset-0 z-[90] grid place-items-center bg-black/40 p-4"><section aria-labelledby="report-title" aria-modal="true" className="w-full max-w-md rounded-[26px] bg-white p-6" data-chat-dialog="report" role="dialog"><h2 className="font-display text-xl font-bold" id="report-title">Report this message</h2><p className="mt-2 text-sm leading-6 text-black/55">A limited, authorized review team will see this message and nearby context.</p><label className="mt-5 block text-xs font-semibold" htmlFor="report-reason">Reason</label><select className="mt-2 min-h-11 w-full rounded-xl border border-black/15 px-3 text-sm" id="report-reason" onChange={(event) => setReportReason(event.target.value as ReportReason)} value={reportReason}>{reasons.map((reason) => <option key={reason.value} value={reason.value}>{reason.label}</option>)}</select><label className="mt-4 block text-xs font-semibold" htmlFor="report-details">Anything else? (optional)</label><textarea className="mt-2 min-h-24 w-full rounded-xl border border-black/15 p-3 text-sm" id="report-details" maxLength={1000} onChange={(event) => setReportDetails(event.target.value)} value={reportDetails} /><div className="mt-5 flex justify-end gap-2"><button className="min-h-11 rounded-full px-4 text-sm font-semibold" onClick={() => setReportId(null)} type="button">Cancel</button><button className="min-h-11 rounded-full bg-[#0d0d0d] px-5 text-sm font-semibold text-white disabled:opacity-50" disabled={reportBusy} onClick={() => void submitReport()} type="button">{reportBusy ? "Sending…" : "Send report"}</button></div></section></div>}
    {reportDone && <p aria-live="polite" className="fixed bottom-5 left-1/2 z-[91] -translate-x-1/2 rounded-full bg-[#0d0d0d] px-5 py-3 text-sm font-semibold text-white">Report received.</p>}
  </main>;
}
