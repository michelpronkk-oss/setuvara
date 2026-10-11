import type { CSSProperties, ReactNode } from "react";

import type { CoverLook } from "@/lib/passport/view";

const LOOKS: Record<CoverLook, { bg: string; ink: string; sub: string; line: string; accent: string; spine: string; framed: boolean }> = {
  standard: { bg: "#0D0D0D", ink: "#F5F4EF", sub: "#F5F4EFB3", line: "#F5F4EF3D", accent: "#F5F4EF", spine: "#F5F4EF0F", framed: false },
  paper: { bg: "#F5F4EF", ink: "#0D0D0D", sub: "#0D0D0DB3", line: "#0D0D0D33", accent: "#0D0D0D", spine: "#0D0D0D0A", framed: false },
  century: { bg: "#AFCBFF", ink: "#0D0D0D", sub: "#0D0D0DBF", line: "#0D0D0D45", accent: "#0D0D0D", spine: "#0D0D0D12", framed: true },
  thousand: { bg: "#0D0D0D", ink: "#F5F4EF", sub: "#E8D28AD9", line: "#D6B25E80", accent: "#D6B25E", spine: "#D6B25E1A", framed: true },
};

const MARK = "M66.94 31.48A17 17 0 1 0 41.04 44.45L58.96 55.55A17 17 0 1 1 33.06 68.52";

/** The Setuvara mark as drawn on the cover: a stroked S with the two 60° cuts. */
function CoverMark({ id, color, size, x = 0, y = 0, scale }: { id: string; color: string; size?: number; x?: number; y?: number; scale?: number }) {
  const body = (
    <>
      <defs>
        <mask height="100" id={id} maskUnits="userSpaceOnUse" width="100" x="0" y="0">
          <rect fill="#fff" height="100" width="100" />
          <polygon fill="#000" points="63.52,45.42 60.72,40.58 36.48,54.58 39.28,59.42" />
          <polygon fill="#000" points="79.83,16.19 88.33,30.91 64.08,44.91 55.58,30.19" />
          <polygon fill="#000" points="79.83,16.19 88.33,30.91 64.08,44.91 55.58,30.19" transform="rotate(180 50 50)" />
        </mask>
      </defs>
      <g mask={`url(#${id})`}><path d={MARK} fill="none" stroke={color} strokeWidth="22" /></g>
    </>
  );
  if (scale != null) return <g transform={`translate(${x} ${y}) scale(${scale})`}>{body}</g>;
  return <svg aria-hidden="true" height="100%" style={{ width: size, height: size }} viewBox="0 0 100 100" width="100%">{body}</svg>;
}

/**
 * The Passport object (PassportCover.dc): 300 × 420 base, scaled only. Earned covers set the look;
 * the Plus Member finish is layered on top (coral spine edge, stitched rule, MEMBER EDITION).
 * All geometry is in cover units (1u = width / 300) so the object scales without reflow.
 */
export function PassportCover({ look, member = false, empty = false, name, handle, since, connections, stamps, serial, featured, featuredDisc = false, width, className = "", label, idPrefix }: {
  look: CoverLook;
  member?: boolean;
  empty?: boolean;
  name: string;
  handle: string;
  since: string;
  connections: number;
  stamps: number;
  serial: string;
  featured?: ReactNode;
  /** Seal stamps are drawn in ink only; on the dark covers they sit on a paper disc. */
  featuredDisc?: boolean;
  /** CSS width, e.g. "300px" or "min(300px, 100%)". */
  width: string;
  className?: string;
  label?: string;
  /** Unique prefix for SVG ids when several covers render on one page. */
  idPrefix: string;
}) {
  const p = LOOKS[look];
  const u = (value: number) => `calc(${value} * var(--cu))`;
  const cells = empty
    ? [{ k: "ISSUED", v: since || "—" }, { k: "CONNECTIONS", v: "—" }, { k: "STAMPS", v: "—" }]
    : [{ k: "SINCE", v: since || "—" }, { k: "CONNECTIONS", v: connections.toLocaleString("en") }, { k: "STAMPS", v: stamps.toLocaleString("en") }];
  const abs = (style: CSSProperties): CSSProperties => ({ position: "absolute", ...style });
  const markId = `${idPrefix}-k`;
  const ringId = `${idPrefix}-ring`;

  return (
    <div
      aria-hidden={label ? undefined : true}
      aria-label={label}
      className={`relative shrink-0 [container-type:inline-size] ${className}`}
      data-member-finish={member ? "active" : "off"}
      data-passport-cover={look}
      role={label ? "img" : undefined}
      style={{ width, aspectRatio: "300 / 420" }}
    >
      <div className="absolute inset-0 [--cu:calc(100cqw/300)]">
        <div style={abs({ top: u(6), bottom: u(6), left: u(8), right: u(-7), borderRadius: `${u(4)} ${u(16)} ${u(16)} ${u(4)}`, background: "#E6E3DA", border: "1px solid #0D0D0D1F" })} />
        <div style={abs({ top: u(3), bottom: u(3), left: u(4), right: u(-3.5), borderRadius: `${u(4)} ${u(17)} ${u(17)} ${u(4)}`, background: "#EDEBE4", border: "1px solid #0D0D0D1F" })} />
        <div style={abs({ inset: 0, borderRadius: `${u(5)} ${u(18)} ${u(18)} ${u(5)}`, background: p.bg, color: p.ink, overflow: "hidden", boxShadow: `0 1px 0 #0D0D0D14, 0 ${u(24)} ${u(50)} ${u(-26)} #0D0D0D80` })}>
          <div style={abs({ left: 0, top: 0, bottom: 0, width: u(20), background: p.spine })} />
          <div style={abs({ left: u(20), top: 0, bottom: 0, width: "1px", background: p.line })} />
          <div style={abs({ top: u(14), bottom: u(14), left: u(34), right: u(14), border: `1px solid ${p.line}`, borderRadius: `${u(2)} ${u(8)} ${u(8)} ${u(2)}` })} />
          {p.framed && <>
            <div style={abs({ top: u(19), bottom: u(19), left: u(39), right: u(19), border: `0.6px solid ${p.line}`, borderRadius: `${u(1)} ${u(5)} ${u(5)} ${u(1)}` })} />
            <svg aria-hidden="true" fill="none" stroke={p.accent} strokeWidth="1" style={abs({ inset: 0, width: "100%", height: "100%" })} viewBox="0 0 300 420"><path d="M28 14h12M34 8v12M266 14h12M272 8v12M28 406h12M34 400v12M266 406h12M272 400v12" /></svg>
          </>}
          <div style={abs({ left: u(48), right: u(28), top: u(30), display: "flex", justifyContent: "space-between", alignItems: "center" })}>
            <div style={{ display: "flex", alignItems: "center", gap: u(7) }}>
              <span style={{ display: "block", width: u(16), height: u(16) }}><CoverMark color={p.ink} id={`${markId}a`} /></span>
              <span className="font-label" style={{ fontSize: u(9), letterSpacing: ".22em", lineHeight: 1 }}>SETUVARA</span>
            </div>
            <span className="font-label" style={{ fontSize: u(8.5), letterSpacing: ".14em", color: p.sub, lineHeight: 1 }}>{member ? "MEMBER EDITION" : serial}</span>
          </div>
          <div style={abs({ left: u(34), right: u(14), top: u(62), display: "flex", justifyContent: "center" })}>
            <svg aria-hidden="true" style={{ width: u(132), height: u(132) }} viewBox="0 0 140 140">
              <defs><path d="M70,70 m-55,0 a55,55 0 1,1 110,0 a55,55 0 1,1 -110,0" id={ringId} /></defs>
              <circle cx="70" cy="70" fill="none" r="66" stroke={p.accent} strokeWidth="1.2" />
              <circle cx="70" cy="70" fill="none" r="49" stroke={p.accent} strokeWidth="0.7" />
              {p.framed && <circle cx="70" cy="70" fill="none" r="62" stroke={p.accent} strokeDasharray="0.6 2.2" strokeWidth="0.6" />}
              <text className="font-label" fill={p.accent} fontSize="7"><textPath href={`#${ringId}`} lengthAdjust="spacing" textLength="342">ONE IDENTITY · EVERY MOMENT · REMEMBERED · </textPath></text>
              <CoverMark color={p.accent} id={`${markId}b`} scale={0.48} x={46} y={46} />
            </svg>
          </div>
          <span className="font-display" style={abs({ left: u(34), right: u(14), top: u(210), textAlign: "center", fontWeight: 800, fontSize: u(40), letterSpacing: "-.05em", lineHeight: 1 })}>Passport</span>
          <div style={abs({ left: u(48), right: u(28), bottom: u(30), display: "flex", flexDirection: "column", gap: u(10) })}>
            <div style={{ display: "flex", flexDirection: "column", gap: u(3), minWidth: 0 }}>
              <span className="font-display" style={{ fontWeight: 700, fontSize: u(23), letterSpacing: "-.03em", lineHeight: 1.05, overflowWrap: "anywhere", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{name}</span>
              <span className="font-label" style={{ fontSize: u(10), letterSpacing: ".06em", color: p.sub, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>@{handle}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", borderTop: `1px solid ${p.line}`, paddingTop: u(9), gap: u(8) }}>
              {cells.map((cell) => (
                <div key={cell.k} style={{ display: "flex", flexDirection: "column", gap: u(3), minWidth: 0 }}>
                  <span className="font-label" style={{ fontSize: u(7.5), letterSpacing: ".16em", color: p.sub, lineHeight: 1.2 }}>{cell.k}</span>
                  <span className="font-label" style={{ fontSize: u(11), letterSpacing: ".04em", lineHeight: 1.2, whiteSpace: "nowrap" }}>{cell.v}</span>
                </div>
              ))}
            </div>
          </div>
          {member && <>
            <div data-member-edge="" style={abs({ left: 0, top: 0, bottom: 0, width: u(6), background: "#FF5A4F" })} />
            <div style={abs({ left: u(10), top: u(24), bottom: u(24), width: 0, borderLeft: "1px dashed #FF5A4F" })} />
          </>}
          {featured && <div style={abs({ right: u(22), bottom: u(96), width: u(66), height: u(66), opacity: 0.94, ...(featuredDisc && p.bg === "#0D0D0D" ? { background: "#F5F4EF", borderRadius: "50%", padding: u(2) } : {}) })}>{featured}</div>}
        </div>
      </div>
    </div>
  );
}
