"use client";

import { useState, type CSSProperties, type ReactNode } from "react";

import { nameFontClasses } from "@/components/profile/name-fonts";
import { ACCENT_PRESETS, APPEARANCE_LINES, APPEARANCE_NAMES, APPEARANCES, capabilityForField, previewAppearance, SCROLL_CUES, type ScrollCueChoice, type SoundPresentation } from "@/components/profile/appearance";
import { appearanceTheme } from "@/components/profile/appearance-theme";
import { NAME_FONT_NAMES, NAME_FONTS, type NameFont } from "@/components/profile/name-type";
import { ProfileRenderer } from "@/components/profile/profile-renderer";
import type { AppearanceId, ModeSlug, ProfileBlock, ProfileLink, ProfileMode } from "@/components/profile/types";

/**
 * The profile playground (/product): the real profile renderer, driven by local state, so anyone
 * can try every Look, name style, scroll cue and a soundtrack before signing up. Nothing is saved
 * or sent anywhere; Plus choices are marked, not locked, because this is a test drive.
 */

const PEOPLE: Record<ModeSlug, { name: string; username: string; photo: string; face: [number, number]; settings: Record<string, string>; links: [string, string, string][] }> = {
  personal: { name: "Aanya Rao", username: "aanya", photo: "/pricing/aanya-close.webp", face: [45, 50], settings: { location: "Lisbon" }, links: [["instagram", "Instagram", "https://instagram.com/setuvara"], ["spotify", "Sunday run mix", "https://open.spotify.com/playlist/setuvara"], ["whatsapp", "WhatsApp", "https://wa.me/351900000000"]] },
  event: { name: "Theo Laurent", username: "theo", photo: "/pricing/theo-close.webp", face: [47, 46], settings: { eventName: "Slush", city: "Helsinki", role: "Partnerships · Lumen Labs", hereToMeet: "Climate founders and grid operators." }, links: [["linkedin", "LinkedIn", "https://linkedin.com/in/setuvara"], ["url", "Pitch deck", "https://setuvara.com"]] },
  business: { name: "Lucas Meyer", username: "lucas", photo: "/pricing/lucas-close.webp", face: [50, 38], settings: { role: "Partnerships Lead", company: "Northwind", city: "Lisbon", description: "Helping teams meet better at every event." }, links: [["linkedin", "LinkedIn", "https://linkedin.com/in/setuvara"], ["calendly", "Book a 20-min intro", "https://calendly.com/setuvara"]] },
  creator: { name: "Sena Okafor", username: "sena", photo: "/pricing/sena-close.webp", face: [50, 42], settings: { category: "Music · Live sessions", city: "Lagos", tagline: "Late-night sets, recorded live. New session every Friday." }, links: [["youtube", "YouTube", "https://youtube.com/@setuvara"], ["spotify", "Spotify", "https://open.spotify.com/artist/setuvara"], ["instagram", "Instagram", "https://instagram.com/setuvara"]] },
};

const LINE_KEY: Record<ModeSlug, string> = { personal: "location", event: "role", business: "role", creator: "tagline" };
const MODE_ORDER: ModeSlug[] = ["personal", "event", "business", "creator"];
const DEFAULT_LOOK: Record<ModeSlug, AppearanceId> = { personal: "immersive", event: "motion", business: "clean", creator: "film" };
/** A public Spotify playlist, so the soundtrack plays exactly as it does on a member's page. */
const SOUNDTRACK_URL = "https://open.spotify.com/playlist/37i9dQZF1DX4WYpdgoIcn6";
const SOUND_NAMES: Record<SoundPresentation, string> = { ambient: "Ambient", minimal: "Minimal", featured: "Featured" };
const CUE_NAMES: Record<ScrollCueChoice, string> = { auto: "The Look’s own", off: "Off", glide: "Glide", rail: "Rail", orb: "Orb", mouse: "Mouse", beam: "Beam", cascade: "Cascade", caption: "Caption", cards: "Cards", swipe: "Swipe", credits: "Credits" };

/** Whether a value needs Plus, by the same rule the editor and the database trigger use. */
const plus = (field: "theme" | "nameFont" | "scrollCue" | "soundtrackPresentation", value: string) => capabilityForField(field, value) !== null;

const mono = "font-label text-[10px] font-medium uppercase tracking-[0.16em]";

function Group({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <fieldset className="border-t border-ink/10 pt-5">
      <legend className="flex w-full items-baseline justify-between gap-3"><span className="text-[15px] font-semibold">{title}</span>{note ? <span className={`${mono} text-ink/45`}>{note}</span> : null}</legend>
      <div className="mt-3 flex flex-wrap gap-2">{children}</div>
    </fieldset>
  );
}

function Choice({ on, onClick, children, plus = false, title }: { on: boolean; onClick: () => void; children: ReactNode; plus?: boolean; title?: string }) {
  return (
    <button aria-pressed={on} className={`inline-flex min-h-10 items-center gap-1.5 rounded-full px-3.5 text-[13.5px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral ${on ? "bg-ink text-paper" : "bg-white text-ink shadow-[inset_0_0_0_1px_rgba(13,13,13,.12)] hover:shadow-[inset_0_0_0_1.5px_#0D0D0D]"}`} onClick={onClick} title={title} type="button">
      {children}{plus ? <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.12em] ${on ? "bg-coral text-ink" : "bg-[#FFF1EF] text-[#a43d36]"}`}>Plus</span> : null}
    </button>
  );
}

function Connect() {
  return (
    <span className="relative isolate inline-flex h-[var(--sv-connect-h,52px)] w-[var(--sv-connect-w,100%)] min-w-11 items-center gap-2.5 overflow-hidden rounded-[var(--sv-connect-radius,999px)] bg-[var(--sv-connect-bg)] px-[var(--sv-connect-px,20px)] text-[16px] font-semibold text-[var(--sv-connect-fg)] shadow-[var(--sv-connect-edge,none)] after:content-[var(--sv-connect-arrow,none)]" style={{ justifyContent: "var(--sv-connect-justify, center)", "--sv-connect-bg": "var(--sv-connect-fill, #FF5A4F)", "--sv-connect-fg": "var(--sv-connect-ink, #0D0D0D)" } as CSSProperties}>
      <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-[var(--sv-connect-dot,transparent)] [display:var(--sv-connect-dot-display,none)]" />
      <span>Connect</span>
    </span>
  );
}

export function ProfilePlayground() {
  const [slug, setSlug] = useState<ModeSlug>("personal");
  const person = PEOPLE[slug];
  const [name, setName] = useState(person.name);
  const [line, setLine] = useState(person.settings[LINE_KEY[slug]]);
  const [look, setLook] = useState<AppearanceId>(DEFAULT_LOOK[slug]);
  const [accent, setAccent] = useState("#FF5A4F");
  const [font, setFont] = useState<NameFont>("setuvara");
  const [cue, setCue] = useState<ScrollCueChoice>("auto");
  const [sound, setSound] = useState(true);
  const [presentation, setPresentation] = useState<SoundPresentation>("ambient");

  const pickMode = (next: ModeSlug) => {
    setSlug(next);
    setName(PEOPLE[next].name);
    setLine(PEOPLE[next].settings[LINE_KEY[next]]);
    setLook(DEFAULT_LOOK[next]);
  };

  const links: ProfileLink[] = person.links.map(([type, title, url], index) => ({ id: `play-${slug}-${index}`, title, url, link_type: type, is_visible: true, sort_order: index }));
  const blocks: ProfileBlock[] = sound ? [{ id: "play-soundtrack", kind: "music", data: { url: SOUNDTRACK_URL }, is_visible: true, sort_order: 0, is_soundtrack: true }] : [];
  const mode: ProfileMode = {
    id: `play-${slug}`,
    slug,
    label: slug[0].toUpperCase() + slug.slice(1),
    is_enabled: true,
    settings: { ...person.settings, [LINE_KEY[slug]]: line },
    appearance: { theme: look, accent, nameFont: font, scrollCue: cue, soundtrackPresentation: presentation },
    image_path: person.photo,
    image_url: person.photo,
    image_focus_x: person.face[0],
    image_focus_y: person.face[1],
    links,
    blocks,
  };
  const resolved = previewAppearance(mode);
  const usesPlus = plus("theme", look) || plus("nameFont", font) || plus("scrollCue", cue) || (sound && plus("soundtrackPresentation", presentation));

  return (
    <div className="grid gap-10 lg:grid-cols-12 lg:gap-6">
      <div className="order-2 flex flex-col gap-5 lg:order-1 lg:col-span-6 xl:col-span-5">
        <div className="flex rounded-full bg-ink p-1" role="group" aria-label="Mode">
          {MODE_ORDER.map((m) => <button aria-pressed={slug === m} className={`min-h-10 flex-1 rounded-full text-[13.5px] font-semibold capitalize focus-visible:outline-2 focus-visible:outline-coral ${slug === m ? "bg-paper text-ink" : "text-paper/70 hover:text-paper"}`} key={m} onClick={() => pickMode(m)} type="button">{m}</button>)}
        </div>

        <fieldset className="grid gap-3 sm:grid-cols-2">
          <legend className="sr-only">Content</legend>
          <label className="flex flex-col gap-1.5"><span className={`${mono} text-ink/50`}>Name</span><input className="h-12 rounded-[14px] bg-white px-4 text-[15px] shadow-[inset_0_0_0_1px_rgba(13,13,13,.12)] outline-none focus:shadow-[inset_0_0_0_1.5px_#0D0D0D]" maxLength={40} onChange={(event) => setName(event.target.value)} value={name} /></label>
          <label className="flex flex-col gap-1.5"><span className={`${mono} text-ink/50`}>{slug === "creator" ? "Tagline" : slug === "personal" ? "City" : "Role"}</span><input className="h-12 rounded-[14px] bg-white px-4 text-[15px] shadow-[inset_0_0_0_1px_rgba(13,13,13,.12)] outline-none focus:shadow-[inset_0_0_0_1.5px_#0D0D0D]" maxLength={80} onChange={(event) => setLine(event.target.value)} value={line} /></label>
        </fieldset>

        <Group note="2 free · 10 on Plus" title="Look">
          {APPEARANCES.map((id) => <Choice key={id} on={look === id} onClick={() => setLook(id)} plus={plus("theme", id)} title={APPEARANCE_LINES[id]}>{APPEARANCE_NAMES[id]}</Choice>)}
        </Group>

        <Group note="Free, any colour" title="Accent">
          {ACCENT_PRESETS.map((preset) => <button aria-label={preset.id} aria-pressed={accent === preset.hex} className={`size-10 rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral ${accent === preset.hex ? "shadow-[0_0_0_2px_#F5F4EF,0_0_0_4px_#0D0D0D]" : ""}`} key={preset.id} onClick={() => setAccent(preset.hex)} style={{ background: preset.hex }} type="button" />)}
          <label className="relative size-10 overflow-hidden rounded-full bg-[conic-gradient(#FF5A4F,#F5C66E,#C7FF4A,#AFCBFF,#E8A6FF,#FF5A4F)]"><span className="sr-only">Custom colour</span><input className="absolute inset-0 cursor-pointer opacity-0" onChange={(event) => setAccent(event.target.value.toUpperCase())} type="color" value={accent} /></label>
        </Group>

        <Group note="2 free · 6 on Plus" title="Name style">
          {NAME_FONTS.map((id) => <Choice key={id} on={font === id} onClick={() => setFont(id)} plus={plus("nameFont", id)}>{NAME_FONT_NAMES[id]}</Choice>)}
        </Group>

        <Group note="Free: the Look’s own or off" title="Scroll cue">
          {(["auto", "off", ...SCROLL_CUES] as ScrollCueChoice[]).map((id) => <Choice key={id} on={cue === id} onClick={() => setCue(id)} plus={plus("scrollCue", id)}>{CUE_NAMES[id]}</Choice>)}
        </Group>

        <Group note="Every plan" title="Profile soundtrack">
          <Choice on={sound} onClick={() => setSound(!sound)}>{sound ? "On" : "Off"}</Choice>
          {sound ? (Object.keys(SOUND_NAMES) as SoundPresentation[]).map((id) => <Choice key={id} on={presentation === id} onClick={() => setPresentation(id)} plus={plus("soundtrackPresentation", id)}>{SOUND_NAMES[id]}</Choice>) : null}
        </Group>
        <p className="text-[13px] leading-[1.55] text-ink/55">Tap the sound button on the page to hear it. The soundtrack is a Spotify, Apple Music, SoundCloud or YouTube link you choose; it never starts until a visitor turns it on.</p>
        <p className={`${mono} ${usesPlus ? "text-[#a43d36]" : "text-ink/45"}`}>{usesPlus ? "This page uses Plus choices · Free keeps the free ones" : "Everything here is on the Free plan"}</p>
      </div>

      <div className="order-1 lg:order-2 lg:col-span-6 xl:col-span-6 xl:col-start-7">
        <div className="lg:sticky lg:top-24">
          <div className={`${nameFontClasses} mx-auto h-[640px] w-[310px] rounded-[50px] bg-[#1b1b1b] p-[10px] shadow-[0_50px_90px_-40px_rgba(13,13,13,.6),inset_0_0_0_1.5px_rgba(255,255,255,.08)]`}>
            <div className="relative h-full w-full overflow-y-auto overflow-x-hidden rounded-[40px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [&_[data-floating-connect]]:hidden" style={{ background: appearanceTheme(resolved.id, resolved.accent).base }}>
              <div style={{ width: 390, zoom: 290 / 390, "--profile-vh": "844px" } as CSSProperties}>
                <ProfileRenderer mode={mode} nameAs="p" plan="pro" previewLook={resolved} profile={{ id: "playground", username: person.username, display_name: name, bio: "", is_published: true }} sound="live" viewerState="visitor_unconnected" visitorAction={<Connect />} />
              </div>
            </div>
          </div>
          <p className={`${mono} mt-5 text-center text-ink/45`}>Live preview · scroll inside the phone · nothing is saved</p>
        </div>
      </div>
    </div>
  );
}
