import { siApplemusic, siInstagram, siSoundcloud, siSpotify, siTiktok, siWhatsapp, siYoutube, type SimpleIcon } from "simple-icons";

/** The platforms' own marks (simple-icons), drawn in their brand colour, for marketing visuals. */
export const BRANDS = {
  youtube: siYoutube, instagram: siInstagram, tiktok: siTiktok, spotify: siSpotify,
  applemusic: siApplemusic, soundcloud: siSoundcloud, whatsapp: siWhatsapp,
} satisfies Record<string, SimpleIcon>;
export type Brand = keyof typeof BRANDS;

/** A platform's mark on a white tile; `plain` draws the bare mark. */
export function BrandMark({ brand, size = 22, plain = false, className = "" }: { brand: Brand; size?: number; plain?: boolean; className?: string }) {
  const icon = BRANDS[brand];
  const svg = <svg aria-hidden="true" fill={`#${icon.hex}`} height={size} viewBox="0 0 24 24" width={size}><path d={icon.path} /></svg>;
  if (plain) return <span className={`inline-flex shrink-0 ${className}`} title={icon.title}>{svg}</span>;
  return <span className={`inline-grid shrink-0 place-items-center rounded-[28%] bg-white shadow-[inset_0_0_0_1px_rgba(13,13,13,.08)] ${className}`} style={{ width: size * 1.75, height: size * 1.75 }} title={icon.title}>{svg}</span>;
}
