import Image from "next/image";
import Link from "next/link";
import type { ConnectionContext, ModeSlug, ProfileIdentity, ProfileMode, ViewerState } from "./types";
import type { ReactNode } from "react";
import { providerForLink, resolveStoredLink } from "@/lib/links/providers";
import { ProviderMark } from "@/components/links/provider-mark";

type ProfileRendererProps = {
  profile: ProfileIdentity;
  mode: ProfileMode;
  viewerState: ViewerState;
  previewAsVisitor?: boolean;
  visitorAction?: ReactNode;
  connectionHref?: string;
  connectionContext?: ConnectionContext | null;
  guestClaimHref?: string;
  onShare?: () => void;
  onEditMode?: () => void;
  selectedRewards?: Partial<Record<string, string>>;
};

const modeEyebrow: Record<ModeSlug, string> = {
  personal: "PERSONAL",
  event: "EVENT",
  business: "BUSINESS",
};

export function ProfileRenderer({
  profile,
  mode,
  viewerState,
  previewAsVisitor = false,
  visitorAction,
  connectionHref,
  connectionContext,
  guestClaimHref,
  onShare,
  onEditMode,
  selectedRewards = {},
}: ProfileRendererProps) {
  const owner = viewerState === "owner" && !previewAsVisitor;
  const dark = mode.appearance.theme === "dark";
  const editorial = mode.appearance.theme === "editorial";
  const layout = mode.appearance.layout;
  const background = dark ? "bg-[#0d0d0d] text-[#f5f4ef]" : editorial ? "bg-[#f5f4ef] text-[#0d0d0d]" : "bg-white text-[#0d0d0d]";
  const secondary = dark ? "text-white/65" : "text-[#0d0d0d]/60";
  const isPoster = layout === "event-poster" || layout === "full-bleed";
  const isStructured = layout === "structured" || layout === "conference-card";
  const accentColor = selectedRewards.accent === "signal_accent" ? "#FF5A4F" : mode.appearance.accent;
  const signature = selectedRewards.profile_mark === "signal_50_mark" ? "SIGNAL 50" : selectedRewards.profile_mark === "thousand_mark" ? "THOUSAND MET" : null;
  const treatmentClass = selectedRewards.profile_treatment === "editorial_profile" || selectedRewards.profile_treatment === "century_profile" ? "shadow-[inset_0_0_0_1px_rgba(255,90,79,.38)]" : selectedRewards.profile_treatment === "connector_treatment" ? "border-[#ff5a4f]/45" : "";

  return (
    <article className={`relative isolate w-full overflow-hidden rounded-[2rem] border border-black/10 ${background} ${isPoster ? "min-h-[540px]" : "min-h-[480px]"} ${treatmentClass}`}>
      {mode.image_url && isPoster && (
        <div className="absolute inset-0 -z-10">
          {/* Supabase signed URLs are short-lived and use the private media bucket. */}
          <Image alt="" className="object-cover opacity-30" fill priority sizes="(max-width: 768px) 100vw, 420px" src={mode.image_url} unoptimized />
          <div className={`absolute inset-0 ${dark ? "bg-gradient-to-t from-black via-black/50 to-transparent" : "bg-gradient-to-t from-[#0d0d0d]/80 via-[#0d0d0d]/20 to-transparent"}`} />
        </div>
      )}

      <div className={`flex min-h-[inherit] flex-col p-6 sm:p-8 ${isStructured ? "justify-start" : "justify-between"}`}>
        <div className="flex items-start justify-between gap-3">
          <span className="text-[10px] font-bold tracking-[0.22em]" style={{ color: accentColor }}>{modeEyebrow[mode.slug]}</span>
          <span className={`text-[10px] font-semibold tracking-[0.16em] ${secondary}`}>SETUVARA</span>
        </div>

        {signature && <p className="mt-5 inline-flex self-start rounded-full border border-current/15 px-3 py-1 text-[9px] font-bold tracking-[0.16em]" aria-label={`Earned identity mark: ${signature}`}>{signature}</p>}

        <div className={`${isStructured ? "mt-10" : "mt-20"} ${layout === "portrait-editorial" || layout === "editorial-business" ? "max-w-[18rem]" : "max-w-full"}`}>
          {mode.image_url && !isPoster && (
            <div className={`relative mb-6 overflow-hidden bg-black/10 ${mode.appearance.imageTreatment === "compact" ? "h-24 w-24 rounded-2xl" : "h-40 w-32 rounded-[1.35rem]"}`}>
              <Image alt={profile.display_name} className="object-cover" fill sizes="128px" src={mode.image_url} unoptimized />
            </div>
          )}
          <h1 className={`${isPoster ? "text-5xl" : "text-4xl"} font-semibold leading-[0.98] tracking-[-0.055em] sm:text-[3.4rem]`}>
            {profile.display_name}
          </h1>
          <p className={`mt-3 text-sm font-medium ${secondary}`}>@{profile.username}</p>

          {mode.slug === "personal" && profile.bio && (
            <p className={`mt-5 max-w-sm whitespace-pre-wrap text-[15px] leading-7 ${secondary}`}>{profile.bio}</p>
          )}
          {mode.slug === "personal" && mode.settings.note && (
            <p className={`mt-4 max-w-sm text-sm leading-6 ${secondary}`}>{String(mode.settings.note)}</p>
          )}
          {mode.slug === "personal" && mode.settings.location && (
            <p className={`mt-3 text-xs font-semibold ${secondary}`}>{String(mode.settings.location)}</p>
          )}
          {mode.slug === "event" && <ModeDetails mode={mode} secondary={secondary} />}
          {mode.slug === "business" && <ModeDetails mode={mode} secondary={secondary} />}
        </div>

        <div className="mt-10 space-y-2.5">
          {mode.links.filter((link) => link.is_visible).map((link) => {
            const provider = providerForLink(link.link_type);
            const destination = resolveStoredLink(provider.id, link.url);
            if (!destination) return null;
            const external = /^https?:/i.test(destination.url);
            return <a
              className={`flex min-h-14 items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition ${dark ? "bg-white/10 hover:bg-white/15" : editorial ? "bg-white/70 hover:bg-white" : "border border-black/10 hover:border-black/20 hover:bg-[#f5f4ef]"}`}
              href={destination.url}
              key={link.id}
              rel={external ? "noopener noreferrer" : undefined}
              style={provider.category === "Business & actions" ? { borderColor: `${accentColor}55` } : undefined}
              target={external ? "_blank" : undefined}
            >
              <ProviderMark className="size-9 rounded-xl bg-black/[0.04]" icon={provider.icon} label={provider.name} />
              <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{link.title}</span><span className={`mt-0.5 block truncate text-xs ${secondary}`}>{destination.displayValue}</span></span>
              <span aria-hidden="true" className="shrink-0 text-base leading-none text-current/45">{external ? "↗" : provider.id === "email" ? "✉" : "→"}</span>
            </a>;
          })}
          {!mode.links.some((link) => link.is_visible) && (
            <p className={`rounded-2xl border border-dashed border-current/20 px-4 py-4 text-sm ${secondary}`}>
              {mode.slug === "event" && !mode.settings.eventName ? "Event Mode is ready when you are." : "No links shared in this Mode yet."}
            </p>
          )}
        </div>

        {viewerState === "visitor_connected" && !previewAsVisitor && (
          <section aria-label="Connection status" className="mt-5 rounded-2xl border border-black/10 bg-white/60 px-4 py-4">
            <p aria-live="polite" className="text-sm font-semibold">Connected <span aria-hidden="true">✓</span></p>
            {(connectionContext?.event || connectionContext?.city || connectionContext?.dateLabel) && (
              <div className="mt-3 border-l-2 pl-3" style={{ borderColor: mode.appearance.accent }}>
                <p className="text-[10px] font-bold tracking-[0.16em]">YOU MET</p>
                <p className={`mt-1 text-xs ${secondary}`}>{[connectionContext.event, connectionContext.city].filter(Boolean).join(" · ")}</p>
                {connectionContext.dateLabel && <p className={`mt-1 text-xs ${secondary}`}>{connectionContext.dateLabel}</p>}
                {connectionContext.mode && <p className={`mt-1 text-[10px] ${secondary}`}>{connectionContext.mode} Mode</p>}
              </div>
            )}
            {connectionHref && <Link className="mt-3 inline-flex min-h-11 items-center text-xs font-semibold underline underline-offset-4" href={connectionHref}>View connection</Link>}
            {guestClaimHref && <div className="mt-3 border-t border-black/10 pt-3"><Link className="inline-flex min-h-11 items-center rounded-full bg-[#ff5a4f] px-4 text-xs font-semibold" href={guestClaimHref}>Claim your Setuvara</Link><p className={`mt-1 text-[11px] leading-5 ${secondary}`}>Keep this connection, create your identity, and share yours next time.</p></div>}
          </section>
        )}
        {!owner && visitorAction}

        {owner && (
          <div className="mt-5 flex justify-center gap-2 border-t border-current/10 pt-4">
            <a className="inline-flex min-h-11 items-center rounded-full px-4 text-xs font-semibold hover:bg-current/5" href={`/app/identity?mode=${mode.slug}&section=share`} onClick={onShare ? (event) => { event.preventDefault(); onShare(); } : undefined}>Share</a>
            <a className="inline-flex min-h-11 items-center rounded-full px-4 text-xs font-semibold hover:bg-current/5" href={`/app/identity?mode=${mode.slug}&section=settings`} onClick={onEditMode ? (event) => { event.preventDefault(); onEditMode(); } : undefined}>Edit Mode</a>
            <span className={`self-center text-[10px] font-semibold uppercase tracking-wider ${secondary}`}>Owner preview</span>
          </div>
        )}
      </div>
    </article>
  );
}

function ModeDetails({ mode, secondary }: { mode: ProfileMode; secondary: string }) {
  if (mode.slug === "event") {
    return (
      <div className="mt-5 space-y-2">
        {mode.settings.eventName && <p className="text-lg font-semibold tracking-tight">{String(mode.settings.eventName)}</p>}
        {(mode.settings.city || mode.settings.dateLabel) && <p className={`text-sm ${secondary}`}>{[mode.settings.city, mode.settings.dateLabel].filter(Boolean).join(" · ")}</p>}
        {mode.settings.role && <p className={`text-sm ${secondary}`}>{String(mode.settings.role)}</p>}
        {mode.settings.hereToMeet && <div className="mt-6"><p className="text-[10px] font-bold tracking-[0.18em]" style={{ color: mode.appearance.accent }}>HERE TO MEET</p><p className={`mt-2 text-sm leading-6 ${secondary}`}>{String(mode.settings.hereToMeet)}</p></div>}
      </div>
    );
  }
  return (
    <div className="mt-5 space-y-1">
      {mode.settings.role && <p className="text-base font-semibold">{String(mode.settings.role)}</p>}
      {mode.settings.company && <p className={`text-sm ${secondary}`}>{String(mode.settings.company)}</p>}
          {mode.settings.city && <p className={`text-sm ${secondary}`}>{[String(mode.settings.city), mode.settings.countryCode ? countryName(String(mode.settings.countryCode)) : ""].filter(Boolean).join(" · ")}</p>}
      {mode.settings.description && <p className={`mt-4 max-w-sm text-sm leading-6 ${secondary}`}>{String(mode.settings.description)}</p>}
    </div>
  );
}

function countryName(code: string) {
  try { return new Intl.DisplayNames(["en"], { type: "region" }).of(code.toUpperCase()) ?? code.toUpperCase(); }
  catch { return code.toUpperCase(); }
}
