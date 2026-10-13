import type { CSSProperties } from "react";

import { MeetMark } from "../brand";

/**
 * The Setuvara team the Teams previews show: real portraits from /public/pricing, the same
 * people as the homepage phones and the Ten looks rail. Face points keep each crop on the face.
 */
export const TEAM_PEOPLE = {
  aanya: { name: "Aanya Rao", role: "Partnerships Lead", photo: "/pricing/aanya-close.webp", face: { x: 45, y: 42 } },
  theo: { name: "Theo Laurent", role: "Events Lead", photo: "/pricing/theo-close.webp", face: { x: 47, y: 40 } },
  noor: { name: "Noor Haddad", role: "Solutions Engineer", photo: "/pricing/noor-close.webp", face: { x: 47, y: 34 } },
  sena: { name: "Sena Okafor", role: "Sales Director", photo: "/pricing/sena-close.webp", face: { x: 47, y: 28 } },
  lucas: { name: "Lucas Meyer", role: "Partnerships", photo: "/pricing/lucas-close.webp", face: { x: 50, y: 34 } },
} as const;

export type TeamPersonId = keyof typeof TEAM_PEOPLE;
export const TEAM_ORDER: TeamPersonId[] = ["aanya", "theo", "noor", "sena", "lucas"];

/** A round portrait of a team member. Decorative: callers name the person in text nearby. */
/** `zoom` is the background size: avatars crop in on the face, wider frames use "cover". */
export function PersonPhoto({ id, className = "", zoom = "170%", style }: { id: TeamPersonId; className?: string; zoom?: string; style?: CSSProperties }) {
  const person = TEAM_PEOPLE[id];
  return <span aria-hidden="true" className={`block shrink-0 bg-[#ddd] bg-cover ${className}`} style={{ backgroundImage: `url(${person.photo})`, backgroundPosition: `${person.face.x}% ${person.face.y}%`, backgroundSize: zoom, ...style }} />;
}

/** Setuvara's mark on a coral tile: the company the Teams previews are drawn for. */
export function SetuvaraTile({ className = "" }: { className?: string }) {
  return (
    <span className={`grid shrink-0 place-items-center rounded-[10px] bg-coral text-ink ${className}`}>
      <MeetMark className="size-[58%]" />
    </span>
  );
}
