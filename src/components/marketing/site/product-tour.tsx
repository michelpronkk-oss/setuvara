import type { ReactNode } from "react";

import { nameFontClasses } from "@/components/profile/name-fonts";
import { APPEARANCE_CUES, APPEARANCE_LINES, APPEARANCE_NAMES, APPEARANCES, capabilityForField, SCROLL_CUES } from "@/components/profile/appearance";
import { NAME_FONT_NAMES, NAME_FONTS } from "@/components/profile/name-type";
import { CueGlyph } from "@/components/profile/scroll-cue";
import type { AppearanceId } from "@/components/profile/types";

import { DEMO_PEOPLE, ModePhone } from "../home/mode-phone";
import { RAIL, RAIL_ITEM } from "./kit";
import { Avatar } from "./panels";

/**
 * The /product tour: every Look, name style, scroll cue and soundtrack presentation, drawn by
 * the same renderer members' pages use (ModePhone) or the same cue glyphs. Every person is an
 * example; the Free or Plus line on each item comes from capabilityForField, the rule the editor
 * and the database share.
 */

const mono = "font-label text-[10px] font-medium uppercase tracking-[0.16em]";
const plan = (field: "theme" | "nameFont" | "scrollCue" | "soundtrackPresentation", value: string) => (capabilityForField(field, value) ? "Plus" : "Free");

/** Who wears which Look, so the gallery shows ten people, not one face ten times. */
const LOOK_CAST: Record<AppearanceId, { who: (typeof DEMO_PEOPLE)[keyof typeof DEMO_PEOPLE]; accent: string }> = {
  immersive: { who: DEMO_PEOPLE.theo, accent: "#C7FF4A" },
  motion: { who: DEMO_PEOPLE.aanya, accent: "#FF5A4F" },
  aura: { who: DEMO_PEOPLE.noor, accent: "#AFCBFF" },
  clean: { who: DEMO_PEOPLE.lucasClose, accent: "#FF5A4F" },
  glow: { who: DEMO_PEOPLE.sena, accent: "#E8A6FF" },
  scene: { who: DEMO_PEOPLE.theo, accent: "#F5C66E" },
  frame: { who: DEMO_PEOPLE.noor, accent: "#FF5A4F" },
  stack: { who: DEMO_PEOPLE.aanya, accent: "#C7FF4A" },
  social: { who: DEMO_PEOPLE.lucasClose, accent: "#AFCBFF" },
  film: { who: DEMO_PEOPLE.sena, accent: "#F5C66E" },
};

/** A 280×580 phone drawn at a smaller size, without shifting the layout around it. */
function Phone({ scale, children }: { scale: number; children: ReactNode }) {
  return (
    <div aria-hidden="true" className="mx-auto" inert style={{ width: 280 * scale, height: 580 * scale }}>
      <div className="origin-top-left" style={{ transform: `scale(${scale})`, width: 280 }}>{children}</div>
    </div>
  );
}

function PlanTag({ value }: { value: string }) {
  return <span className={`${mono} rounded-full px-2 py-1 ${value === "Free" ? "bg-[#EEF7E4] text-[#3E6B12]" : "bg-[#FFF1EF] text-[#a43d36]"}`}>{value}</span>;
}

export function LooksGallery() {
  return (
    <ul className={`${nameFontClasses} grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-3 lg:grid-cols-5 lg:gap-x-6 ${RAIL}`}>
      {APPEARANCES.map((id) => (
        <li className={`flex flex-col items-center text-center ${RAIL_ITEM} max-md:!w-[170px]`} key={id}>
          <Phone scale={0.56}><ModePhone label={`${APPEARANCE_NAMES[id]} Look`} look={{ theme: id, accent: LOOK_CAST[id].accent }} slug="personal" who={LOOK_CAST[id].who} /></Phone>
          <p className="mt-5 flex items-center gap-2"><span className="font-display text-[22px] font-extrabold tracking-[-0.045em]">{APPEARANCE_NAMES[id]}</span><PlanTag value={plan("theme", id)} /></p>
          <p className="mt-1.5 max-w-[16rem] text-[14px] leading-[1.5] text-paper/60 max-md:hidden">{APPEARANCE_LINES[id]}</p>
        </li>
      ))}
    </ul>
  );
}

export function NameStyles() {
  return (
    <ul className={`${nameFontClasses} grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-3 lg:grid-cols-6 lg:gap-x-5 ${RAIL}`}>
      {NAME_FONTS.map((id) => (
        <li className={`flex flex-col items-center ${RAIL_ITEM} max-md:!w-[150px]`} key={id}>
          <Phone scale={0.5}><ModePhone label={`${NAME_FONT_NAMES[id]} name style`} look={{ theme: "immersive", accent: "#FF5A4F", nameFont: id, namePosition: "bottom" }} slug="event" who={DEMO_PEOPLE.theo} /></Phone>
          <p className="mt-4 flex items-center gap-2"><span className="text-[15px] font-semibold">{NAME_FONT_NAMES[id]}</span><PlanTag value={plan("nameFont", id)} /></p>
        </li>
      ))}
    </ul>
  );
}

const CUE_NAMES: Record<string, string> = { glide: "Glide", rail: "Rail", orb: "Orb", mouse: "Mouse", beam: "Beam", cascade: "Cascade", caption: "Caption", cards: "Cards", swipe: "Swipe", credits: "Credits" };
const CUE_OWNER = Object.fromEntries(Object.entries(APPEARANCE_CUES).map(([look, cue]) => [cue, APPEARANCE_NAMES[look as AppearanceId]]));

export function CueGrid() {
  return (
    <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5 sm:gap-4">
      {SCROLL_CUES.map((cue) => (
        <li className="flex flex-col overflow-hidden rounded-[22px] bg-[#1B1B1B]" key={cue}>
          <div aria-hidden="true" className="flex h-[96px] items-center justify-center text-paper sm:h-[150px]" data-scroll-cue={cue} data-scroll-cue-motion="loop">
            <span className="block scale-[1.2] sm:scale-[1.6]"><CueGlyph accent="#FF5A4F" animated cue={cue} text={cue === "swipe" ? "Swipe" : cue === "caption" ? "Scroll" : "More below"} /></span>
          </div>
          <div className="flex items-center justify-between gap-2 border-t border-paper/10 px-3 py-2.5 sm:px-4 sm:py-3.5">
            <span><span className="block text-[14px] font-semibold text-paper">{CUE_NAMES[cue]}</span><span className={`${mono} text-paper/40 max-sm:hidden`}>{CUE_OWNER[cue]}’s own</span></span>
          </div>
        </li>
      ))}
    </ul>
  );
}

function Bars({ on = true }: { on?: boolean }) {
  return <span aria-hidden="true" className="flex h-4 items-end gap-[3px]">{[8, 15, 11, 16].map((h, i) => <span className={`w-[3px] rounded-full bg-current ${on ? "" : "opacity-40"}`} key={i} style={{ height: h }} />)}</span>;
}

/** The three ways a soundtrack shows on a page: drawn over the same dark hero. */
export function SoundtrackPresentations() {
  const hero = (children: ReactNode) => (
    <div className="relative h-[260px] overflow-hidden rounded-[22px] bg-cover" style={{ backgroundImage: `url(${DEMO_PEOPLE.sena.photo})`, backgroundPosition: "50% 35%" }}>
      <span className="absolute inset-0 bg-gradient-to-t from-[#0D0D0D] via-[#0D0D0D]/30 to-transparent" />
      <span className="absolute bottom-5 left-5 font-serif text-[28px] italic leading-none text-paper">Sena Okafor</span>
      {children}
    </div>
  );
  const items = [
    { id: "ambient", title: "Ambient", body: "A small sound button in the corner. The page stays about you.", visual: hero(<span className="absolute right-4 top-4 grid size-11 place-items-center rounded-full bg-black/40 text-paper backdrop-blur"><Bars /></span>) },
    { id: "minimal", title: "Minimal", body: "The button grows into a strip with the track’s name.", visual: hero(<span className="absolute right-4 top-4 flex h-11 items-center gap-2 rounded-full bg-black/40 pl-3 pr-4 text-[12px] font-medium text-paper backdrop-blur"><Bars />Late sets, vol. 3</span>) },
    { id: "featured", title: "Featured", body: "A player with artwork, for when the music is the point.", visual: hero(<span className="absolute inset-x-4 top-4 flex items-center gap-3 rounded-[16px] bg-black/50 p-2.5 pr-4 text-paper backdrop-blur"><span className="grid size-11 shrink-0 place-items-center rounded-[10px] bg-[radial-gradient(circle_at_30%_30%,#FF5A4F,#2A2A2A_75%)]"><Bars /></span><span className="min-w-0 flex-1"><span className={`${mono} block text-paper/50`}>Now playing</span><span className="block truncate text-[13px] font-semibold">Late sets, vol. 3</span></span><span className="grid size-8 place-items-center rounded-full bg-paper text-[11px] text-ink">▶</span></span>) },
  ] as const;
  return (
    <ul className={`grid gap-4 md:grid-cols-3 lg:gap-6 ${RAIL}`}>
      {items.map((item) => (
        <li className={`flex flex-col rounded-[28px] bg-white p-3 shadow-[0_40px_80px_-60px_rgba(13,13,13,.5)] ${RAIL_ITEM}`} key={item.id}>
          {item.visual}
          <div className="px-4 pb-5 pt-6">
            <p className="flex items-center gap-2"><span className="font-display text-[26px] font-extrabold leading-none tracking-[-0.05em]">{item.title}</span><PlanTag value={plan("soundtrackPresentation", item.id)} /></p>
            <p className="mt-2.5 text-[15px] leading-[1.6] text-ink/62">{item.body}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Where the soundtrack comes from: the four services a member can paste a link from. */
export function SoundtrackSources() {
  return (
    <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 text-[15px] font-semibold">
      <span className={`${mono} text-ink/45`}>Paste a link from</span>
      {["Spotify", "Apple Music", "SoundCloud", "YouTube"].map((name) => <span key={name}>{name}</span>)}
      <span className="flex items-center gap-2 text-[14px] font-normal text-ink/55"><Avatar size={22} who={DEMO_PEOPLE.sena} />Never autoplays: visitors tap to listen.</span>
    </div>
  );
}
