import Image from "next/image";
import type { ModeSlug, ProfileIdentity, ProfileMode, ViewerState } from "./types";

type ProfileRendererProps = {
  profile: ProfileIdentity;
  mode: ProfileMode;
  viewerState: ViewerState;
  previewAsVisitor?: boolean;
  onShare?: () => void;
  onEditMode?: () => void;
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
  onShare,
  onEditMode,
}: ProfileRendererProps) {
  const owner = viewerState === "owner" && !previewAsVisitor;
  const dark = mode.appearance.theme === "dark";
  const editorial = mode.appearance.theme === "editorial";
  const layout = mode.appearance.layout;
  const background = dark ? "bg-[#0d0d0d] text-[#f5f4ef]" : editorial ? "bg-[#f5f4ef] text-[#0d0d0d]" : "bg-white text-[#0d0d0d]";
  const secondary = dark ? "text-white/65" : "text-[#0d0d0d]/60";
  const isPoster = layout === "event-poster" || layout === "full-bleed";
  const isStructured = layout === "structured" || layout === "conference-card";
  const accentStyle = { backgroundColor: mode.appearance.accent };

  return (
    <article className={`relative isolate w-full overflow-hidden rounded-[2rem] border border-black/10 ${background} ${isPoster ? "min-h-[540px]" : "min-h-[480px]"}`}>
      {mode.image_url && isPoster && (
        <div className="absolute inset-0 -z-10">
          {/* Supabase signed URLs are short-lived and use the private media bucket. */}
          <Image alt="" className="object-cover opacity-30" fill priority sizes="(max-width: 768px) 100vw, 420px" src={mode.image_url} unoptimized />
          <div className={`absolute inset-0 ${dark ? "bg-gradient-to-t from-black via-black/50 to-transparent" : "bg-gradient-to-t from-[#0d0d0d]/80 via-[#0d0d0d]/20 to-transparent"}`} />
        </div>
      )}

      <div className={`flex min-h-[inherit] flex-col p-6 sm:p-8 ${isStructured ? "justify-start" : "justify-between"}`}>
        <div className="flex items-start justify-between gap-3">
          <span className="text-[10px] font-bold tracking-[0.22em]" style={{ color: mode.appearance.accent }}>{modeEyebrow[mode.slug]}</span>
          <span className={`text-[10px] font-semibold tracking-[0.16em] ${secondary}`}>SETUVARA</span>
        </div>

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
          {mode.links.filter((link) => link.is_visible).map((link) => (
            <a
              className={`flex min-h-12 items-center justify-between gap-4 rounded-2xl px-4 py-3 text-sm font-semibold transition ${dark ? "bg-white/10 hover:bg-white/15" : editorial ? "bg-white/70 hover:bg-white" : "border border-black/10 hover:border-black/20 hover:bg-[#f5f4ef]"}`}
              href={link.url}
              key={link.id}
              rel="noreferrer"
              style={link.link_type === "calendar" ? accentStyle : undefined}
              target="_blank"
            >
              <span className="min-w-0 truncate">{link.title}</span>
              <span aria-hidden="true" className="text-lg leading-none">↗</span>
            </a>
          ))}
          {!mode.links.some((link) => link.is_visible) && (
            <p className={`rounded-2xl border border-dashed border-current/20 px-4 py-4 text-sm ${secondary}`}>
              {mode.slug === "event" && !mode.settings.eventName ? "Event Mode is ready when you are." : "No links shared in this Mode yet."}
            </p>
          )}
        </div>

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
      {mode.settings.city && <p className={`text-sm ${secondary}`}>{String(mode.settings.city)}</p>}
      {mode.settings.description && <p className={`mt-4 max-w-sm text-sm leading-6 ${secondary}`}>{String(mode.settings.description)}</p>}
    </div>
  );
}
