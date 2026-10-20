import { formatMoney, handleFromUrl, type KitRate } from "@/lib/creator/studio";
import { AUDIENCE_NOUN, formatAudience, isSocialProvider, type PublicPlatform } from "@/lib/social/model";
import { linkProviderById } from "@/lib/links/providers";
import { Mono, PlatformTile } from "./studio-ui";

export type KitPlatform = { type: string; url: string; audience?: number | null; verified?: boolean };

/** Adds platform-verified counts to the link list; a verified account with no link still appears. */
export function withVerified(links: KitPlatform[], verified: Pick<PublicPlatform, "provider" | "profile_url" | "audience_count">[]): KitPlatform[] {
  const out = links.map((link) => {
    const match = verified.find((item) => item.provider === link.type);
    return match ? { ...link, audience: match.audience_count, verified: true } : link;
  });
  for (const item of verified) if (item.profile_url && !out.some((link) => link.type === item.provider)) out.push({ type: item.provider, url: item.profile_url, audience: item.audience_count, verified: true });
  return out;
}

export type KitDocument = {
  displayName: string;
  tagline: string;
  category: string;
  city: string;
  languages: string;
  imageUrl: string | null;
  /** Links, with a verified count only when the platform itself supplied it. */
  platforms: KitPlatform[];
  partners: string[];
  rates: KitRate[];
  contactEmail: string | null;
  kitUrl: string | null;
  updatedAt: string | null;
};

/**
 * A real document, read top to bottom the way partners read it. Every value is the creator's own
 * entry or comes from their Creator page; audience numbers appear only when the platform supplied them.
 */
export function MediaKitDocument({ doc }: { doc: KitDocument }) {
  const subline = [doc.category, doc.city, doc.languages].filter(Boolean).join(" · ");
  const month = doc.updatedAt ? new Date(doc.updatedAt).toLocaleDateString("en-GB", { month: "short", year: "numeric" }).toUpperCase() : null;
  return (
    <article className="flex flex-col gap-9 rounded-[22px] bg-white p-6 text-[#0D0D0D] shadow-[0_40px_80px_-50px_rgba(13,13,13,.45)] md:p-12 print:rounded-none print:shadow-none" data-media-kit>
      <header className="flex flex-col gap-6 border-b-[1.5px] border-[#0D0D0D] pb-8 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-5">
          <span className="relative size-[72px] shrink-0 overflow-hidden rounded-full bg-[#0D0D0D] md:size-[84px]">
            {doc.imageUrl && <>
              {/* eslint-disable-next-line @next/next/no-img-element -- signed Supabase image */}
              <img alt="" className="size-full object-cover" src={doc.imageUrl} />
            </>}
          </span>
          <div className="min-w-0">
            <h1 className="font-display text-[34px] font-bold leading-none tracking-[-0.05em] md:text-[44px]">{doc.displayName}</h1>
            {(subline || doc.tagline) && <p className="mt-2 text-[16px] text-black/65">{subline || doc.tagline}</p>}
          </div>
        </div>
        <div className="sm:text-right">
          <Mono className="text-black/70">Media kit{month ? ` · ${month}` : ""}</Mono>
          {doc.kitUrl && <p className="mt-1 font-label text-[11px] tracking-[0.08em] text-black/60">{doc.kitUrl.replace(/^https?:\/\//, "")}</p>}
        </div>
      </header>

      {subline && doc.tagline && <p className="max-w-[52ch] text-[19px] leading-[1.45]">{doc.tagline}</p>}

      {doc.platforms.length > 0 && (
        <section>
          <Mono className="mb-4 text-black/60">Where to find {doc.displayName.split(/\s+/)[0]}</Mono>
          <ul className="grid gap-3 sm:grid-cols-2">
            {doc.platforms.map((platform) => {
              const name = linkProviderById[platform.type as keyof typeof linkProviderById]?.name ?? platform.type;
              return (
                <li key={platform.url}>
                  <a className="flex items-center gap-3 rounded-[16px] p-2 pr-4 hover:bg-black/[0.03] focus-visible:outline-2" href={platform.url} rel="noreferrer" target="_blank">
                    <PlatformTile size={40} type={platform.type} />
                    <span className="min-w-0"><span className="block text-[15px] font-semibold">{name}</span><span className="block truncate text-[13px] text-black/60">{handleFromUrl(platform.url) || platform.url.replace(/^https?:\/\//, "")}</span></span>
                    {platform.verified && typeof platform.audience === "number" && <span className="ml-auto shrink-0 text-right"><span className="block font-display text-[22px] font-bold leading-none tracking-[-0.04em]">{formatAudience(platform.audience)}</span><span className="block text-[11px] text-black/55">{isSocialProvider(platform.type) ? AUDIENCE_NOUN[platform.type] : "followers"} · verified</span></span>}
                  </a>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {doc.partners.length > 0 && (
        <section>
          <Mono className="mb-4 text-black/60">Worked with</Mono>
          <ul className="flex flex-wrap gap-2">{doc.partners.map((partner) => <li className="rounded-full px-3.5 py-2 text-[15px] font-semibold shadow-[inset_0_0_0_1.5px_rgba(13,13,13,.14)]" key={partner}>{partner}</li>)}</ul>
        </section>
      )}

      {doc.rates.length > 0 && (
        <section className="border-t border-black/10 pt-7">
          <Mono className="mb-4 text-black/60">Starting rates</Mono>
          <ul className="grid grid-cols-2 gap-6 md:grid-cols-4">
            {doc.rates.map((rate) => <li key={`${rate.label}${rate.amount_minor}`}><p className="font-display text-[28px] font-bold leading-none tracking-[-0.04em]">{formatMoney(rate.amount_minor, rate.currency)}</p><p className="mt-2 text-[15px] text-black/65">{rate.label}</p></li>)}
          </ul>
        </section>
      )}

      {doc.contactEmail && (
        <section className="border-t border-black/10 pt-7">
          <Mono className="mb-2 text-black/60">Contact</Mono>
          <a className="text-[19px] font-semibold underline decoration-black/25 underline-offset-4 hover:decoration-black" href={`mailto:${doc.contactEmail}`}>{doc.contactEmail}</a>
        </section>
      )}
    </article>
  );
}
