import { actionWindow, COLLAB_TYPE_LABEL, ctaFor, type PublicAction } from "@/lib/actions/model";

const label = "font-label text-[10.5px] uppercase tracking-[0.18em]";
const line = "color-mix(in srgb, currentColor 14%, transparent)";

export function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}

/**
 * One Action on a public page. It sits inside any Appearance, so colour comes from currentColor and
 * the page accent; only the collaboration card keeps its own ink ground, as in the Creator design.
 */
export function ActionCard({ action, coverUrl, href, accent, accentInk }: { action: PublicAction; coverUrl?: string | null; href?: string; accent: string; accentInk: string }) {
  const when = actionWindow(action);
  const cta = when === "ended" ? "Closed" : when === "upcoming" && action.starts_at ? `Opens ${shortDate(action.starts_at)}` : ctaFor(action);
  const button = href && when === "open"
    ? <a className="mt-1 inline-flex min-h-12 w-fit items-center rounded-full px-5 text-[15px] font-semibold focus-visible:outline-2 focus-visible:outline-offset-2" href={href} style={{ background: accent, color: accentInk }}>{cta}</a>
    : <span aria-disabled={when !== "open" || undefined} className={`mt-1 inline-flex min-h-12 w-fit items-center rounded-full px-5 text-[15px] font-semibold ${when === "open" ? "" : "opacity-60"}`} style={when === "open" ? { background: accent, color: accentInk } : { boxShadow: `inset 0 0 0 1.5px ${line}` }}>{cta}</span>;
  const { config } = action;

  if (action.kind === "collab") {
    return (
      <section aria-label={action.title} className="flex flex-col gap-3 rounded-[22px] bg-[#0D0D0D] p-5 text-[#F5F4EF] @min-[700px]/profile:p-7" data-action={action.kind}>
        <p className={`${label} text-[#B79CFF]`}>{config.availability || "Open for collaborations"}</p>
        <h2 className="font-display text-[26px] font-bold leading-[1.05] tracking-[-0.04em] @min-[700px]/profile:text-[30px]">{action.title}</h2>
        {action.intro && <p className="max-w-[52ch] text-[15px] leading-[1.5] text-white/80">{action.intro}</p>}
        {config.types && config.types.length > 0 && <ul aria-label="Takes on" className="flex flex-wrap gap-1.5">{config.types.map((type) => <li className="rounded-full bg-white/10 px-3 py-1 text-[13px]" key={type}>{COLLAB_TYPE_LABEL[type]}</li>)}</ul>}
        {button}
      </section>
    );
  }

  const eyebrow = action.kind === "giveaway"
    ? `Giveaway${action.ends_at ? ` · ${when === "ended" ? "ended" : "ends"} ${shortDate(action.ends_at)}` : ""}`
    : action.kind === "booking" ? (config.offering === "application" ? "Applications" : "Bookings") : "Ask";
  const body = action.kind === "giveaway" ? config.prize : action.kind === "booking" ? config.details : config.prompt;
  return (
    <section aria-label={action.title} className="flex flex-col overflow-hidden rounded-[22px]" data-action={action.kind} style={{ boxShadow: `inset 0 0 0 1px ${line}` }}>
      {coverUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- public profile media
        <img alt="" className="aspect-[16/9] w-full object-cover" loading="lazy" src={coverUrl} />
      )}
      <div className="flex flex-col gap-3 p-5 @min-[700px]/profile:p-6">
        <p className={`${label} opacity-60`}>{eyebrow}</p>
        <h2 className="font-display text-[26px] font-bold leading-[1.05] tracking-[-0.04em]">{action.title}</h2>
        {body && <p className={action.kind === "submission" ? "text-[19px] font-semibold leading-[1.3]" : "line-clamp-3 whitespace-pre-line text-[15px] leading-[1.5] opacity-80"}>{action.kind === "giveaway" ? `Prize: ${body}` : body}</p>}
        {action.intro && action.kind !== "booking" && <p className="text-[14px] leading-[1.5] opacity-70">{action.intro}</p>}
        {action.kind === "booking" && config.priceNote && <p className="text-[14px] font-semibold">{config.priceNote}</p>}
        {button}
      </div>
    </section>
  );
}
