"use client";

import { useState, type CSSProperties, type ReactNode } from "react";

import { nameFontClasses } from "@/components/profile/name-fonts";
import { ACCENT_PRESETS, APPEARANCE_LINES, APPEARANCE_NAMES, APPEARANCES, capabilityForField, previewAppearance, SCROLL_CUES, type ScrollCueChoice, type SoundPresentation } from "@/components/profile/appearance";
import { appearanceTheme } from "@/components/profile/appearance-theme";
import { NAME_FONT_NAMES, NAME_FONTS, nameType, nameTypeStyle, type NameFont } from "@/components/profile/name-type";
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

function Section({ step, title, note, children }: { step: string; title: string; note?: string; children: ReactNode }) {
  return (
    <fieldset className="border-t border-ink/[0.08] px-5 py-6 sm:px-7">
      <legend className="sr-only">{title}</legend>
      <div aria-hidden="true" className="flex items-baseline justify-between gap-3">
        <span className="flex items-baseline gap-3"><span className={`${mono} text-coral`}>{step}</span><span className="font-display text-[22px] font-extrabold leading-none tracking-[-0.045em]">{title}</span></span>
        {note ? <span className={`${mono} text-right text-ink/40`}>{note}</span> : null}
      </div>
      <div className="mt-4">{children}</div>
    </fieldset>
  );
}

function PlusDot({ on }: { on: boolean }) {
  return <span className={`rounded-full px-1.5 py-0.5 text-[8.5px] font-medium uppercase tracking-[0.12em] ${on ? "bg-coral text-ink" : "bg-[#FFF1EF] text-[#a43d36]"}`}>Plus</span>;
}

function Chip({ on, onClick, children, plus = false }: { on: boolean; onClick: () => void; children: ReactNode; plus?: boolean }) {
  return (
    <button aria-pressed={on} className={`inline-flex min-h-10 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral ${on ? "bg-ink text-paper shadow-[0_10px_24px_-12px_rgba(13,13,13,.7)]" : "bg-paper text-ink hover:bg-[#ECEAE3]"}`} onClick={onClick} type="button">
      {children}{plus ? <PlusDot on={on} /> : null}
    </button>
  );
}

const ring = (on: boolean) => (on ? "shadow-[0_0_0_2px_#FFFFFF,0_0_0_4px_#0D0D0D]" : "shadow-[inset_0_0_0_1px_rgba(13,13,13,.08)] hover:shadow-[0_0_0_2px_#FFFFFF,0_0_0_3.5px_rgba(13,13,13,.25)]");

/** A small drawing of each Look's composition (photo shape and treatment), in its own colours. */
function LookThumb({ id, photo, face, base, accent }: { id: AppearanceId; photo: string; face: [number, number]; base: string; accent: string }) {
  const img = { backgroundImage: `url(${photo})`, backgroundPosition: `${face[0]}% ${face[1]}%` };
  const fade = <span className="absolute inset-x-0 bottom-0 h-1/2" style={{ background: `linear-gradient(to top, ${base}, transparent)` }} />;
  switch (id) {
    case "immersive": return <><span className="absolute inset-0 bg-cover" style={img} />{fade}</>;
    case "motion": return <><span className="absolute inset-0 -rotate-6 scale-125 bg-cover" style={img} /><span className="absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-black/50 to-transparent" />{fade}</>;
    case "aura": return <><span className="absolute inset-0 scale-150 bg-cover opacity-60 blur-[6px]" style={img} /><span className="absolute left-1/2 top-[22%] size-[46%] -translate-x-1/2 rounded-full bg-cover shadow-[0_0_0_2px_#FFFFFF]" style={img} /></>;
    case "clean": return <span className="absolute inset-x-[16%] top-[16%] h-[52%] rounded-[10px] bg-cover" style={img} />;
    case "glow": return <><span className="absolute inset-x-[14%] bottom-[18%] top-[14%] rounded-t-full bg-cover" style={{ ...img, boxShadow: `0 0 18px ${accent}` }} />{fade}</>;
    case "scene": return <><span className="absolute inset-0 bg-cover" style={img} /><span className="absolute inset-0 mix-blend-multiply" style={{ background: accent, opacity: 0.45 }} />{fade}</>;
    case "frame": return <span className="absolute inset-[18%] bottom-[30%] bg-cover shadow-[0_0_0_3px_#FFFFFF,0_6px_14px_rgba(0,0,0,.4)]" style={img} />;
    case "stack": return <><span className="absolute left-[14%] top-[20%] h-[48%] w-[50%] -rotate-12 rounded-[6px] bg-cover opacity-60" style={img} /><span className="absolute right-[14%] top-[16%] h-[52%] w-[52%] rotate-6 rounded-[6px] bg-cover shadow-[0_4px_10px_rgba(0,0,0,.4)]" style={img} /></>;
    case "social": return <><span className="absolute left-1/2 top-[16%] size-[48%] -translate-x-1/2 rounded-full bg-cover" style={{ ...img, boxShadow: `0 0 0 2px ${accent}` }} /><span className="absolute inset-x-[18%] top-[70%] flex justify-center gap-1">{[0, 1, 2].map((i) => <span className="size-1.5 rounded-full bg-white/70" key={i} />)}</span></>;
    case "film": return <><span className="absolute inset-x-0 top-[18%] h-[50%] bg-cover" style={img} /><span className="absolute inset-x-[20%] top-[73%] h-[3px] rounded-full bg-[#F7E9B8]/70" /></>;
  }
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
      <div className="order-2 lg:order-1 lg:col-span-6 xl:col-span-6">
        <div className="overflow-hidden rounded-[28px] bg-white shadow-[0_50px_100px_-60px_rgba(13,13,13,.55)] sm:rounded-[32px]">
          <div className="flex items-center justify-between gap-3 px-5 pb-5 pt-6 sm:px-7">
            <span className="flex items-center gap-2.5"><span className="size-2 rounded-full bg-coral" /><span className={`${mono} text-ink/55`}>Setuvara studio · demo</span></span>
            <span className={`rounded-full px-3 py-1.5 ${mono} ${usesPlus ? "bg-[#FFF1EF] text-[#a43d36]" : "bg-[#EEF7E4] text-[#3E6B12]"}`}>{usesPlus ? "Uses Plus" : "All Free"}</span>
          </div>
          <div className="px-5 pb-6 sm:px-7">
            <div aria-label="Mode" className="grid grid-cols-4 rounded-[18px] bg-paper p-1" role="group">
              {MODE_ORDER.map((m) => <button aria-pressed={slug === m} className={`min-h-11 rounded-[14px] text-[13.5px] font-semibold capitalize transition focus-visible:outline-2 focus-visible:outline-coral ${slug === m ? "bg-ink text-paper shadow-[0_10px_24px_-12px_rgba(13,13,13,.8)]" : "text-ink/60 hover:text-ink"}`} key={m} onClick={() => pickMode(m)} type="button">{m}</button>)}
            </div>
          </div>

          <Section note="Each Mode keeps its own" step="01" title="Content">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5"><span className={`${mono} text-ink/45`}>Name</span><input className="h-12 rounded-[14px] bg-paper px-4 text-[15px] font-semibold outline-none transition focus:bg-white focus:shadow-[inset_0_0_0_1.5px_#0D0D0D]" maxLength={40} onChange={(event) => setName(event.target.value)} value={name} /></label>
              <label className="flex flex-col gap-1.5"><span className={`${mono} text-ink/45`}>{slug === "creator" ? "Tagline" : slug === "personal" ? "City" : "Role"}</span><input className="h-12 rounded-[14px] bg-paper px-4 text-[15px] outline-none transition focus:bg-white focus:shadow-[inset_0_0_0_1.5px_#0D0D0D]" maxLength={80} onChange={(event) => setLine(event.target.value)} value={line} /></label>
            </div>
          </Section>

          <Section note="2 free · 10 on Plus" step="02" title="Look">
            <div className="grid grid-cols-5 gap-2 sm:gap-2.5">
              {APPEARANCES.map((id) => {
                const theme = appearanceTheme(id, accent);
                return (
                  <button aria-label={`${APPEARANCE_NAMES[id]}${plus("theme", id) ? " (Plus)" : ""}`} aria-pressed={look === id} className="group flex flex-col items-center gap-1.5 focus-visible:outline-none" key={id} onClick={() => setLook(id)} title={APPEARANCE_LINES[id]} type="button">
                    <span className={`relative block aspect-[4/5] w-full overflow-hidden rounded-[14px] transition group-focus-visible:outline group-focus-visible:outline-2 group-focus-visible:outline-coral ${ring(look === id)}`} style={{ background: theme.base }}>
                      <LookThumb accent={accent} base={theme.base} id={id} photo={person.photo} face={person.face} />
                      <span className="absolute bottom-[10%] left-1/2 h-1 w-1/3 -translate-x-1/2 rounded-full" style={{ background: accent }} />
                      {plus("theme", id) ? <span className="absolute right-1 top-1 size-2 rounded-full bg-coral shadow-[0_0_0_2px_rgba(255,255,255,.8)]" /> : null}
                    </span>
                    <span className={`text-[11.5px] font-semibold ${look === id ? "text-ink" : "text-ink/55"}`}>{APPEARANCE_NAMES[id]}</span>
                  </button>
                );
              })}
            </div>
            <p className="mt-3 text-[13px] text-ink/55"><b className="font-semibold text-ink">{APPEARANCE_NAMES[look]}.</b> {APPEARANCE_LINES[look]}</p>
          </Section>

          <Section note="Free, any colour" step="03" title="Accent">
            <div className="flex flex-wrap items-center gap-3">
              {ACCENT_PRESETS.map((preset) => <button aria-label={preset.id} aria-pressed={accent === preset.hex} className={`size-11 rounded-full transition focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-coral ${ring(accent === preset.hex)}`} key={preset.id} onClick={() => setAccent(preset.hex)} style={{ background: preset.hex }} type="button" />)}
              <label className={`relative size-11 cursor-pointer overflow-hidden rounded-full bg-[conic-gradient(#FF5A4F,#F5C66E,#C7FF4A,#AFCBFF,#E8A6FF,#FF5A4F)] ${ring(!ACCENT_PRESETS.some((preset) => preset.hex === accent))}`}><span className="sr-only">Custom colour</span><input className="absolute inset-0 cursor-pointer opacity-0" onChange={(event) => setAccent(event.target.value.toUpperCase())} type="color" value={accent} /></label>
              <span className="ml-1 font-label text-[12px] tracking-[0.08em] text-ink/50">{accent}</span>
            </div>
          </Section>

          <Section note="2 free · 6 on Plus" step="04" title="Name style">
            <div className={`${nameFontClasses} grid grid-cols-3 gap-2`}>
              {NAME_FONTS.map((id) => (
                <button aria-pressed={font === id} className={`relative flex h-[76px] flex-col items-start justify-between rounded-[16px] p-3 text-left transition focus-visible:outline-2 focus-visible:outline-coral ${font === id ? "bg-ink text-paper" : "bg-paper text-ink hover:bg-[#ECEAE3]"}`} key={id} onClick={() => setFont(id)} type="button">
                  <span className="text-[26px] leading-none" style={nameTypeStyle(nameType(id, { serif: false, weight: 800 }))}>Aa</span>
                  <span className="flex w-full items-center justify-between gap-1 text-[11.5px] font-semibold">{NAME_FONT_NAMES[id]}{plus("nameFont", id) ? <PlusDot on={font === id} /> : null}</span>
                </button>
              ))}
            </div>
          </Section>

          <Section note="Free: the Look’s own or off" step="05" title="Scroll cue">
            <div className="flex flex-wrap gap-2">
              {(["auto", "off", ...SCROLL_CUES] as ScrollCueChoice[]).map((id) => <Chip key={id} on={cue === id} onClick={() => setCue(id)} plus={plus("scrollCue", id)}>{CUE_NAMES[id]}</Chip>)}
            </div>
          </Section>

          <Section note="Every plan" step="06" title="Soundtrack">
            <div className="flex items-center gap-4 rounded-[20px] bg-ink p-4 text-paper">
              <span aria-hidden="true" className="relative grid size-14 shrink-0 place-items-center rounded-[14px]" style={{ background: `radial-gradient(circle at 30% 30%, ${accent}, #2A2A2A 75%)` }}><span className="flex h-5 items-end gap-[3px]">{[10, 18, 13, 20].map((h, i) => <span className={`w-[3px] rounded-full bg-paper ${sound ? "animate-pulse" : "opacity-40"}`} key={i} style={{ height: h, animationDelay: `${i * 0.15}s` }} />)}</span></span>
              <span className="min-w-0 flex-1"><span className={`${mono} block text-paper/45`}>Spotify playlist · example</span><span className="mt-1 block truncate text-[15px] font-semibold">{sound ? "Plays when a visitor taps sound" : "No soundtrack on this Mode"}</span></span>
              <button aria-label="Soundtrack" aria-pressed={sound} className={`relative h-8 w-14 shrink-0 rounded-full transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral ${sound ? "bg-coral" : "bg-paper/20"}`} onClick={() => setSound(!sound)} type="button"><span className={`absolute top-1 size-6 rounded-full bg-paper transition-all ${sound ? "left-7" : "left-1"}`} /></button>
            </div>
            {sound ? <div className="mt-3 flex flex-wrap gap-2">{(Object.keys(SOUND_NAMES) as SoundPresentation[]).map((id) => <Chip key={id} on={presentation === id} onClick={() => setPresentation(id)} plus={plus("soundtrackPresentation", id)}>{SOUND_NAMES[id]}</Chip>)}</div> : null}
            <p className="mt-3 text-[13px] leading-[1.55] text-ink/55">Tap the sound button on the page to hear it. Pick a Spotify, Apple Music, SoundCloud or YouTube link; it never starts until a visitor turns it on.</p>
          </Section>
        </div>
      </div>

      <div className="order-1 lg:order-2 lg:col-span-6">
        <div className="relative overflow-hidden rounded-[28px] py-10 sm:rounded-[32px] lg:sticky lg:top-24" style={{ background: `radial-gradient(70% 60% at 50% 35%, ${accent}55, transparent 70%), #ECEAE3` }}>
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
