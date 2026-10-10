"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { createClient } from "@/lib/supabase/client";
import { MILESTONES, PASSPORT_REWARDS, type RewardCategory } from "@/lib/passport/rewards";
import type { PlanCode } from "@/lib/billing/catalog";
import { hasCapability } from "@/lib/billing/capabilities";

type MilestoneRecord = { threshold: number; unlockedAt: string; seenAt: string | null };
type StampRecord = { id: string; type: "milestone" | "event" | "city" | "country"; title: string; subtitle: string | null; countryCode: string | null; earnedAt: string };
export type PassportData = {
  connectionCount: number; cities: number; events: number; countries: number;
  milestones: MilestoneRecord[]; rewards: { id: string; unlockedAt: string }[]; stamps: StampRecord[]; preferences: Partial<Record<RewardCategory, string>>;
};

const categoryNames: Record<RewardCategory, string> = { profile_treatment: "Profile treatment", accent: "Profile accent", share_treatment: "Share treatment", qr_frame: "QR frame", passport_cover: "Passport cover", passport_stamp_style: "Stamp style", profile_mark: "Profile mark" };
const nextMilestone = (count: number) => MILESTONES.find((item) => item.threshold > count);

export function PassportDashboard({ initialData, username, displayName, publicOrigin, plan }: { initialData: PassportData; username: string; displayName: string; publicOrigin: string; plan: PlanCode }) {
  const [data, setData] = useState(initialData);
  const [pending, setPending] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const next = nextMilestone(data.connectionCount);
  const currentThreshold = [...MILESTONES].reverse().find((item) => item.threshold <= data.connectionCount)?.threshold ?? 0;
  const progress = next ? Math.min(100, ((data.connectionCount - currentThreshold) / (next.threshold - currentThreshold)) * 100) : 100;
  const unlocked = new Set(data.rewards.map((reward) => reward.id));
  const passportCoverClass = data.preferences.passport_cover === "paper_passport_cover"
    ? "bg-[#e8e2d4] text-[#0d0d0d]"
    : data.preferences.passport_cover === "century_cover"
      ? "bg-[#ff5a4f] text-[#0d0d0d]"
      : data.preferences.passport_cover === "thousand_cover"
        ? "bg-[#0d0d0d] text-[#f5f4ef] ring-2 ring-inset ring-[#ff5a4f]"
        : "bg-[#0d0d0d] text-[#f5f4ef]";
  const lightCover = data.preferences.passport_cover === "paper_passport_cover" || data.preferences.passport_cover === "century_cover";
  const coverMuted = lightCover ? "text-black/55" : "text-white/55";
  const coverAccent = lightCover ? "text-[#83352f]" : "text-[#ff5a4f]";
  const premiumFinish = hasCapability(plan, "passport.premium_treatment");
  const finishColor = plan === "pro" ? "#C7FF4A" : "#FF5A4F";
  const latest = [...data.stamps].sort((a, b) => Date.parse(b.earnedAt) - Date.parse(a.earnedAt)).slice(0, 8);
  const profileUrl = `${publicOrigin}/${username}?mode=personal`;

  async function selectReward(category: RewardCategory, rewardId: string) {
    setPending(rewardId); setMessage("");
    const { error } = await createClient().rpc("set_passport_reward", { p_category: category, p_reward_id: rewardId });
    setPending(null);
    if (error) { setMessage("That reward could not be equipped. Check that it has been unlocked."); return; }
    setData((current) => ({ ...current, preferences: { ...current.preferences, [category]: rewardId } }));
    setMessage(`${PASSPORT_REWARDS.find((item) => item.id === rewardId)?.name ?? "Reward"} equipped.`);
  }

  return (
    <main className="min-h-screen bg-[#f5f4ef] px-4 py-6 text-[#0d0d0d] sm:px-6 sm:py-10">
      <div className="mx-auto max-w-6xl">
        <section className={`mt-5 overflow-hidden rounded-[2rem] p-6 sm:p-10 ${passportCoverClass}`} data-passport-finish={premiumFinish ? plan : "standard"} style={premiumFinish ? { boxShadow: `inset 0 0 0 3px ${finishColor}` } : undefined}>
          <div className="flex flex-wrap items-start justify-between gap-6"><div><p className={`text-[10px] font-bold tracking-[0.24em] ${coverAccent}`}>SETUVARA PASSPORT</p><h1 className="mt-4 text-6xl font-semibold tracking-[-0.07em] sm:text-8xl">{data.connectionCount.toLocaleString()}</h1><p className={`mt-1 text-xs font-bold tracking-[0.2em] ${coverMuted}`}>UNIQUE CONNECTIONS</p></div><div className="w-full max-w-sm rounded-3xl border border-current/15 p-5 sm:mt-2"><p className={`text-[10px] font-bold tracking-[0.2em] ${coverMuted}`}>{next ? "NEXT MILESTONE" : "HIGHEST V1 MILESTONE"}</p><p className="mt-2 text-2xl font-semibold">{next ? `${next.threshold} · ${next.name}` : "Thousand Met"}</p><p className={`mt-1 text-sm ${coverMuted}`}>{next ? `${Math.max(0, next.threshold - data.connectionCount)} to go` : "Your record keeps growing."}</p><div aria-label={next ? `${data.connectionCount} of ${next.threshold} connections to next milestone` : "Highest V1 milestone reached"} aria-valuemax={100} aria-valuemin={0} aria-valuenow={Math.round(progress)} className={`mt-5 h-2 overflow-hidden rounded-full ${lightCover ? "bg-black/10" : "bg-white/15"}`} role="progressbar"><div className="h-full rounded-full bg-[#ff5a4f] transition-[width]" style={{ width: `${progress}%` }} /></div></div></div>
          <div className={`mt-9 grid grid-cols-3 gap-3 border-t pt-5 text-center sm:max-w-xl sm:text-left ${lightCover ? "border-black/15" : "border-white/15"}`}><Stat value={data.cities} label="Cities" light={lightCover} /><Stat value={data.events} label="Events" light={lightCover} /><Stat value={data.countries} label="Countries" light={lightCover} /></div>
        </section>
        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_0.82fr]">
          <section className="rounded-[2rem] bg-white p-6 sm:p-8"><p className="text-[10px] font-bold tracking-[0.2em] text-black/45">YOUR PROGRESSION</p><h2 className="mt-2 text-2xl font-semibold tracking-tight">Every connection stays in the story.</h2><ol className="mt-6 grid gap-3 sm:grid-cols-2">{MILESTONES.map((milestone) => { const record = data.milestones.find((item) => item.threshold === milestone.threshold); return <li className={`rounded-2xl border p-4 ${record ? "border-[#ff5a4f]/50 bg-[#fff7f5]" : "border-black/10 bg-[#f5f4ef]/60"}`} key={milestone.threshold}><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-bold tracking-[0.18em] text-black/45">{milestone.label}</p><p className="mt-1 text-lg font-semibold">{milestone.threshold} connections</p></div><span aria-label={record ? "Unlocked" : "Locked"} className="text-xs font-semibold">{record ? "UNLOCKED ✓" : "LOCKED"}</span></div>{record && <p className="mt-2 text-xs text-black/50">Earned {new Date(record.unlockedAt).toLocaleDateString("en", { dateStyle: "medium" })}</p>}</li>; })}</ol></section>
          <section className="rounded-[2rem] bg-white p-6 sm:p-8"><p className="text-[10px] font-bold tracking-[0.2em] text-black/45">RECENT STAMPS</p><h2 className="mt-2 text-2xl font-semibold tracking-tight">Places and people, remembered.</h2>{latest.length ? <ul className="mt-5 divide-y divide-black/10">{latest.map((stamp) => <li className="flex items-center justify-between gap-4 py-4 first:pt-0" key={stamp.id}><div><p className="text-sm font-semibold">{stamp.type === "country" ? countryName(stamp.countryCode ?? stamp.title) : stamp.title}</p><p className="mt-1 text-xs text-black/50">{stamp.subtitle ?? stamp.type}</p></div><span className={`rounded-full border px-3 py-1 text-[9px] font-bold uppercase tracking-wider ${data.preferences.passport_stamp_style === "first_circle_stamp" ? "border-[#ff5a4f] bg-[#fff4f1] text-[#83352f]" : "border-black/10"}`}>{stamp.type}</span></li>)}</ul> : <div className="mt-5 rounded-2xl border border-dashed border-black/20 px-5 py-8"><p className="text-sm font-semibold">Your first stamp is waiting.</p><p className="mt-1 text-sm text-black/55">When a real connection starts, the moment can find its place here.</p></div>}</section>
        </div>
        <section className="mt-6 rounded-[2rem] bg-white p-6 sm:p-8"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-[10px] font-bold tracking-[0.2em] text-black/45">EARNED IDENTITY</p><h2 className="mt-2 text-2xl font-semibold tracking-tight">Rewards that become part of Setuvara.</h2></div><Link className="inline-flex min-h-11 items-center underline underline-offset-4" href="/app/identity?mode=personal&section=appearance">Open Appearance</Link></div><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{PASSPORT_REWARDS.map((reward) => { const has = unlocked.has(reward.id); const active = data.preferences[reward.category] === reward.id; return <article className={`rounded-2xl border p-4 ${has ? "border-black/10" : "border-black/10 bg-[#f5f4ef]/50"}`} key={reward.id}><div className="flex items-start justify-between gap-2"><div><p className="text-sm font-semibold">{reward.name}</p><p className="mt-1 text-xs text-black/50">{categoryNames[reward.category]} · {reward.rarity}</p></div><span className="text-xs font-semibold">{has ? (active ? "EQUIPPED" : "UNLOCKED") : `🔒 ${reward.milestone}`}</span></div><p className="mt-3 text-xs leading-5 text-black/55">{reward.description}</p>{has && <button className="mt-4 min-h-11 rounded-full border border-black/15 px-4 text-xs font-semibold focus-visible:outline-2" disabled={pending !== null || active} onClick={() => void selectReward(reward.category, reward.id)} type="button">{pending === reward.id ? "Equipping…" : active ? "Equipped" : "Equip reward"}</button>}</article>; })}</div><p aria-live="polite" className="mt-4 min-h-5 text-sm text-black/60">{message}</p></section>
        <section className="mt-6 grid gap-6 rounded-[2rem] bg-[#ff5a4f] p-6 text-[#0d0d0d] sm:grid-cols-[1fr_auto] sm:items-center sm:p-8"><div><p className="text-[10px] font-bold tracking-[0.2em]">ONE IDENTITY · EVERY MOMENT</p><h2 className="mt-2 text-2xl font-semibold">{displayName}’s Passport stays yours.</h2><p className="mt-2 max-w-lg text-sm leading-6">Connection counts, stamps, and milestone history are private. Share a mode when you choose.</p><a className="mt-4 inline-flex min-h-11 items-center rounded-full bg-[#0d0d0d] px-5 text-sm font-semibold text-white" href={profileUrl}>Open your Personal profile</a></div><div className="mx-auto rounded-2xl bg-white p-3"><QRCodeSVG aria-label="QR code for your Setuvara Personal profile" value={profileUrl} size={132} level="Q" marginSize={3} /></div></section>
      </div>
    </main>
  );
}

function Stat({ value, label, light }: { value: number; label: string; light: boolean }) { return <div><p className="text-2xl font-semibold tracking-tight">{value}</p><p className={`text-[10px] font-semibold tracking-[0.15em] ${light ? "text-black/55" : "text-white/55"}`}>{label.toUpperCase()}</p></div>; }

function countryName(code: string) {
  try { return new Intl.DisplayNames(["en"], { type: "region" }).of(code.toUpperCase()) ?? code.toUpperCase(); }
  catch { return code.toUpperCase(); }
}

export function CelebrationClient({ threshold, name }: { threshold: number | null; name: string | null }) {
  const [open, setOpen] = useState(Boolean(threshold));
  const closeButton = useRef<HTMLButtonElement>(null);
  const acknowledge = useCallback(async () => {
    if (!threshold) return;
    await createClient().rpc("ack_passport_milestone", { p_threshold: threshold });
    setOpen(false);
  }, [threshold]);
  useEffect(() => {
    if (!open) return;
    closeButton.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") void acknowledge(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [acknowledge, open]);
  if (!open || !threshold || !name) return null;
  return <div className="fixed inset-0 z-50 grid place-items-center bg-[#0d0d0d]/55 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) void acknowledge(); }}><section aria-labelledby="milestone-heading" aria-modal="true" className="w-full max-w-md rounded-[2rem] bg-[#f5f4ef] p-6 shadow-2xl sm:p-8" role="dialog"><p className="text-[10px] font-bold tracking-[0.2em] text-[#a43d36]">A REAL MILESTONE</p><h2 className="mt-3 text-4xl font-semibold tracking-[-0.06em]" id="milestone-heading">{threshold} connections.</h2><p className="mt-1 text-sm font-bold tracking-[0.16em]">{name.toUpperCase()}</p><p className="mt-4 text-sm leading-6 text-black/60">You’ve met {threshold} people through Setuvara. New identity rewards are now part of your Passport.</p><div className="mt-6 flex flex-wrap gap-3"><Link className="inline-flex min-h-11 items-center rounded-full bg-[#ff5a4f] px-5 text-sm font-semibold" href="/app/passport" onClick={() => void acknowledge()}>View Passport</Link><button className="min-h-11 rounded-full border border-black/15 px-5 text-sm font-semibold focus-visible:outline-2" onClick={() => void acknowledge()} ref={closeButton} type="button">Keep going</button></div></section></div>;
}
