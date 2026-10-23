import Link from "next/link";
import { AppPageHeader } from "@/components/app/page-header";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { StatusBadge } from "@/components/app/status-badge";
import type { ModeSlug } from "@/components/profile/types";
import { getViewerPlan } from "@/lib/app/viewer";
import { ROLE_LABEL, TEAMS_HREF, workspaceHref, type Membership } from "@/lib/business/team";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "../identity/actions";
import { Chevron, SettingsAppActions } from "./app-actions";

export const metadata = { title: "Settings" };

const MODES: { slug: ModeSlug; name: string; dot: string }[] = [
  { slug: "personal", name: "Personal", dot: "#FF5A4F" },
  { slug: "event", name: "Event", dot: "#C7FF4A" },
  { slug: "business", name: "Business", dot: "#AFCBFF" },
  { slug: "creator", name: "Creator", dot: "#E8A6FF" },
];
const PLAN_NAMES = { free: "Free", plus: "Setuvara Plus", pro: "Setuvara Pro" } as const;
const row = "flex min-h-[68px] w-full items-center justify-between gap-4 px-5 py-3 text-left transition-colors hover:bg-black/[0.025] focus-visible:bg-black/[0.03] focus-visible:outline-none [&:not(:first-child)]:border-t [&:not(:first-child)]:border-black/[0.07]";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: claims, error } = await supabase.auth.getClaims();
  const userId = typeof claims?.claims?.sub === "string" ? claims.claims.sub : null;
  if (error || !userId) redirect("/login?next=/app/settings");
  const [{ data: profile }, { data: modeRows }, billing, { data: auth }, { data: teamRows }] = await Promise.all([
    supabase.from("profiles").select("username, display_name, is_published").eq("id", userId).maybeSingle(),
    supabase.from("profile_modes").select("slug, is_enabled").eq("profile_id", userId),
    getViewerPlan(userId),
    supabase.auth.getUser(),
    supabase.rpc("my_business_teams"),
  ]);
  const teams = (Array.isArray(teamRows) ? teamRows : []) as Membership[];
  const plan = billing.plan;
  const modes = MODES.filter((mode) => modeRows?.some((item) => item.slug === mode.slug)).map((mode) => ({ ...mode, enabled: Boolean(modeRows?.find((item) => item.slug === mode.slug)?.is_enabled) }));

  return (
    <main className="mx-auto w-full max-w-[1080px] px-4 pb-10 pt-5 sm:px-6 md:px-8 md:pb-14 md:pt-10">
      <AppPageHeader eyebrow="Account" title="Settings" />

      <div className="mt-7 grid gap-5 md:mt-9 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-6">
        <Link className="group relative flex min-h-[176px] flex-col justify-between overflow-hidden rounded-[26px] bg-[#0d0d0d] p-6 text-[#f5f4ef] focus-visible:outline-2 focus-visible:outline-offset-2 lg:col-span-2 lg:min-h-[156px] lg:flex-row lg:items-end lg:p-8" href="/app/settings/billing">
          <span aria-hidden="true" className="pointer-events-none absolute -right-16 -top-24 size-72 rounded-full bg-[radial-gradient(circle,rgba(255,90,79,.38),rgba(255,90,79,0)_68%)]" />
          <span className="relative flex flex-col gap-2">
            <span className="font-label text-[10px] uppercase tracking-[0.16em] text-[#f5f4ef]/55">Your plan</span>
            <span className="flex items-center gap-2.5 font-display text-[30px] font-bold leading-none tracking-[-0.04em] md:text-[38px]">{plan !== "free" && <StatusBadge plan={plan} size={26} />}{PLAN_NAMES[plan]}</span>
            <span className="text-sm text-[#f5f4ef]/65">{profile?.display_name}{profile?.username ? ` · setuvara.com/${profile.username}` : ""}</span>
          </span>
          <span className="relative mt-5 inline-flex min-h-12 items-center self-start rounded-full bg-[#ff5a4f] px-5 text-[15px] font-semibold text-[#0d0d0d] transition-transform group-hover:-translate-y-0.5 lg:mt-0 lg:self-auto">{plan === "free" ? "See plans" : "Manage billing"}<span aria-hidden="true" className="ml-2">→</span></span>
        </Link>

        <Group title="Modes">
          {modes.map((mode) => (
            <Link className={row} href={`/app/identity?mode=${mode.slug}&section=settings`} key={mode.slug}>
              <span className="flex min-w-0 items-center gap-3.5">
                <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-[13px] bg-[#0d0d0d]"><span className="size-2.5 rounded-full" style={{ background: mode.dot }} /></span>
                <span className="min-w-0"><span className="block text-[15px] font-semibold">{mode.name} Mode</span><span className="mt-0.5 block text-[13px] text-black/55">{!mode.enabled ? "Off" : profile?.is_published ? "Live" : "On · profile is a draft"}</span></span>
              </span>
              <Chevron />
            </Link>
          ))}
        </Group>

        {teams.length > 0 && (
          <Group title="Teams">
            {teams.map((team) => (
              <Item description={`${ROLE_LABEL[team.role]}${team.open ? "" : " · paused"}`} href={team.open ? workspaceHref(team.business_id) : TEAMS_HREF} key={team.member_id} title={team.company || team.display_name} />
            ))}
          </Group>
        )}

        <Group title="Meeting people">
          <Item description="Name the moment for everyone you meet." href="/app/context" title="Live Context" />
          <Item description="Your QR, NFC tag and default Mode." href="/app/tap" title="Quick QR & Tap" />
          <Item description="What reaches your inbox." href="/app/settings/notifications" title="Email preferences" />
        </Group>

        <Group title="Account">
          <Item description={auth?.user?.email ?? "Your sign-in"} href="/app/settings/account" title="Email & password" />
          <Item description="Connected platforms, account deletion." href="/app/settings/privacy" title="Privacy & data" />
          {profile?.username && <Item description={`setuvara.com/${profile.username}`} external href={`/${profile.username}`} title="View public profile" />}
        </Group>

        <Group title="App">
          <SettingsAppActions rowClassName={row} />
          <form action={signOut}><button className={`${row} border-t border-black/[0.07] text-black/70`} type="submit"><span className="text-[15px] font-semibold">Sign out</span></button></form>
        </Group>
      </div>
    </main>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="flex flex-col gap-2.5">
      <h2 className="px-1 font-label text-[10px] font-bold uppercase tracking-[0.16em] text-black/45">{title}</h2>
      <div className="overflow-hidden rounded-[22px] bg-white shadow-[inset_0_0_0_1px_rgba(13,13,13,.08)]">{children}</div>
    </section>
  );
}

function Item({ title, description, href, external = false }: { title: string; description: string; href: string; external?: boolean }) {
  const body = (
    <>
      <span className="min-w-0"><span className="block text-[15px] font-semibold">{title}</span><span className="mt-0.5 block truncate text-[13px] text-black/55">{description}</span></span>
      {external ? <span aria-hidden="true" className="shrink-0 text-black/40">↗</span> : <Chevron />}
    </>
  );
  return external
    ? <a className={row} href={href} rel="noreferrer" target="_blank">{body}</a>
    : <Link className={row} href={href}>{body}</Link>;
}
