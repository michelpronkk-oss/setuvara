/* eslint-disable @next/next/no-img-element */
import type { CSSProperties, ReactNode } from "react";

import { meetMarkBottom, meetMarkTop } from "@/components/marketing/brand";
import type { ModeSlug } from "@/components/profile/types";

/**
 * The Setuvara social card (design: "Setuvara Social Preview" .dc). One stage for every Mode:
 * a dark canvas, type on the left, the member's phone rising out of a clipped slab in the Mode's
 * colour on the right, and one moment card breaking the phone edge. Pure layout: the data comes
 * from social-card/data.ts (real profiles) or the marketing card, never from here.
 *
 * Satori renders this, so every element with more than one child is an explicit flex box.
 */

export type CardFormat = "link" | "feed";

export const CARD_SIZE: Record<CardFormat, { width: number; height: number }> = {
  link: { width: 1200, height: 630 },
  feed: { width: 1080, height: 1350 },
};

/** Mode is the colour: coral, lime, blue, lilac fill the slab whatever accent the member picked. */
export const MODE_SLAB: Record<ModeSlug, string> = { personal: "#FF5A4F", event: "#C7FF4A", business: "#AFCBFF", creator: "#B79CFF" };
const MODE_ORDER: ModeSlug[] = ["personal", "event", "business", "creator"];
const MODE_NAME: Record<ModeSlug, string> = { personal: "Personal", event: "Event", business: "Business", creator: "Creator" };

export type CardMoment = { title: string; sub: string | null; tag: string | null };

export type CardPhoneSection =
  | { kind: "chips"; items: string[] }
  | { kind: "rows"; items: string[] }
  | { kind: "note"; label: string; text: string }
  | { kind: "tiles"; items: { src: string | null; title: string }[] };

export type CardPhone = {
  name: string;
  /** Shown under the name, already joined ("Amsterdam · she/her"). */
  line: string | null;
  handle: string;
  photo: string | null;
  /** Face point inside the photo, 0–100. */
  focus: { x: number; y: number };
  initials: string;
  accent: string;
  accentInk: string;
  /** The page base of the member's Appearance and whether it is a dark one. */
  base: string;
  dark: boolean;
  cta: string | null;
  tier: "plus" | "pro" | null;
  /** A pill over the photo: the event, or a Live Context while it is on. */
  pill: { text: string; live: boolean } | null;
  section: CardPhoneSection | null;
};

export type SocialCardData = {
  mode: ModeSlug;
  eyebrow: string | null;
  /** One string wraps on its own; two strings are two set lines (marketing copy). */
  headline: string | [string, string];
  lede: string | null;
  /** Display URL, without the protocol. */
  url: string;
  /** Mono label in the slab's top corner. */
  corner: string;
  /** The oversized word sitting in the slab's foot. */
  word: string;
  /** "named" spells the four Modes (marketing). Profiles never name their Mode, so they show dots. */
  rail: "named" | "dots";
  moment: CardMoment | null;
  phone: CardPhone;
};

const INK = "#0D0D0D";
const PAPER = "#F5F4EF";
const DISPLAY = "Bricolage Grotesque";
const MONO = "Geist Mono";

function Mark({ size, color }: { size: number; color: string }) {
  return (
    <svg height={size} viewBox="0 0 100 100" width={size}>
      <path d={meetMarkTop} fill={color} />
      <path d={meetMarkBottom} fill={color} />
    </svg>
  );
}

/** The clipped dash the design uses before every mono label. */
function Dash({ width, height, color }: { width: number; height: number; color: string }) {
  const cut = Math.round(height * 0.58 * 10) / 10;
  return (
    <svg height={height} style={{ flex: "none" }} viewBox={`0 0 ${width} ${height}`} width={width}>
      <polygon fill={color} points={`${cut},0 ${width},0 ${width - cut},${height} 0,${height}`} />
    </svg>
  );
}

function headlineSize(headline: SocialCardData["headline"], format: CardFormat) {
  const scale = format === "feed" ? 108 / 62 : 1;
  if (Array.isArray(headline)) return Math.round(62 * scale);
  const length = Array.from(headline).length;
  const base = length <= 11 ? 80 : length <= 16 ? 70 : length <= 22 ? 62 : length <= 30 ? 54 : 46;
  return Math.round(base * scale);
}

function Headline({ data, format }: { data: SocialCardData; format: CardFormat }) {
  const size = headlineSize(data.headline, format);
  const style: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    fontFamily: DISPLAY,
    fontSize: size,
    fontWeight: 800,
    letterSpacing: format === "feed" ? -0.06 * size : -0.055 * size,
    lineHeight: format === "feed" ? 0.88 : 0.9,
    maxHeight: Math.ceil(size * 0.92 * 2) + 4,
    overflow: "hidden",
  };
  return Array.isArray(data.headline)
    ? <div style={style}><span>{data.headline[0]}</span><span>{data.headline[1]}</span></div>
    : <div style={style}><span style={{ display: "flex", flexWrap: "wrap" }}>{data.headline}</span></div>;
}

function Slab({ data, format, children }: { data: SocialCardData; format: CardFormat; children?: ReactNode }) {
  const feed = format === "feed";
  const chamfer = feed ? 68 : 52;
  const slab = MODE_SLAB[data.mode];
  const { width: canvasWidth, height: canvasHeight } = CARD_SIZE[format];
  const left = feed ? 72 : 648;
  const top = feed ? 690 : 48;
  const width = canvasWidth - left - (feed ? 72 : 48);
  const height = canvasHeight - top;
  return (
    <div
      style={{
        background: slab,
        borderTopLeftRadius: feed ? 36 : 28,
        display: "flex",
        height,
        left,
        overflow: "hidden",
        position: "absolute",
        top,
        width,
      }}
    >
      <span style={{ bottom: feed ? -46 : -34, color: "rgba(13,13,13,.11)", display: "flex", fontFamily: DISPLAY, fontSize: feed ? 260 : 200, fontWeight: 800, left: feed ? 30 : 26, letterSpacing: feed ? -17 : -13, lineHeight: 0.8, position: "absolute", whiteSpace: "nowrap" }}>{data.word}</span>
      <span style={{ color: INK, display: "flex", fontFamily: MONO, fontSize: feed ? 15 : 11, fontWeight: 500, left: feed ? 34 : 26, letterSpacing: feed ? 2.4 : 1.76, position: "absolute", top: feed ? 30 : 22 }}>{data.corner}</span>
      {children}
      {/* The clipped corner, cut with the stage colour (Satori has no clip-path). */}
      <svg height={chamfer} style={{ position: "absolute", right: 0, top: 0 }} viewBox={`0 0 ${chamfer} ${chamfer}`} width={chamfer}>
        <polygon fill={INK} points={`0,0 ${chamfer},0 ${chamfer},${chamfer}`} />
      </svg>
    </div>
  );
}

function Moment({ data, format }: { data: SocialCardData; format: CardFormat }) {
  const moment = data.moment;
  if (!moment) return null;
  const feed = format === "feed";
  const icon = feed ? 52 : 38;
  return (
    <div
      style={{
        alignItems: "center",
        background: PAPER,
        borderRadius: feed ? 24 : 18,
        boxShadow: "0 30px 60px -20px rgba(0,0,0,.8), 0 0 0 1px rgba(13,13,13,.08)",
        color: INK,
        display: "flex",
        gap: feed ? 16 : 12,
        left: feed ? 110 : 584,
        padding: feed ? "18px 20px" : "13px 14px",
        position: "absolute",
        top: feed ? 904 : 256,
        width: feed ? 350 : 262,
      }}
    >
      <div style={{ alignItems: "center", background: MODE_SLAB[data.mode], borderRadius: feed ? 15 : 11, display: "flex", flex: "none", height: icon, justifyContent: "center", width: icon }}>
        <Mark color={INK} size={feed ? 28 : 20} />
      </div>
      <div style={{ display: "flex", flex: 1, flexDirection: "column", gap: feed ? 4 : 3, minWidth: 0 }}>
        <div style={{ alignItems: "center", display: "flex", gap: 8, justifyContent: "space-between" }}>
          <span style={{ fontSize: feed ? 19 : 14, fontWeight: 600, letterSpacing: -0.15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{moment.title}</span>
          {moment.tag && <span style={{ color: "rgba(13,13,13,.65)", flex: "none", fontFamily: MONO, fontSize: feed ? 12 : 9, fontWeight: 500, letterSpacing: feed ? 1.44 : 1.08 }}>{moment.tag}</span>}
        </div>
        {moment.sub && <span style={{ color: "rgba(13,13,13,.7)", fontSize: feed ? 16 : 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{moment.sub}</span>}
      </div>
    </div>
  );
}

function Rail({ data, format }: { data: SocialCardData; format: CardFormat }) {
  return (
    <div style={{ alignItems: "center", display: "flex", gap: data.rail === "named" ? 16 : 9 }}>
      {MODE_ORDER.map((slug) => (
        <div key={slug} style={{ alignItems: "center", display: "flex", gap: 7, fontSize: format === "feed" ? 18 : 13, fontWeight: 600, opacity: slug === data.mode ? 1 : 0.4 }}>
          <div style={{ background: MODE_SLAB[slug], borderRadius: 99, display: "flex", height: 7, width: 7 }} />
          {data.rail === "named" && <span>{MODE_NAME[slug]}</span>}
        </div>
      ))}
    </div>
  );
}

function Wordmark({ size }: { size: "link" | "feed" }) {
  const feed = size === "feed";
  return (
    <div style={{ alignItems: "center", display: "flex", gap: feed ? 12 : 10 }}>
      <Mark color={PAPER} size={feed ? 36 : 28} />
      <span style={{ fontFamily: DISPLAY, fontSize: feed ? 34 : 26, fontWeight: 700, letterSpacing: feed ? -1.36 : -1.04 }}>Setuvara</span>
    </div>
  );
}

function Eyebrow({ data, format }: { data: SocialCardData; format: CardFormat }) {
  if (!data.eyebrow) return null;
  const feed = format === "feed";
  const accent = MODE_SLAB[data.mode];
  return (
    <div style={{ alignItems: "center", color: accent, display: "flex", fontFamily: MONO, fontSize: feed ? 18 : 13, fontWeight: 500, gap: feed ? 14 : 12, letterSpacing: feed ? 2.88 : 2.08 }}>
      <Dash color={accent} height={feed ? 5 : 4} width={feed ? 30 : 22} />
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{data.eyebrow.toUpperCase()}</span>
    </div>
  );
}

export function SocialCard({ data, format }: { data: SocialCardData; format: CardFormat }) {
  const { width, height } = CARD_SIZE[format];
  const stage: CSSProperties = {
    background: format === "feed"
      ? "radial-gradient(120% 70% at 0% 0%, #1D1B18 0%, #0D0D0D 62%)"
      : "radial-gradient(110% 100% at 0% 0%, #1D1B18 0%, #0D0D0D 62%)",
    color: PAPER,
    display: "flex",
    fontFamily: "Geist",
    height,
    overflow: "hidden",
    position: "relative",
    width,
  };

  if (format === "feed") {
    return (
      <div style={stage}>
        <div style={{ alignItems: "center", display: "flex", justifyContent: "space-between", left: 72, position: "absolute", right: 72, top: 72 }}>
          <Wordmark size="feed" />
          <span style={{ fontFamily: MONO, fontSize: 16, fontWeight: 500, letterSpacing: 0.96 }}>{data.url}</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 28, left: 72, position: "absolute", right: 72, top: 206 }}>
          <Eyebrow data={data} format="feed" />
          <Headline data={data} format="feed" />
          {data.lede && <span style={{ color: "rgba(245,244,239,.75)", fontSize: 27, lineHeight: 1.4, maxHeight: 27 * 1.4 * 2 + 2, maxWidth: 760, overflow: "hidden" }}>{data.lede}</span>}
        </div>
        <Slab data={data} format="feed" />
        {/* The design scales the 300px phone 1.4× from its top centre at x 390. */}
        <div style={{ display: "flex", left: 330, position: "absolute", top: 740 }}>
          <Phone phone={data.phone} scale={1.4} />
        </div>
        <Moment data={data} format="feed" />
      </div>
    );
  }

  return (
    <div style={stage}>
      <Slab data={data} format="link" />
      <div style={{ display: "flex", left: 752, position: "absolute", top: 100 }}>
        <Phone phone={data.phone} scale={1} />
      </div>
      <Moment data={data} format="link" />
      <div style={{ bottom: 52, display: "flex", flexDirection: "column", justifyContent: "space-between", left: 64, position: "absolute", top: 56, width: 540 }}>
        <Wordmark size="link" />
        <div style={{ display: "flex", flexDirection: "column", gap: 22, paddingRight: data.moment ? 24 : 0 }}>
          <Eyebrow data={data} format="link" />
          <Headline data={data} format="link" />
          {data.lede && <span style={{ color: "rgba(245,244,239,.75)", fontSize: 19, lineHeight: 1.45, maxHeight: 19 * 1.45 * 3 + 2, maxWidth: 440, overflow: "hidden" }}>{data.lede}</span>}
        </div>
        <div style={{ alignItems: "center", borderTop: "1px solid rgba(245,244,239,.15)", display: "flex", gap: 20, justifyContent: "space-between", paddingTop: 18 }}>
          <Rail data={data} format="link" />
          <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 500, letterSpacing: 0.72, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{data.url}</span>
        </div>
      </div>
    </div>
  );
}

/**
 * The member's page, as their phone shows it: photo hero with the name, the Connect button in
 * their accent, then one strip of what this Mode leads with. 300 × 620 at scale 1; the stage crops
 * its foot, so everything that matters sits in the top two thirds.
 */
export function Phone({ phone, scale }: { phone: CardPhone; scale: number }) {
  const u = (value: number) => Math.round(value * scale * 100) / 100;
  const ink = phone.dark ? PAPER : INK;
  const muted = phone.dark ? "rgba(245,244,239,.66)" : "rgba(13,13,13,.6)";
  const hairline = phone.dark ? "rgba(245,244,239,.14)" : "rgba(13,13,13,.1)";
  const heroHeight = 372;
  // Over a photo the name is white on the scrim; over the plain accent it takes the accent's ink.
  const onHero = phone.photo ? "#FFFFFF" : phone.accentInk;
  const nameSize = phone.name.length > 22 ? 24 : phone.name.length > 14 ? 28 : 32;

  return (
    <div style={{ background: "#050505", borderRadius: u(46), boxShadow: `0 ${u(40)}px ${u(80)}px -${u(20)}px rgba(0,0,0,.75), 0 0 0 ${u(1)}px rgba(255,255,255,.12)`, display: "flex", height: u(620), padding: u(6), width: u(300) }}>
      <div style={{ background: phone.base, borderRadius: u(40), color: ink, display: "flex", flexDirection: "column", height: "100%", overflow: "hidden", position: "relative", width: "100%" }}>
        <div style={{ background: phone.photo ? "#2A2622" : phone.accent, display: "flex", flex: "none", height: u(heroHeight), position: "relative", width: "100%" }}>
          {phone.photo
            ? <img alt="" height={u(heroHeight)} src={phone.photo} style={{ height: "100%", objectFit: "cover", objectPosition: `${phone.focus.x}% ${phone.focus.y}%`, width: "100%" }} width={u(288)} />
            : (
              <div style={{ alignItems: "center", color: phone.accentInk, display: "flex", fontFamily: DISPLAY, fontSize: u(110), fontWeight: 800, height: "100%", justifyContent: "center", letterSpacing: u(-6), paddingBottom: u(70), width: "100%" }}>{phone.initials}</div>
            )}
          {phone.photo && <div style={{ background: "linear-gradient(180deg, rgba(0,0,0,.3) 0%, rgba(0,0,0,0) 20%, rgba(0,0,0,0) 44%, rgba(0,0,0,.5) 68%, rgba(0,0,0,.82) 100%)", display: "flex", height: "100%", left: 0, position: "absolute", top: 0, width: "100%" }} />}
          <div style={{ alignItems: "center", color: onHero, display: "flex", fontSize: u(11), fontWeight: 600, justifyContent: "space-between", left: u(22), position: "absolute", right: u(22), top: u(11) }}>
            <span>9:41</span>
            <div style={{ background: "#000000", borderRadius: u(13), display: "flex", height: u(24), width: u(84) }} />
            <div style={{ alignItems: "center", display: "flex", gap: u(4) }}>
              <div style={{ background: onHero, borderRadius: u(2), display: "flex", height: u(8), width: u(14) }} />
            </div>
          </div>
          {phone.pill && (
            <div style={{ alignItems: "center", background: "rgba(13,13,13,.55)", border: `${u(1)}px solid rgba(255,255,255,.16)`, borderRadius: u(99), color: "#FFFFFF", display: "flex", fontFamily: MONO, fontSize: u(8.5), fontWeight: 500, gap: u(6), left: u(14), letterSpacing: u(1.1), maxWidth: u(258), padding: `${u(6)}px ${u(10)}px`, position: "absolute", top: u(46) }}>
              <div style={{ background: phone.pill.live ? "#C7FF4A" : phone.accent, borderRadius: u(9), display: "flex", flex: "none", height: u(6), width: u(6) }} />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{phone.pill.text.toUpperCase()}</span>
            </div>
          )}
          <div style={{ bottom: u(18), color: onHero, display: "flex", flexDirection: "column", gap: u(5), left: u(18), position: "absolute", right: u(18) }}>
            <div style={{ alignItems: "center", display: "flex", gap: u(8) }}>
              <span style={{ fontFamily: DISPLAY, fontSize: u(nameSize), fontWeight: 800, letterSpacing: u(nameSize * -0.045), lineHeight: 0.95, maxHeight: u(nameSize * 0.95 * 2 + 2), overflow: "hidden" }}>{phone.name}</span>
              {phone.tier && <span style={{ background: phone.tier === "plus" ? "#FF5A4F" : "#D8CCA8", borderRadius: u(99), color: INK, display: "flex", flex: "none", fontFamily: MONO, fontSize: u(7.5), fontWeight: 500, letterSpacing: u(0.9), padding: `${u(3)}px ${u(6)}px` }}>{phone.tier.toUpperCase()}</span>}
            </div>
            <span style={{ fontSize: u(11.5), opacity: 0.78, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{phone.line ? `${phone.handle} · ${phone.line}` : phone.handle}</span>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: u(14), padding: `${u(14)}px ${u(16)}px` }}>
          {phone.cta && (
            <div style={{ alignItems: "center", background: phone.accent, borderRadius: u(99), color: phone.accentInk, display: "flex", fontSize: u(13.5), fontWeight: 600, height: u(42), justifyContent: "center", letterSpacing: u(-0.1) }}>{phone.cta}</div>
          )}
          {phone.section && <PhoneSection hairline={hairline} muted={muted} section={phone.section} u={u} />}
        </div>
      </div>
    </div>
  );
}

function PhoneSection({ section, u, muted, hairline }: { section: CardPhoneSection; u: (value: number) => number; muted: string; hairline: string }) {
  if (section.kind === "chips") {
    return (
      <div style={{ display: "flex", flexWrap: "wrap", gap: u(6) }}>
        {section.items.map((item, index) => (
          <span key={index} style={{ border: `${u(1)}px solid ${hairline}`, borderRadius: u(99), display: "flex", fontSize: u(11), fontWeight: 500, maxWidth: u(130), overflow: "hidden", padding: `${u(6)}px ${u(11)}px`, textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item}</span>
        ))}
      </div>
    );
  }
  if (section.kind === "rows") {
    return (
      <div style={{ display: "flex", flexDirection: "column" }}>
        {section.items.map((item, index) => (
          <div key={index} style={{ alignItems: "center", borderTop: index ? `${u(1)}px solid ${hairline}` : "none", display: "flex", fontSize: u(12.5), fontWeight: 500, justifyContent: "space-between", padding: `${u(9)}px 0` }}>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item}</span>
            <span style={{ color: muted, flex: "none" }}>↗</span>
          </div>
        ))}
      </div>
    );
  }
  if (section.kind === "note") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: u(5) }}>
        <span style={{ color: muted, fontFamily: MONO, fontSize: u(8.5), fontWeight: 500, letterSpacing: u(1.3) }}>{section.label.toUpperCase()}</span>
        <span style={{ fontSize: u(12.5), lineHeight: 1.4, maxHeight: u(12.5 * 1.4 * 3 + 1), overflow: "hidden" }}>{section.text}</span>
      </div>
    );
  }
  return (
    <div style={{ display: "flex", gap: u(6) }}>
      {section.items.map((item, index) => (
        <div key={index} style={{ display: "flex", flex: 1, flexDirection: "column", gap: u(5), minWidth: 0 }}>
          <div style={{ background: hairline, borderRadius: u(10), display: "flex", height: u(84), overflow: "hidden", width: "100%" }}>
            {item.src && <img alt="" height={u(84)} src={item.src} style={{ height: "100%", objectFit: "cover", width: "100%" }} width={u(84)} />}
          </div>
          <span style={{ color: muted, fontSize: u(10), overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.title}</span>
        </div>
      ))}
    </div>
  );
}
