import type { CSSProperties } from "react";
import { siInstagram, siTiktok, siTwitch, siYoutube, type SimpleIcon } from "simple-icons";

import { AUDIENCE_NOUN, formatAudience, SOCIAL_NAME, type PublicPlatform, type SocialProvider } from "@/lib/social/model";

const ICON: Record<SocialProvider, { icon: SimpleIcon; bg: string }> = {
  instagram: { icon: siInstagram, bg: "linear-gradient(135deg,#FEDA75,#FA7E1E 30%,#D62976 60%,#962FBF 85%,#4F5BD5)" },
  tiktok: { icon: siTiktok, bg: "#000000" },
  youtube: { icon: siYoutube, bg: "#FF0000" },
  twitch: { icon: siTwitch, bg: "#9146FF" },
};
const label = "font-label text-[10px] uppercase tracking-[0.2em]";
const line = "color-mix(in srgb, currentColor 12%, transparent)";

/**
 * A creator's verified audience: counts read from each platform's own API, never typed in. Only
 * accounts the creator chose to show on their page, and only counts synced in the last 48 hours.
 * The total is a sum of platform audiences, not unique people, and says so. The caller passes only
 * fresh counts (freshPlatforms).
 */
export function CreatorAudience({ platforms, accent, display }: { platforms: PublicPlatform[]; accent: string; display?: CSSProperties }) {
  const fresh = platforms;
  if (!fresh.length) return null;
  const total = fresh.reduce((sum, item) => sum + (item.audience_count ?? 0), 0);
  return (
    <section aria-label="Audience" className="flex flex-col gap-3 text-left" data-creator-audience={fresh.length}>
      <div className="flex items-end justify-between gap-3 border-b pb-3" style={{ borderColor: line }}>
        <p className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="font-display text-[40px] font-bold leading-none tracking-[-0.05em] tabular-nums" style={display}>{formatAudience(total)}</span>
          <span className="text-[14px] opacity-75">{fresh.length === 1 ? `${AUDIENCE_NOUN[fresh[0].provider]} on ${SOCIAL_NAME[fresh[0].provider]}` : `followers across ${fresh.length} platforms`}</span>
        </p>
        <span className={`${label} shrink-0 pb-1`} style={{ color: accent }}>Verified</span>
      </div>
      <ul className="grid grid-cols-2 gap-2">
        {fresh.map((item) => {
          const brand = ICON[item.provider];
          const inner = (
            <>
              <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-[10px] text-white" style={{ background: brand.bg }}>
                <svg className="size-[18px]" fill="currentColor" viewBox="0 0 24 24"><path d={brand.icon.path} /></svg>
              </span>
              <span className="min-w-0">
                <span className="flex items-center gap-1 text-[16px] font-bold leading-tight tabular-nums">
                  {formatAudience(item.audience_count ?? 0)}
                  <svg aria-label="Verified" className="size-3.5 shrink-0" role="img" viewBox="0 0 24 24"><circle cx="12" cy="12" fill={accent} r="11" /><path d="m7.5 12.3 3 3 6-6.6" fill="none" stroke="#fff" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.6" /></svg>
                </span>
                <span className="block truncate text-[12px] opacity-60">{SOCIAL_NAME[item.provider]}</span>
              </span>
            </>
          );
          const box = "flex min-h-[60px] items-center gap-2.5 rounded-[14px] p-2.5";
          return (
            <li key={item.provider}>
              {item.profile_url && /^https:\/\//.test(item.profile_url)
                ? <a className={`${box} transition-opacity hover:opacity-85`} href={item.profile_url} rel="noopener noreferrer" style={{ boxShadow: `inset 0 0 0 1px ${line}` }} target="_blank">{inner}</a>
                : <div className={box} style={{ boxShadow: `inset 0 0 0 1px ${line}` }}>{inner}</div>}
            </li>
          );
        })}
      </ul>
      {fresh.length > 1 && <p className="text-[11.5px] opacity-50">A sum of each platform&apos;s audience; one person can follow on several.</p>}
    </section>
  );
}
