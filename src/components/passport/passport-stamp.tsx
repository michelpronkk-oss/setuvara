import { useId } from "react";

import {
  stampRotation, stampSub, stampThreshold, milestoneName, milestoneTier,
  type PassportStampRecord, type PassportStampType, type StampState,
} from "@/lib/passport/view";

export type { PassportStampType } from "@/lib/passport/view";
export type PassportStampStatus = "earned" | "new" | "progress" | "locked";

const INK = "#0D0D0D";
const PAPER = "#F5F4EF";
const GOLD = "#D6B25E";
const DIM = "#0D0D0D80";

type StampProps = {
  type: PassportStampType;
  /** Milestone name, city, event title or ISO country code. */
  title: string;
  /** The mono line printed on the stamp (date, year, place · year). */
  sub?: string;
  /** Country code for the city corner and the country oval. */
  code?: string | null;
  /** Milestone threshold (the hero number). */
  threshold?: number | null;
  state?: StampState;
  /** 0…1, only drawn for the progressing milestone. */
  progress?: number;
  badge?: "NEW" | "FEATURED" | null;
  /** Press angle for earned stamps. Locked and progressing stamps sit at 0°. */
  rotation?: number;
  /** Pixel size; omit to fill the parent box. */
  size?: number;
  className?: string;
  /** Accessible name; omit when a visible label already names the stamp. */
  label?: string;
};

/**
 * One stamp family, four shapes (PassportStamp.dc): milestone seal (tiers I–IV), coral city ticket,
 * soft blue chamfered event card and lime country oval. 120-unit grid, outer r57, type safe r44.5.
 */
export function PassportStamp({ type, title, sub = "", code, threshold, state = "earned", progress = 0, badge = null, rotation = -4, size, className = "", label }: StampProps) {
  const uid = useId();
  const ringId = `ring${uid.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const n = threshold ?? 0;
  const dim = state === "locked" || state === "progress";
  const tier = milestoneTier(n);
  const isMilestone = type === "milestone";
  const tier4 = isMilestone && tier === 4;
  let ink = dim ? DIM : INK;
  let fill = "none";
  let numFill = ink;
  const numStroke = dim ? DIM : "none";
  if (dim) numFill = "none";
  else if (isMilestone && tier === 3) { fill = INK; ink = PAPER; numFill = PAPER; }
  else if (type === "city") fill = "#FF5A4F";
  const dash = dim ? "3 3" : "none";
  const rot = dim ? 0 : rotation;
  const showRingText = size == null || size >= 56;
  const arc = `${Math.max(0, Math.min(1, progress)) * 358.1} 358.1`;
  const name = title;
  const ringText = `SETUVARA · ${name.toLocaleUpperCase("en")} · ${n} ${n === 1 ? "CONNECTION" : "CONNECTIONS"} · `;
  const lines = splitTitle(name);
  const country = (code || name.slice(0, 3)).toUpperCase();
  const cityName = lines.join(" ");
  const citySize = cityName.length > 14 ? 11 : cityName.length > 9 ? 15 : 19;
  const svgStyle = { transform: `rotate(${rot}deg)`, overflow: "visible" as const, display: "block" };
  const box = size != null ? { width: size, height: size } : undefined;

  return (
    <span
      aria-hidden={label ? undefined : true}
      aria-label={label}
      className={`relative block shrink-0 ${size == null ? "size-full" : ""} ${className}`}
      data-passport-stamp={type}
      data-stamp-state={state}
      role={label ? "img" : undefined}
      style={box}
    >
      <svg height="100%" style={svgStyle} viewBox="0 0 120 120" width="100%">
        {isMilestone && !tier4 && <>
          <defs><path d="M60,60 m-49,0 a49,49 0 1,1 98,0 a49,49 0 1,1 -98,0" id={ringId} /></defs>
          <circle cx="60" cy="60" fill={fill} r="57" stroke={ink} strokeDasharray={dash} strokeWidth="2.4" />
          <circle cx="60" cy="60" fill="none" r="44.5" stroke={ink} strokeWidth="1" />
          {(tier === 2 || tier === 3) && <circle cx="60" cy="60" fill="none" r="39.5" stroke={ink} strokeDasharray="0.7 2.4" strokeWidth={tier === 3 ? 3 : 1.6} />}
          <line stroke={ink} strokeWidth="0.8" x1="48" x2="72" y1="78" y2="78" />
          {state === "progress" && <circle cx="60" cy="60" fill="none" r="57" stroke={INK} strokeDasharray={arc} strokeLinecap="round" strokeWidth="2.6" transform="rotate(-90 60 60)" />}
        </>}
        {tier4 && <>
          <defs><path d="M60,60 m-40,0 a40,40 0 1,1 80,0 a40,40 0 1,1 -80,0" id={ringId} /></defs>
          <polygon fill={dim ? "none" : GOLD} points={SCALLOP} stroke={dim ? DIM : GOLD} strokeDasharray={dash} strokeLinejoin="round" strokeWidth="1.6" />
          <circle cx="60" cy="60" fill={dim ? "none" : INK} r="48" stroke={dim ? DIM : GOLD} strokeWidth="1" />
          <circle cx="60" cy="60" fill="none" r="34" stroke={dim ? DIM : GOLD} strokeWidth="0.7" />
          {state === "progress" && <circle cx="60" cy="60" fill="none" r="57" stroke={INK} strokeDasharray={arc} strokeLinecap="round" strokeWidth="2.6" transform="rotate(-90 60 60)" />}
        </>}
        {type === "city" && <>
          <rect fill={fill} height="76" rx="5" stroke={ink} strokeDasharray={dash} strokeWidth="2.2" width="114" x="3" y="22" />
          <rect fill="none" height="65" rx="2" stroke={ink} strokeWidth="0.8" width="103" x="8.5" y="27.5" />
          <line stroke={ink} strokeDasharray="1.4 1.8" strokeWidth="0.8" x1="15" x2="105" y1="75" y2="75" />
        </>}
        {type === "event" && <>
          <polygon fill={dim ? "none" : "#AFCBFF"} points="17,14 103,14 116,27 116,93 103,106 17,106 4,93 4,27" stroke={ink} strokeDasharray={dash} strokeLinejoin="round" strokeWidth="2.2" />
          <polygon fill="none" points="19,20 101,20 110,29 110,91 101,100 19,100 10,91 10,29" stroke={ink} strokeDasharray="1.6 1.6" strokeWidth="0.7" />
        </>}
        {type === "country" && <>
          <ellipse cx="60" cy="60" fill={dim ? "none" : "#C7FF4A"} rx="57" ry="42" stroke={ink} strokeDasharray={dash} strokeWidth="2.2" />
          <ellipse cx="60" cy="60" fill="none" rx="50" ry="35" stroke={ink} strokeDasharray="1.6 1.8" strokeWidth="0.8" />
        </>}

        {isMilestone && !tier4 && <>
          {showRingText && <text className="font-label" fill={ink} fontSize="6.3"><textPath href={`#${ringId}`} lengthAdjust="spacing" textLength="304">{ringText}</textPath></text>}
          <text className="font-display" fill={numFill} fontSize={n >= 100 ? 34 : 42} fontWeight="800" letterSpacing="-1.6" stroke={numStroke} strokeWidth="0.9" textAnchor="middle" x="60" y={n >= 100 ? 69 : 71}>{n}</text>
          <text className="font-label" fill={ink} fontSize="5.6" letterSpacing="0.6" textAnchor="middle" x="60" y="87.5">{sub}</text>
        </>}
        {tier4 && <>
          {showRingText && <text className="font-label" fill={dim ? DIM : GOLD} fontSize="5.4"><textPath href={`#${ringId}`} lengthAdjust="spacing" textLength="248">{ringText}</textPath></text>}
          <text className="font-display" fill={dim ? "none" : "#E8D28A"} fontSize="27" fontWeight="800" letterSpacing="-1.4" stroke={numStroke} strokeWidth="0.8" textAnchor="middle" x="60" y="69">{n}</text>
          <text className="font-label" fill={dim ? DIM : GOLD} fontSize="5" letterSpacing="0.6" textAnchor="middle" x="60" y="80">{sub}</text>
        </>}
        {type === "city" && <>
          <text className="font-label" fill={ink} fontSize="5.6" letterSpacing="0.8" x="15" y="39">CITY · VIA CONTEXT</text>
          <text className="font-label" fill={ink} fontSize="5.6" letterSpacing="0.8" textAnchor="end" x="105" y="39">{code ? code.toUpperCase() : ""}</text>
          <text className="font-display" fill={ink} fontSize={citySize} fontWeight="800" letterSpacing="-0.7" textAnchor="middle" x="60" y="66" {...fitText(cityName, 96, citySize)}>{cityName}</text>
          <text className="font-label" fill={ink} fontSize="6" letterSpacing="0.8" textAnchor="middle" x="60" y="85.5">{sub}</text>
        </>}
        {type === "event" && <>
          <text className="font-label" fill={ink} fontSize="5.8" letterSpacing="1.2" textAnchor="middle" x="60" y="34">EVENT</text>
          <text className="font-display" fill={ink} fontSize="16.5" fontWeight="800" letterSpacing="-0.6" textAnchor="middle" x="60" y={lines[1] ? 57 : 66} {...fitText(lines[0] ?? "", 96, 16.5)}>{lines[0]}</text>
          {lines[1] && <text className="font-display" fill={ink} fontSize="16.5" fontWeight="800" letterSpacing="-0.6" textAnchor="middle" x="60" y="74" {...fitText(lines[1], 96, 16.5)}>{lines[1]}</text>}
          <text className="font-label" fill={ink} fontSize="5.8" letterSpacing="0.8" textAnchor="middle" x="60" y="91" {...fitText(sub, 92, 5.8, 0.62)}>{sub}</text>
        </>}
        {type === "country" && <>
          <text className="font-label" fill={ink} fontSize="5.6" letterSpacing="1.4" textAnchor="middle" x="60" y="40">COUNTRY</text>
          <text className="font-display" fill={ink} fontSize="32" fontWeight="800" letterSpacing="-1" textAnchor="middle" x="60" y="72">{country}</text>
          <text className="font-label" fill={ink} fontSize="5.6" letterSpacing="0.8" textAnchor="middle" x="60" y="86">{sub}</text>
        </>}
      </svg>
      {badge && <span className={`absolute right-[-6px] top-[-2px] whitespace-nowrap rounded-full px-[7px] py-1 font-label text-[9.5px] leading-none tracking-[0.12em] ${badge === "NEW" ? "bg-[#FF5A4F] text-[#0D0D0D]" : "bg-[#0D0D0D] text-[#F5F4EF]"}`}>{badge}</span>}
    </span>
  );
}

/** A stamp drawn from a real passport_stamps record. */
export function PassportRecordStamp({ stamp, isNew = false, featured = false, size, className, label, rotation }: {
  stamp: Pick<PassportStampRecord, "id" | "type" | "key" | "title" | "subtitle" | "countryCode" | "earnedAt">;
  isNew?: boolean;
  featured?: boolean;
  size?: number;
  className?: string;
  label?: string;
  rotation?: number;
}) {
  const threshold = stampThreshold(stamp);
  return (
    <PassportStamp
      badge={isNew ? "NEW" : featured ? "FEATURED" : null}
      className={className}
      code={stamp.countryCode ?? (stamp.type === "country" ? stamp.title : null)}
      label={label}
      rotation={rotation ?? stampRotation(stamp.key ? `${stamp.type}:${stamp.key}` : stamp.id || `${stamp.type}:${stamp.title}`)}
      size={size}
      sub={stampSub({ ...stamp, earnedAt: stamp.earnedAt ?? "" } as PassportStampRecord)}
      threshold={threshold}
      title={stamp.type === "country" ? (stamp.countryCode ?? stamp.title) : stamp.title}
      type={stamp.type}
    />
  );
}

/** The next milestone (progressing) or one after it (locked). */
export function PassportAheadStamp({ threshold, state, count, size, className, label }: { threshold: number; state: "progress" | "locked"; count: number; size?: number; className?: string; label?: string }) {
  return (
    <PassportStamp
      className={className}
      label={label}
      progress={state === "progress" ? count / threshold : 0}
      size={size}
      state={state}
      sub={count === 0 && threshold === 5 ? "WAITING" : "NOT YET"}
      threshold={threshold}
      title={milestoneName(threshold)}
      type="milestone"
    />
  );
}

/** Event titles break into two balanced lines; each line truncates at 12 characters. */
function splitTitle(name: string) {
  if (name.length <= 10) return [name];
  const words = name.split(" ");
  let best: [string, string] = [name, ""];
  let bestDelta = Number.POSITIVE_INFINITY;
  for (let index = 1; index < words.length; index += 1) {
    const a = words.slice(0, index).join(" ");
    const b = words.slice(index).join(" ");
    const delta = Math.abs(a.length - b.length);
    if (delta < bestDelta) { bestDelta = delta; best = [a, b]; }
  }
  return best.filter(Boolean).map((line) => (line.length > 12 ? `${line.slice(0, 11)}…` : line));
}

/** Squeeze only when a line would overrun the inner frame (long or wide Unicode names). */
function fitText(text: string, max: number, fontSize = 11, advance = 0.58) {
  const wide = [...text].reduce((sum, char) => sum + (/[⺀-￯]/.test(char) ? 1.65 : 1), 0);
  return wide * fontSize * advance > max ? { textLength: max, lengthAdjust: "spacingAndGlyphs" as const } : {};
}

const SCALLOP = Array.from({ length: 40 }, (_, index) => {
  const angle = (index / 40) * Math.PI * 2 - Math.PI / 2;
  const radius = index % 2 ? 54 : 59;
  return `${(60 + radius * Math.cos(angle)).toFixed(2)},${(60 + radius * Math.sin(angle)).toFixed(2)}`;
}).join(" ");
