import { demoModes, person, type DemoMode } from "./demo";
import { Label, LinkRow } from "./primitives";

const tones = {
  personal: { surface: "bg-ink text-paper", accent: "text-coral", muted: "text-paper/60", link: "dark" as const },
  event: { surface: "bg-coral text-ink", accent: "text-ink", muted: "text-ink/70", link: "coral" as const },
  business: { surface: "bg-white text-ink shadow-[inset_0_0_0_1px_rgba(13,13,13,.1)]", accent: "text-ink/55", muted: "text-ink/60", link: "light" as const },
};

/**
 * A marketing rendition of the public profile renderer: the same eyebrow, name,
 * handle, Mode details, and provider-backed link rows that visitors see on /[username].
 */
export function ModeProfile({ slug, size = "full", linkCount }: { slug: DemoMode["slug"]; size?: "full" | "compact"; linkCount?: number }) {
  const mode = demoModes.find((item) => item.slug === slug)!;
  const tone = tones[slug];
  const compact = size === "compact";
  const links = mode.links.slice(0, linkCount ?? mode.links.length);

  return (
    <article aria-label={`${person.name}, ${mode.label} Mode`} className={`relative flex h-full w-full flex-col overflow-hidden rounded-[1.75rem] text-left ${tone.surface} ${compact ? "p-5" : "p-6 sm:p-7"}`}>
      <div className="flex items-start justify-between gap-3">
        <Label className={`!text-[10px] !tracking-[0.2em] ${tone.accent}`}>{mode.label}</Label>
        <Label className={`!text-[10px] ${tone.muted}`}>Setuvara</Label>
      </div>

      {slug === "event" ? (
        <div className={compact ? "mt-5" : "mt-8"}>
          <p className={`font-display font-extrabold leading-[0.85] tracking-[-0.06em] ${compact ? "text-[40px] sm:text-[44px]" : "text-[64px]"}`}>Slush</p>
          <p className="mt-2 text-[13px] font-semibold">Helsinki · November</p>
        </div>
      ) : null}

      <div className={slug === "event" ? (compact ? "mt-5" : "mt-7") : compact ? "mt-8" : "mt-14"}>
        {slug === "business" ? (
          <div aria-hidden="true" className={`mb-5 grid place-items-center rounded-2xl bg-sky font-display font-bold tracking-[-0.04em] text-ink [clip-path:polygon(0_0,100%_0,100%_calc(100%-22px),calc(100%-13px)_100%,0_100%)] ${compact ? "size-14 text-xl" : "size-20 text-[28px]"}`}>{person.initials}</div>
        ) : null}
        <h3 className={`font-display font-bold leading-[0.95] tracking-[-0.05em] ${compact ? "text-[30px]" : "text-[40px] sm:text-[44px]"}`}>{slug === "personal" ? person.firstName : person.name}</h3>
        <p className={`mt-1.5 text-[13px] font-medium ${tone.muted}`}>@{person.username}</p>

        {slug === "personal" ? (
          <>
            {!compact && <p className={`mt-4 max-w-[19rem] text-[14px] leading-6 ${tone.muted}`}>Designer, distance runner, always hunting for the best bica in Lisbon.</p>}
            <p className={`text-xs font-semibold ${compact ? "mt-3" : "mt-3"} ${tone.muted}`}>Lisbon</p>
          </>
        ) : null}

        {slug === "event" ? (
          <div className={`border-t-[1.5px] border-ink ${compact ? "mt-4 pt-3" : "mt-5 pt-4"}`}>
            <p className="text-[13px] font-semibold">Partnerships · Lumen Labs</p>
            <div className={compact ? "hidden sm:block" : undefined}>
              <Label className="mt-3 !text-[9px] !tracking-[0.2em]">Here to meet</Label>
              <p className="mt-1 text-[13px] leading-5">Climate founders and grid operators</p>
            </div>
          </div>
        ) : null}

        {slug === "business" ? (
          <dl className={`grid grid-cols-2 border-y border-ink/15 ${compact ? "mt-4" : "mt-5"}`}>
            <div className="py-2.5 pr-3"><dt className="font-label text-[9px] uppercase tracking-[0.16em] text-ink/50">Role</dt><dd className="mt-0.5 text-[13px] font-semibold">Partnerships Lead</dd></div>
            <div className="border-l border-ink/15 py-2.5 pl-3"><dt className="font-label text-[9px] uppercase tracking-[0.16em] text-ink/50">Company</dt><dd className="mt-0.5 text-[13px] font-semibold">Lumen Labs</dd></div>
          </dl>
        ) : null}
      </div>

      <div className={`mt-auto flex flex-col gap-2 ${compact ? "pt-5" : "pt-8"}`}>
        {links.map((link) => <LinkRow compact={compact} key={link.title} link={link} tone={tone.link} />)}
      </div>
    </article>
  );
}
