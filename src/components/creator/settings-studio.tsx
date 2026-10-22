"use client";

import { toast } from "@/components/app/toast";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Toggle } from "@/app/app/identity/editor-ui";
import type { ProfileLink } from "@/components/profile/types";
import { CREATOR_SECTIONS, SECTION_NAMES, writeCreatorSettings, type CreatorSection, type CreatorSettings } from "@/lib/creator/studio";
import type { SocialAccount, SocialProvider } from "@/lib/social/model";
import { ConnectedAccounts } from "./connected-accounts";
import { createClient } from "@/lib/supabase/client";
import { useCreatorSwitch } from "./creator-switch";
import { inkButton } from "./studio-ui";

export type SettingsTab = "presentation" | "accounts" | "visibility";
const TABS: { id: SettingsTab; label: string }[] = [{ id: "presentation", label: "Presentation" }, { id: "accounts", label: "Connected accounts" }, { id: "visibility", label: "Visibility" }];

export function SettingsStudio({ tab, profileId, modeId, enabled, published, settings: initial, counts, links, socials, ready, notice }: {
  tab: SettingsTab;
  profileId: string;
  modeId: string;
  enabled: boolean;
  published: boolean;
  settings: CreatorSettings;
  counts: Record<CreatorSection, string>;
  links: ProfileLink[];
  socials: SocialAccount[];
  /** Platforms whose sign-in is configured and switched on. */
  ready: Record<SocialProvider, boolean>;
  /** The result of a sign-in that just returned. */
  notice: string | null;
}) {
  return (
    <div className="grid gap-6 md:grid-cols-[220px_minmax(0,1fr)] md:gap-10">
      <nav aria-label="Creator settings" className="-mx-3.5 flex gap-1 overflow-x-auto px-3.5 [scrollbar-width:none] md:mx-0 md:flex-col md:px-0">
        {TABS.map((item) => <Link aria-current={item.id === tab ? "page" : undefined} className={`inline-flex min-h-11 shrink-0 items-center rounded-[14px] px-3.5 text-[16px] ${item.id === tab ? "bg-white font-semibold shadow-[0_1px_0_rgba(13,13,13,.04)]" : "font-medium text-black/75 hover:bg-black/[0.04]"}`} href={`?tab=${item.id}`} key={item.id} scroll={false}>{item.label}</Link>)}
      </nav>
      <div className="min-w-0">
        {tab === "presentation" && <Presentation counts={counts} initial={initial} modeId={modeId} profileId={profileId} />}
        {tab === "accounts" && <ConnectedAccounts accounts={socials} links={links} notice={notice} profileId={profileId} ready={ready} />}
        {tab === "visibility" && <Visibility enabled={enabled} modeId={modeId} profileId={profileId} published={published} />}
      </div>
    </div>
  );
}

function PanelTitle({ children }: { children: string }) {
  return <h1 className="border-b-[1.5px] border-[#0D0D0D] pb-4 font-display text-[38px] font-bold leading-none tracking-[-0.05em] md:text-[44px]">{children}</h1>;
}

function Presentation({ initial, counts, profileId, modeId }: { initial: CreatorSettings; counts: Record<CreatorSection, string>; profileId: string; modeId: string }) {
  const router = useRouter();
  const [settings, setSettings] = useState(initial);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const order: CreatorSection[] = [...settings.sections, ...CREATOR_SECTIONS.filter((item) => !settings.sections.includes(item))];
  const dirty = JSON.stringify(settings) !== JSON.stringify(initial);

  function toggle(section: CreatorSection, on: boolean) {
    const visible = order.filter((item) => (item === section ? on : settings.sections.includes(item)));
    setSettings({ ...settings, sections: visible });
  }
  function move(section: CreatorSection, by: -1 | 1) {
    const next = [...order];
    const at = next.indexOf(section);
    const to = at + by;
    if (to < 0 || to >= next.length) return;
    [next[at], next[to]] = [next[to], next[at]];
    setSettings({ ...settings, sections: next.filter((item) => settings.sections.includes(item)) });
  }
  async function save() {
    setStatus("saving");
    const { error } = await createClient().from("profile_modes").update({ settings: writeCreatorSettings(settings) }).eq("id", modeId).eq("profile_id", profileId);
    if (error) { setStatus("error"); return; }
    setStatus("saved");
    toast("Settings saved");
    router.refresh();
  }

  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_300px] xl:gap-10">
      <div className="min-w-0">
        <PanelTitle>Presentation</PanelTitle>
        <section className="pt-6">
          <div className="mb-3 flex items-baseline justify-between gap-3"><h2 className="text-[17px] font-semibold">Sections, in order</h2><Link className="text-sm font-semibold text-black/60 hover:text-black" href="/app/identity?mode=creator&section=appearance">Page look is in Appearance ↗</Link></div>
          <ul className="divide-y divide-black/10 border-b border-black/10">
            {order.map((section, index) => {
              const on = settings.sections.includes(section);
              return (
                <li className={`flex items-center gap-3 py-2.5 ${on ? "" : "opacity-55"}`} key={section}>
                  <span className="flex flex-col">
                    <button aria-label={`Move ${SECTION_NAMES[section]} up`} className="grid h-5 w-8 place-items-center rounded text-black/45 hover:text-black disabled:opacity-25" disabled={index === 0} onClick={() => move(section, -1)} type="button">▲</button>
                    <button aria-label={`Move ${SECTION_NAMES[section]} down`} className="grid h-5 w-8 place-items-center rounded text-black/45 hover:text-black disabled:opacity-25" disabled={index === order.length - 1} onClick={() => move(section, 1)} type="button">▼</button>
                  </span>
                  <span className="min-w-0 flex-1"><span className="block text-[16px] font-semibold">{SECTION_NAMES[section]}</span><span className="block truncate text-[14px] text-black/60">{counts[section]}</span></span>
                  <Toggle label={`Show ${SECTION_NAMES[section]}`} on={on} onChange={(next) => toggle(section, next)} />
                </li>
              );
            })}
          </ul>
        </section>

        <div className="mt-8 flex items-center gap-3">
          <button className={inkButton} disabled={!dirty || status === "saving"} onClick={() => void save()} type="button">{status === "saving" ? "Saving…" : "Save"}</button>
          <span aria-live="polite" className="text-[14px] text-black/60">{status === "error" ? "Not saved. Try again." : status === "saved" && !dirty ? "Saved" : ""}</span>
        </div>
      </div>

      <aside className="flex h-fit flex-col gap-3 rounded-[22px] p-5 shadow-[inset_0_0_0_1.5px_rgba(13,13,13,.14)]">
        <h2 className="text-[17px] font-semibold">Actions</h2>
        <p className="text-[14px] leading-[1.5] text-black/65">Collaboration requests, giveaways, bookings and questions show in the Actions section, in the order you set there.</p>
        <Link className="text-[14px] font-semibold underline underline-offset-4" href="/app/identity/creator/actions">Open Actions</Link>
      </aside>
    </div>
  );
}

function Visibility({ enabled, published, modeId, profileId }: { enabled: boolean; published: boolean; modeId: string; profileId: string }) {
  const { busy, error, set } = useCreatorSwitch(modeId, profileId);
  const options = [
    { on: true, title: "Anyone with your link or QR", body: "Your Creator page opens from its private link. It never appears in search or on your username page." },
    { on: false, title: "Off", body: "The link and QR don’t open. Nothing is deleted." },
  ];
  return (
    <div className="max-w-[640px]">
      <PanelTitle>Visibility</PanelTitle>
      <h2 className="pt-6 text-[17px] font-semibold">Who can see Creator</h2>
      <div className="mt-3 grid gap-2" role="radiogroup">
        {options.map((option) => {
          const on = enabled === option.on;
          return (
            <button aria-checked={on} className="flex items-start gap-3 rounded-[18px] p-3.5 text-left hover:bg-black/[0.03] disabled:opacity-50" disabled={busy} key={option.title} onClick={() => void set(option.on)} role="radio" type="button">
              <span aria-hidden="true" className="mt-0.5 size-5 shrink-0 rounded-full" style={{ boxShadow: `inset 0 0 0 ${on ? 6 : 1.5}px #0D0D0D` }} />
              <span><span className="block text-[16px] font-semibold">{option.title}</span><span className="block text-[14px] leading-[1.45] text-black/60">{option.body}</span></span>
            </button>
          );
        })}
      </div>
      {!published && enabled && <p className="mt-3 rounded-2xl bg-[#FFE7B8] px-4 py-3 text-sm">Your identity isn’t published yet, so the page won’t open. Publish it from the Identity editor.</p>}
      {error && <p className="mt-3 text-sm font-medium text-[#B42318]" role="alert">{error}</p>}
      <p className="mt-6 text-[14px] leading-[1.5] text-black/60">Who can connect from your Creator page is set under Connection access in the <Link className="font-semibold underline underline-offset-4" href="/app/identity?mode=creator&section=settings">Identity editor</Link>.</p>
    </div>
  );
}
