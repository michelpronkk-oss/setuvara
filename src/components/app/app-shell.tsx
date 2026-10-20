"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";

import { MeetMark } from "@/components/marketing/brand";
import type { PlanCode } from "@/lib/billing/catalog";
import { DEFAULT_FOCUS, focusPosition, type PhotoFocus } from "@/components/profile/photo-focus";
import type { ModeSlug } from "@/components/profile/types";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n/provider";
import { FeedbackSheet } from "./feedback-sheet";
import { rememberedHomeMode, rememberHomeMode, subscribeHomeMode } from "./home/home-mode";
import { HomeScreenRuntime, HomeScreenSheet, useStandalone } from "./home-screen";
import { StatusBadge } from "./status-badge";

const navigation = [
  { href: "/app", labelKey: "home", shortKey: "home", icon: "home" },
  { href: "/app/identity", labelKey: "identity", shortKey: "identity", icon: "identity" },
  { href: "/app/wallet", labelKey: "wallet", shortKey: "wallet", icon: "wallet" },
  { href: "/app/analytics", labelKey: "analytics", shortKey: "analytics", icon: "analytics" },
  { href: "/app/connections", labelKey: "connections", shortKey: "people", icon: "people" },
  { href: "/app/passport", labelKey: "passport", shortKey: "passport", icon: "passport" },
] as const;
const settingsItem = { href: "/app/settings", labelKey: "settings", shortKey: "settings", icon: "settings" } as const;

type NavItem = (typeof navigation)[number] | typeof settingsItem;
type NavIconName = NavItem["icon"];
export type ShellMode = { slug: ModeSlug; enabled: boolean };

// 24px line icons, 1.8 stroke, round joins. The current destination lights its icon coral.
const navIcons: Record<NavIconName, ReactNode> = {
  home: <path d="M4 10.4 12 4l8 6.4V19a1 1 0 0 1-1 1h-4.25v-5.25h-5.5V20H5a1 1 0 0 1-1-1v-8.6Z" />,
  identity: <><rect height="14" rx="2.75" width="18" x="3" y="5" /><circle cx="9" cy="10.6" r="2.2" /><path d="M5.9 16.2c.6-1.5 1.75-2.3 3.1-2.3s2.5.8 3.1 2.3M14.6 10h4M14.6 13.4h2.8" /></>,
  wallet: <><path d="M4 7.6A2.6 2.6 0 0 1 6.6 5H17v3" /><path d="M4 7.6V17a2 2 0 0 0 2 2h13a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1H6.6A2.6 2.6 0 0 1 4 7.6Z" /><circle cx="16.3" cy="13.5" fill="currentColor" r="1.1" stroke="none" /></>,
  analytics: <path d="M5 20v-5.5M10 20V9M15 20v-7.5M20 20V4.5" />,
  people: <><circle cx="9" cy="8.4" r="3.2" /><path d="M3.4 19.4c.7-3.1 2.9-4.9 5.6-4.9s4.9 1.8 5.6 4.9" /><path d="M15.4 5.4a3 3 0 0 1 0 5.9M17.2 14.6c1.8.5 3 2 3.4 4.4" /></>,
  passport: <><rect height="18" rx="2.5" width="14" x="5" y="3" /><circle cx="12" cy="10" r="3" /><path d="M9.5 16.6h5" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 13.5a7.6 7.6 0 0 0 0-3l2-1.6-2-3.4-2.4 1a7.7 7.7 0 0 0-2.6-1.5L14 2.5h-4l-.4 2.5A7.7 7.7 0 0 0 7 6.5l-2.4-1-2 3.4 2 1.6a7.6 7.6 0 0 0 0 3l-2 1.6 2 3.4 2.4-1a7.7 7.7 0 0 0 2.6 1.5l.4 2.5h4l.4-2.5a7.7 7.7 0 0 0 2.6-1.5l2.4 1 2-3.4-2-1.6Z" /></>,
};

function NavIcon({ name, className = "size-[21px]" }: { name: NavIconName; className?: string }) {
  return <svg aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24">{navIcons[name]}</svg>;
}

const MODE_NAMES: Record<ModeSlug, string> = { personal: "Personal", event: "Event", business: "Business", creator: "Creator" };
const MODE_DOT: Record<ModeSlug, string> = { personal: "#FF5A4F", event: "#C7FF4A", business: "#AFCBFF", creator: "#E8A6FF" };
const noSubscription = () => () => {};

// Unread messages across the account inbox. Conversation changes wake a recount;
// the count itself always comes from the database.
function useChatUnread(enabled: boolean, pathname: string) {
  const [count, setCount] = useState(0);
  const supabase = useMemo(() => (enabled ? createClient() : null), [enabled]);
  const refresh = useCallback(async () => {
    if (!supabase) return;
    const { data, error } = await supabase.rpc("chat_unread_total");
    if (!error && typeof data === "number") setCount(data);
  }, [supabase]);
  useEffect(() => { queueMicrotask(() => void refresh()); }, [refresh, pathname]);
  useEffect(() => {
    if (!supabase) return;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const wake = () => { if (timer) clearTimeout(timer); timer = setTimeout(() => void refresh(), 400); };
    const onVisible = () => { if (document.visibilityState === "visible") wake(); };
    void supabase.auth.getClaims().then(({ data }) => {
      const id = typeof data?.claims?.sub === "string" ? data.claims.sub : null;
      if (!id) return;
      channel = supabase.channel(`chat-unread:${id}:${crypto.randomUUID()}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "chat_conversations", filter: `user_low_id=eq.${id}` }, wake)
        .on("postgres_changes", { event: "*", schema: "public", table: "chat_conversations", filter: `user_high_id=eq.${id}` }, wake)
        .subscribe();
    });
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      if (timer) clearTimeout(timer);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [refresh, supabase]);
  return count;
}

export function AppShell({ children, displayName, username, avatarUrl, avatarFocus, plan, publicProfileUrl, signOut, walletPubliclyLaunched, chatEnabled = false, modes = [], isPublished = false }: {
  children: ReactNode;
  displayName: string;
  username: string | null;
  avatarUrl: string | null;
  avatarFocus?: PhotoFocus;
  plan: PlanCode;
  publicProfileUrl: string | null;
  signOut: () => Promise<void>;
  walletPubliclyLaunched: boolean;
  chatEnabled?: boolean;
  /** Every Mode on the account, in profile order, for the sidebar's Mode switcher. */
  modes?: ShellMode[];
  isPublished?: boolean;
}) {
  const pathname = usePathname();
  const unread = useChatUnread(chatEnabled, pathname);
  // Any in-app link: the destination tab lights up at once and a thin line runs along the top until
  // the next page commits, so a slow server response never reads as a frozen app.
  const [pending, setPending] = useState<{ path: string; from: string } | null>(null);
  const pendingPath = pending && pending.from === pathname ? pending.path : null;
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest?.("a[href]");
      if (!(anchor instanceof HTMLAnchorElement) || (anchor.target && anchor.target !== "_self") || anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin || !url.pathname.startsWith("/app") || url.pathname === window.location.pathname) return;
      setPending({ path: url.pathname, from: window.location.pathname });
    };
    // Capture phase: next/link prevents the default, and a closing menu may unmount the link.
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);
  useEffect(() => {
    if (!pendingPath) return;
    const timeout = window.setTimeout(() => setPending(null), 10000);
    return () => window.clearTimeout(timeout);
  }, [pendingPath]);
  const visibleNavigation = walletPubliclyLaunched ? navigation : navigation.filter((item) => item.href !== "/app/wallet");
  const messagesSurface = pathname.startsWith("/app/connections/messages");
  // The identity editor is a full-screen workspace with its own navigation. The Creator studio
  // lives inside Identity but keeps the app chrome, like the rest of /app.
  if (pathname === "/app/identity" || (pathname.startsWith("/app/identity/") && !pathname.startsWith("/app/identity/creator"))) return <div lang="en"><HomeScreenRuntime />{children}</div>;

  const account = { avatarFocus, avatarUrl, displayName, plan, publicProfileUrl, signOut, username };
  return (
    <div className="min-h-dvh bg-[#f5f4ef] font-brand text-[#0d0d0d]" lang="en">
      <HomeScreenRuntime />
      <a className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[80] focus:rounded-full focus:bg-[#0d0d0d] focus:px-4 focus:py-2 focus:text-white" href="#app-main">Skip to content</a>

      {/* Tablet and desktop: a dark sidebar. An icon rail on tablets and small laptops, the full menu from 1280px. */}
      <aside aria-label="Setuvara" className="fixed inset-y-3 left-3 z-40 hidden w-[80px] flex-col rounded-[26px] bg-[#0d0d0d] text-[#f5f4ef] shadow-[0_30px_60px_-34px_rgba(13,13,13,.8)] md:flex xl:w-[256px]">
        <Link aria-label="Setuvara Home" className="mx-3 mt-3 flex h-[60px] items-center justify-center gap-2.5 rounded-[16px] focus-visible:outline-2 xl:justify-start xl:px-3.5" href="/app">
          <MeetMark className="size-[26px] shrink-0" />
          <span className="hidden font-display text-[22px] font-bold tracking-[-0.04em] xl:inline">setuvara</span>
        </Link>
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-3 pb-4 pt-4 [scrollbar-width:none] xl:pt-5">
          <nav aria-label="Main navigation" className="flex flex-col gap-1">
            {visibleNavigation.map((item) => <SideLink item={item} key={item.href} pathname={pathname} pendingPath={pendingPath} unread={item.href === "/app/connections" ? unread : 0} />)}
          </nav>
          {modes.length > 0 && <SideModes isPublished={isPublished} modes={modes} pathname={pathname} />}
        </div>
        {/* Outside the scrolling list, so the account menu can open over the page. */}
        <div className="flex flex-col gap-1 px-3 pb-3">
          <SideLink item={settingsItem} pathname={pathname} pendingPath={pendingPath} />
          <div aria-hidden="true" className="mx-2 my-2 h-px bg-white/[0.08]" />
          <AccountMenu {...account} placement="sidebar" />
        </div>
      </aside>

      {/* Phone: slim top bar with the mark and account; the destinations live in the tab bar below. */}
      <header className="sticky top-0 z-40 flex h-[60px] items-center justify-between bg-[#f5f4ef]/95 px-4 backdrop-blur-sm md:hidden">
        <Link aria-label="Setuvara Home" className="flex min-h-11 items-center gap-2.5 rounded-full focus-visible:outline-2" href="/app">
          <MeetMark className="size-[22px]" />
          <span className="font-display text-[19px] font-bold tracking-[-0.03em]">setuvara</span>
        </Link>
        <AccountMenu {...account} placement="header" />
      </header>
      {pendingPath && <span aria-hidden="true" className="sv-nav-progress pointer-events-none fixed inset-x-0 top-[58px] z-50 h-[2px] bg-[#ff5a4f] md:left-[92px] md:top-0 xl:left-[268px]" key={pendingPath} />}

      <div className={`min-w-0 md:pb-0 md:pl-[92px] xl:pl-[268px] ${messagesSurface ? "" : "pb-[calc(78px+env(safe-area-inset-bottom))]"}`} id="app-main" tabIndex={-1}>{children}</div>

      {!messagesSurface && <nav aria-label="Main navigation" className="fixed inset-x-0 bottom-0 z-40 grid rounded-t-[24px] bg-[#0d0d0d] px-1.5 pb-[env(safe-area-inset-bottom)] pt-1 text-[#f5f4ef] shadow-[0_-14px_34px_-20px_rgba(13,13,13,.6)] sm:px-3 md:hidden" style={{ gridTemplateColumns: `repeat(${visibleNavigation.length}, minmax(0, 1fr))` }}>
        {visibleNavigation.map((item) => <TabLink item={item} key={item.href} pathname={pathname} pendingPath={pendingPath} unread={item.href === "/app/connections" ? unread : 0} />)}
      </nav>}
    </div>
  );
}

function UnreadDot({ count, className }: { count: number; className: string }) {
  if (!count) return null;
  return <span aria-hidden="true" className={`pointer-events-none absolute grid h-[17px] min-w-[17px] place-items-center rounded-full bg-[#ff5a4f] px-1 text-[10px] font-bold leading-none text-white ring-2 ring-[#0d0d0d] ${className}`}>{count > 99 ? "99+" : count}</span>;
}

function unreadText(unread: number) {
  return unread ? `, ${unread} unread ${unread === 1 ? "message" : "messages"}` : "";
}

function TabLink({ item, pathname, pendingPath, unread = 0 }: { item: NavItem; pathname: string; pendingPath: string | null; unread?: number }) {
  const { messages } = useI18n();
  const unreadLabel = unreadText(unread);
  // While a tab is loading it already reads as the current one.
  const active = isActive(pendingPath ?? pathname, item.href);
  return (
    <Link aria-current={isActive(pathname, item.href) ? "page" : undefined} className={`flex min-h-[64px] min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-0.5 text-[10.5px] leading-none tracking-[-0.005em] focus-visible:outline-2 sm:text-[12px] ${active ? "font-semibold text-[#f5f4ef]" : "font-medium text-[#f5f4ef]/55"}`} href={item.href}>
      <span className={`relative grid h-8 w-12 place-items-center rounded-full transition-[background-color,color,transform] duration-200 ease-out active:scale-90 ${active ? "bg-white/[0.1] text-[#ff5a4f]" : "text-[#f5f4ef]/65"}`}><NavIcon name={item.icon} /><UnreadDot className="-right-0.5 -top-1" count={unread} /></span>
      <span className="max-w-full truncate">{messages.common[item.shortKey]}{unreadLabel && <span className="sr-only">{unreadLabel}</span>}</span>
    </Link>
  );
}

function SideLink({ item, pathname, pendingPath, unread = 0 }: { item: NavItem; pathname: string; pendingPath: string | null; unread?: number }) {
  const { messages } = useI18n();
  const unreadLabel = unreadText(unread);
  const active = isActive(pendingPath ?? pathname, item.href);
  const label = messages.common[item.labelKey];
  return (
    <Link aria-current={isActive(pathname, item.href) ? "page" : undefined} className={`group relative flex min-h-[58px] flex-col items-center justify-center gap-1 rounded-[16px] text-[10.5px] leading-none transition-colors focus-visible:outline-2 xl:min-h-12 xl:flex-row xl:justify-start xl:gap-3.5 xl:px-3.5 xl:text-[15px] ${active ? "bg-white/[0.08] font-semibold text-[#f5f4ef]" : "font-medium text-[#f5f4ef]/60 hover:bg-white/[0.04] hover:text-[#f5f4ef]"}`} href={item.href} title={label}>
      <span className={`relative transition-colors ${active ? "text-[#ff5a4f]" : ""}`}><NavIcon name={item.icon} /><UnreadDot className="-right-2 -top-1.5 xl:hidden" count={unread} /></span>
      <span className="max-w-full truncate px-1 xl:px-0"><span className="xl:hidden">{messages.common[item.shortKey]}</span><span className="hidden xl:inline">{label}</span>{unreadLabel && <span className="sr-only">{unreadLabel}</span>}</span>
      {unread > 0 && <span aria-hidden="true" className="ml-auto hidden h-5 min-w-5 place-items-center rounded-full bg-[#ff5a4f] px-1.5 text-[11px] font-bold leading-none text-white xl:grid">{unread > 99 ? "99+" : unread}</span>}
    </Link>
  );
}

// Every Mode at a glance: colour, name and whether it opens publicly. Picking one shows it on Home.
function SideModes({ modes, isPublished, pathname }: { modes: ShellMode[]; isPublished: boolean; pathname: string }) {
  const params = useSearchParams();
  const saved = useSyncExternalStore(subscribeHomeMode, rememberedHomeMode, () => null);
  const hydrated = useSyncExternalStore(noSubscription, () => true, () => false);
  const onHome = pathname === "/app";
  const current: ModeSlug | null = !onHome || !hydrated ? null : params.get("mode") === "creator" ? "creator" : saved ?? "personal";
  return (
    <section aria-labelledby="sv-side-modes" className="mt-7 hidden xl:block">
      <div className="mb-2 flex items-center justify-between px-3.5">
        <h2 className="font-label text-[10px] uppercase tracking-[0.16em] text-[#f5f4ef]/40" id="sv-side-modes">Modes</h2>
        {!isPublished && <span className="font-label text-[10px] uppercase tracking-[0.12em] text-[#ff5a4f]">Draft</span>}
      </div>
      <ul className="flex flex-col gap-0.5">
        {modes.map((mode) => {
          const live = isPublished && mode.enabled;
          const href = mode.slug === "creator" ? (mode.enabled ? "/app?mode=creator" : "/app/identity?mode=creator&section=profile") : `/app?mode=${mode.slug}`;
          const on = current === mode.slug;
          return (
            <li key={mode.slug}>
              <Link aria-current={on ? "true" : undefined} className={`flex min-h-11 items-center gap-3 rounded-[14px] px-3.5 text-[14px] transition-colors focus-visible:outline-2 ${on ? "bg-white/[0.06] font-semibold text-[#f5f4ef]" : "font-medium text-[#f5f4ef]/70 hover:bg-white/[0.04] hover:text-[#f5f4ef]"}`} href={href} onClick={() => { if (mode.slug !== "creator") rememberHomeMode(mode.slug); }}>
                <span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ background: MODE_DOT[mode.slug], opacity: mode.enabled ? 1 : 0.35 }} />
                <span className="min-w-0 flex-1 truncate">{MODE_NAMES[mode.slug]}</span>
                <span className={`font-label text-[10px] uppercase tracking-[0.12em] ${live ? "text-[#c7ff4a]" : "text-[#f5f4ef]/35"}`}>{live ? "Live" : mode.enabled ? "Private" : "Off"}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function AccountMenu({ displayName, username, avatarUrl, avatarFocus, plan, publicProfileUrl, signOut, placement }: {
  displayName: string; username: string | null; avatarUrl: string | null; avatarFocus?: PhotoFocus; plan: PlanCode; publicProfileUrl: string | null; signOut: () => Promise<void>;
  /** header: phone top bar, opens down. sidebar: foot of the sidebar, opens up (beside the rail on tablets). */
  placement: "header" | "sidebar";
}) {
  const [open, setOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [homeScreenOpen, setHomeScreenOpen] = useState(false);
  const standalone = useStandalone();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const planName = plan === "pro" ? "Setuvara Pro" : plan === "plus" ? "Setuvara Plus" : "Free";
  const { messages } = useI18n();

  useEffect(() => {
    if (!open) return;
    const items = () => [...(root.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled)') ?? [])];
    items()[0]?.focus();
    const onDown = (event: MouseEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); setOpen(false); trigger.current?.focus(); }
      if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key) || !root.current?.contains(document.activeElement)) return;
      event.preventDefault();
      const entries = items(); const index = entries.indexOf(document.activeElement as HTMLElement);
      const target = event.key === "Home" ? 0 : event.key === "End" ? entries.length - 1 : (index + (event.key === "ArrowDown" ? 1 : entries.length - 1)) % entries.length;
      entries[target]?.focus();
    };
    const onFocus = (event: FocusEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    document.addEventListener("focusin", onFocus);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); document.removeEventListener("focusin", onFocus); };
  }, [open]);

  const closeFeedback = useCallback(() => { setFeedbackOpen(false); trigger.current?.focus(); }, []);
  const closeHomeScreen = useCallback(() => { setHomeScreenOpen(false); trigger.current?.focus(); }, []);

  const item = "flex min-h-[46px] w-full items-center justify-between rounded-xl px-3.5 text-left text-[15px] font-medium hover:bg-[#f5f4ef] focus-visible:bg-[#f5f4ef] focus-visible:outline-none";
  return (
    <div className="relative" ref={root}>
      {placement === "sidebar" ? (
        <button aria-controls={open ? menuId : undefined} aria-expanded={open} aria-haspopup="menu" aria-label="Account menu" className={`flex min-h-[58px] w-full items-center justify-center gap-3 rounded-[16px] p-1.5 text-left text-[#f5f4ef] transition-colors focus-visible:outline-2 xl:justify-start xl:p-2 ${open ? "bg-white/[0.1]" : "hover:bg-white/[0.05]"}`} onClick={() => setOpen((value) => !value)} ref={trigger} type="button">
          <Avatar focus={avatarFocus} name={displayName} ring size="size-10" url={avatarUrl} />
          <span className="hidden min-w-0 flex-1 flex-col xl:flex">
            <span className="truncate text-sm font-semibold">{displayName}</span>
            <span className="mt-0.5 flex items-center gap-1.5 text-xs text-[#f5f4ef]/55">{plan !== "free" && <StatusBadge plan={plan} size={13} />}{planName}</span>
          </span>
          <svg aria-hidden="true" className="hidden shrink-0 text-[#f5f4ef]/50 xl:block" fill="none" height="14" stroke="currentColor" strokeLinecap="round" strokeWidth="1.6" viewBox="0 0 14 14" width="14"><path d="M4 5.5 7 2.5l3 3M4 8.5l3 3 3-3" /></svg>
        </button>
      ) : (
        <button aria-controls={open ? menuId : undefined} aria-expanded={open} aria-haspopup="menu" aria-label="Account menu" className={`flex min-h-11 items-center rounded-full p-1 focus-visible:outline-2 ${open ? "bg-black/[0.06]" : "hover:bg-black/[0.04]"}`} onClick={() => setOpen((value) => !value)} ref={trigger} type="button">
          <Avatar focus={avatarFocus} name={displayName} size="size-9" url={avatarUrl} />
        </button>
      )}
      {open && (
        <div aria-label="Account" className={`absolute z-50 flex ${placement === "sidebar" ? "bottom-0 left-[calc(100%+14px)] max-h-[calc(100dvh-48px)] xl:bottom-[calc(100%+8px)] xl:left-0" : "right-0 top-[calc(100%+8px)] max-h-[calc(100dvh-96px)]"} w-[min(316px,calc(100vw-32px))] flex-col overflow-y-auto rounded-[22px] bg-white p-2 text-[#0d0d0d] shadow-[0_24px_60px_-20px_rgba(13,13,13,.35),0_0_0_1px_rgba(13,13,13,.08)] [animation:fade-in_120ms_ease-out]`} id={menuId} onClick={(event) => { if ((event.target as Element).closest("a")) setOpen(false); }} role="menu">
          <div className="flex items-center gap-3 px-3 pb-4 pt-3.5">
            <Avatar focus={avatarFocus} name={displayName} size="size-12" url={avatarUrl} />
            <div className="min-w-0"><p className="truncate text-base font-semibold">{displayName}</p>{username && <p className="truncate font-label text-xs text-black/65">setuvara.com/{username}</p>}</div>
          </div>
          {/* Billing: current plan at a glance; the page holds upgrade, plan changes and the payment portal. */}
          <Link className="mx-1 mb-1.5 flex min-h-[58px] items-center justify-between gap-3 rounded-[14px] bg-[#f5f4ef] px-3.5 py-2.5 hover:bg-[#ecebe4] focus-visible:bg-[#ecebe4] focus-visible:outline-none" href="/app/settings/billing" role="menuitem">
            <span className="flex min-w-0 flex-col">
              <span className="font-label text-[10px] uppercase tracking-[0.14em] text-black/55">{messages.common.billing}</span>
              <span className="mt-0.5 flex items-center gap-2 text-sm font-semibold"><StatusBadge plan={plan} size={16} />{planName}</span>
            </span>
            <span className="shrink-0 text-[13px] font-semibold text-black/70">{plan === "free" ? messages.common.upgrade : messages.common.manageBilling}<span aria-hidden="true"> →</span></span>
          </Link>
          <Link className={item} href="/app/settings" role="menuitem">{messages.common.settings}</Link>
          <Link className={item} href="/app/context" role="menuitem">{messages.common.liveContext}</Link>
          {publicProfileUrl && <a className={item} href={publicProfileUrl} rel="noreferrer" role="menuitem" target="_blank">{messages.common.viewProfile}<span aria-hidden="true" className="text-black/50">↗</span></a>}
          <Link className={item} href="/app/identity?mode=personal&section=settings" role="menuitem">{messages.common.modeSettings}</Link>
          <Link className={item} href="/app/settings/notifications" role="menuitem">{messages.common.emailPreferences}</Link>
          <Link className={item} href="/app/settings/privacy" role="menuitem">Privacy &amp; data</Link>
          <button className={item} onClick={() => { setOpen(false); setHomeScreenOpen(true); }} role="menuitem" type="button">{standalone ? "Home Screen app" : "Add to Home Screen"}</button>
          <button className={item} onClick={() => { setOpen(false); setFeedbackOpen(true); }} role="menuitem" type="button">Send feedback</button>
          <div className="mx-2.5 my-1.5 h-px bg-black/[0.08]" />
          <form action={signOut}><button className={`${item} text-black/70`} role="menuitem" type="submit">{messages.common.signOut}</button></form>
        </div>
      )}
      {feedbackOpen && <FeedbackSheet onClose={closeFeedback} />}
      {homeScreenOpen && <HomeScreenSheet onClose={closeHomeScreen} />}
    </div>
  );
}

export function Avatar({ url, name, size, focus, ring = false }: { url: string | null; name: string; size: string; focus?: PhotoFocus; ring?: boolean }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const initial = name.trim().slice(0, 1).toUpperCase() || "S";
  return (
    <span aria-hidden="true" className={`relative grid ${size} shrink-0 place-items-center overflow-hidden rounded-full ${ring ? "bg-[#26262a] ring-1 ring-white/15" : "bg-[#0d0d0d]"} text-sm font-semibold text-[#f5f4ef]`}>
      {initial}
      {/* eslint-disable-next-line @next/next/no-img-element -- signed Supabase URL, already resized */}
      {url && url !== failedUrl && <img alt="" className="absolute inset-0 size-full object-cover" decoding="async" onError={() => setFailedUrl(url)} src={url} style={{ objectPosition: focusPosition(focus ?? DEFAULT_FOCUS, 1) }} />}
    </span>
  );
}

function isActive(pathname: string, href: string) {
  return href === "/app" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}
