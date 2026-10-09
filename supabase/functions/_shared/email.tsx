/// <reference types="npm:@types/react@19.3.0" />

import React, { type JSX as ReactJSX, type ReactNode } from "react";
import { Body, Container, Head, Html, Img, Link, Preview, render } from "react-email";

declare global {
  // Deno's React 19 JSX transform still expects the global JSX namespace.
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface IntrinsicElements extends ReactJSX.IntrinsicElements {}
  }
}

export type EmailCategory = "security" | "connection" | "reward" | "lifecycle" | "product";
export type EmailTemplateKey =
  | "signup"
  | "invite"
  | "magiclink"
  | "recovery"
  | "email_change"
  | "reauthentication"
  | "account_notice"
  | "welcome"
  | "new_connection"
  | "connection_recap"
  | "guest_claimed"
  | "passport_milestone"
  | "passport_stamp"
  | "creator_application"
  | "creator_approved"
  | "creator_collaboration"
  | "business_action";

type Fact = { label: string; value: string };

/** The one product artifact an email carries. Everything is live HTML, never an image. */
export type EmailObject =
  | { kind: "identity"; label: string; handle: string }
  | { kind: "code"; code: string }
  | { kind: "details"; rows: Fact[] }
  | { kind: "connection"; name: string; line?: string; facts: Fact[]; chip?: string }
  | { kind: "recap"; count: string; label: string; people: string[]; more?: string; facts: Fact[] }
  | { kind: "milestone"; threshold: string; tier: string; index: string; date?: string; rewards: { name: string; kind: string; rarity: string }[] }
  | { kind: "stamp"; title: string; subtitle?: string; type: string; date?: string; extra?: number }
  | { kind: "steps"; handle?: string; steps: { title: string; line: string }[] }
  | { kind: "creator"; handle: string; niche?: string; platforms?: string; status: "review" | "approved" }
  | { kind: "collab"; rows: Fact[]; message?: string }
  | { kind: "actions"; rows: { who: string; what: string; when?: string }[] };

export type EmailContent = {
  category: EmailCategory;
  subject: string;
  preview: string;
  eyebrow: string;
  /** Short, with optional "\n" line breaks for editorial rhythm. */
  headline: string;
  paragraphs: string[];
  object?: EmailObject;
  /** One or two sentences after the object (the anatomy's "Support"). */
  support?: string[];
  action?: { label: string; url: string };
  actionTone?: "ink" | "coral";
  /** Small print under the CTA (auth only). */
  note?: string;
  details?: Fact[];
  unsubscribeUrl?: string;
  preferencesUrl?: string;
  supportUrl?: string;
};

// ── Tokens (light / dark), from the Setuvara email system ─────────────────────
const c = {
  ink: "#0D0D0D",
  paper: "#F5F4EF",
  coral: "#FF5A4F",
  lime: "#C7FF4A",
  blue: "#AFCBFF",
  surface: "#FFFFFF",
  body: "#34332F",
  muted: "#6B6962",
  hairline: "#DCD9CF",
  objectMuted: "#A9A69E",
  objectLine: "#2E2D2A",
};
const font = {
  display: "'Bricolage Grotesque','Helvetica Neue',Helvetica,Arial,sans-serif",
  text: "Geist,'Helvetica Neue',Helvetica,Arial,sans-serif",
  mono: "'Geist Mono',Menlo,Consolas,'Courier New',monospace",
};
const ASSETS = "https://setuvara.com/email";

const signals: Record<EmailCategory, { word: string; swatch: string; outline?: boolean; cta: "ink" | "coral" }> = {
  security: { word: "SECURITY", swatch: c.ink, cta: "ink" },
  product: { word: "PRODUCT", swatch: c.blue, cta: "ink" },
  connection: { word: "CONNECTION", swatch: c.coral, cta: "coral" },
  reward: { word: "REWARD", swatch: c.lime, cta: "coral" },
  lifecycle: { word: "SETUVARA", swatch: "transparent", outline: true, cta: "coral" },
};

const reasons: Record<EmailCategory, string> = {
  security: "You’re receiving this because of a security action on your Setuvara account. Security emails can’t be turned off.",
  connection: "You’re receiving this because someone connected with you on Setuvara.",
  reward: "You’re receiving this because your Setuvara Passport changed.",
  lifecycle: "You’re receiving this because you created a Setuvara.",
  product: "You’re receiving this because of activity on your Setuvara account.",
};

const safeUrl = (value: string) => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
};
const escapeHtml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "S";
const firstName = (name: string) => name.trim().split(/\s+/)[0] || name.trim();

const styles = `
  :root { color-scheme: light dark; supported-color-schemes: light dark; }
  body, table, td { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
  table { border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
  img { border: 0; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic; }
  a { color: ${c.ink}; }
  .sv-cut-dark { display: none; mso-hide: all; }
  @media (prefers-color-scheme: dark) {
    .sv-canvas { background-color: ${c.ink} !important; }
    .sv-primary { color: ${c.paper} !important; }
    .sv-body { color: #D6D3CB !important; }
    .sv-muted { color: ${c.objectMuted} !important; }
    .sv-line { border-color: ${c.objectLine} !important; }
    .sv-rule { background-color: ${c.objectLine} !important; }
    .sv-surface { background-color: #1A1918 !important; border-color: ${c.objectLine} !important; }
    .sv-link { color: ${c.paper} !important; }
    .sv-swatch-ink { background-color: ${c.paper} !important; }
    .sv-swatch-outline { border-color: ${c.paper} !important; }
    .sv-object { background-color: ${c.paper} !important; }
    .sv-object-text { color: ${c.ink} !important; }
    .sv-object-muted { color: ${c.muted} !important; }
    .sv-object-line { border-color: ${c.hairline} !important; }
    .sv-cut-light { display: none !important; }
    .sv-cut-dark { display: block !important; }
    .sv-cta-ink { background-color: ${c.paper} !important; color: ${c.ink} !important; }
  }
  @media only screen and (max-width: 480px) {
    .sv-gutter { padding-left: 22px !important; padding-right: 22px !important; }
    .sv-headline { font-size: 40px !important; line-height: 39px !important; letter-spacing: -1.8px !important; }
    .sv-text { font-size: 16px !important; line-height: 25px !important; }
    .sv-object-pad { padding: 24px 2px 24px 22px !important; }
    .sv-object-name { font-size: 28px !important; line-height: 30px !important; }
    .sv-numeral { font-size: 104px !important; line-height: 88px !important; }
    .sv-stamp-0 { font-size: 44px !important; line-height: 44px !important; }
    .sv-stamp-1 { font-size: 34px !important; line-height: 34px !important; }
    .sv-stamp-2 { font-size: 28px !important; line-height: 28px !important; }
    .sv-stamp-3 { font-size: 22px !important; line-height: 24px !important; }
    .sv-stamp-4 { font-size: 17px !important; line-height: 20px !important; }
    .sv-stack { display: block !important; width: 100% !important; padding-left: 0 !important; padding-right: 0 !important; }
    .sv-stack-gap { padding-top: 14px !important; }
    .sv-cta-table { width: 100% !important; }
    .sv-cta { display: block !important; text-align: center !important; }
    .sv-footer-tag { display: none !important; }
  }
`;

// ── Primitives ───────────────────────────────────────────────────────────────
function Table({ children, width = "100%", className, style }: { children: ReactNode; width?: string | number; className?: string; style?: React.CSSProperties }) {
  return <table role="presentation" width={width} cellPadding={0} cellSpacing={0} border={0} className={className} style={{ borderCollapse: "collapse", ...style }}><tbody>{children}</tbody></table>;
}

function Mono({ children, size = 11, color = c.muted, className = "sv-muted", spacing = 1.5, style }: { children: ReactNode; size?: number; color?: string; className?: string; spacing?: number; style?: React.CSSProperties }) {
  return <span className={className} style={{ fontFamily: font.mono, fontSize: size, lineHeight: `${Math.round(size * 1.4)}px`, letterSpacing: `${spacing}px`, color, textTransform: "uppercase", ...style }}>{children}</span>;
}

function Spacer({ height }: { height: number }) {
  return <tr><td style={{ height, lineHeight: `${height}px`, fontSize: 0 }}>&nbsp;</td></tr>;
}

function Header({ category }: { category: EmailCategory }) {
  const signal = signals[category];
  return (
    <Table>
      <tr>
        <td className="sv-gutter sv-line" style={{ padding: "22px 48px", borderBottom: `1px solid ${c.hairline}` }}>
          <Table>
            <tr>
              <td width={36} valign="middle" style={{ width: 36 }}><Img alt="" height="26" src={`${ASSETS}/setuvara-mark.png`} style={{ display: "block", width: 26, height: 26, fontSize: 0, lineHeight: 0 }} width="26" /></td>
              <td valign="middle"><span className="sv-primary" style={{ fontFamily: font.display, fontSize: 23, lineHeight: "26px", fontWeight: 700, letterSpacing: "-1.1px", color: c.ink }}>setuvara</span></td>
              <td align="right" valign="middle">
                <table role="presentation" cellPadding={0} cellSpacing={0} border={0} style={{ borderCollapse: "collapse" }}><tbody><tr>
                  <td className={signal.outline ? "sv-swatch-outline" : signal.swatch === c.ink ? "sv-swatch-ink" : undefined} style={{ width: signal.outline ? 8 : 10, height: signal.outline ? 8 : 10, fontSize: 0, lineHeight: 0, backgroundColor: signal.swatch, border: signal.outline ? `1px solid ${c.ink}` : undefined }}>&nbsp;</td>
                  <td style={{ paddingLeft: 8 }}><Mono className="sv-primary" color={c.ink} size={11} spacing={1.8}>{signal.word}</Mono></td>
                </tr></tbody></table>
              </td>
            </tr>
          </Table>
        </td>
      </tr>
    </Table>
  );
}

function Eyebrow({ children }: { children: string }) {
  return (
    <table role="presentation" cellPadding={0} cellSpacing={0} border={0} style={{ borderCollapse: "collapse" }}><tbody><tr>
      <td valign="middle" style={{ width: 18 }}><div style={{ width: 18, height: 2, backgroundColor: c.coral, fontSize: 0, lineHeight: 0 }}>&nbsp;</div></td>
      <td valign="middle" style={{ paddingLeft: 10 }}><Mono className="sv-primary" color={c.ink} size={12} spacing={1.9} style={{ fontWeight: 500 }}>{children}</Mono></td>
    </tr></tbody></table>
  );
}

function Headline({ children }: { children: string }) {
  const lines = children.split("\n");
  return (
    <h1 className="sv-primary sv-headline" style={{ margin: 0, fontFamily: font.display, fontSize: 54, lineHeight: "53px", fontWeight: 800, letterSpacing: "-2.4px", color: c.ink, overflowWrap: "anywhere", wordBreak: "break-word" }}>
      {lines.map((line, index) => <React.Fragment key={index}>{index ? <br /> : null}{line}</React.Fragment>)}
    </h1>
  );
}

function BodyText({ children, muted = false, size = 17 }: { children: ReactNode; muted?: boolean; size?: number }) {
  return <p className={muted ? "sv-muted" : "sv-body sv-text"} style={{ margin: 0, fontFamily: font.text, fontSize: size, lineHeight: size >= 17 ? "26px" : "20px", color: muted ? c.muted : c.body }}>{children}</p>;
}

/** Bulletproof CTA: padded link for every client, VML rect for Outlook desktop. 56px tall. */
function Cta({ label, url, tone }: { label: string; url: string; tone: "ink" | "coral" }) {
  const bg = tone === "coral" ? c.coral : c.ink;
  const fg = tone === "coral" ? c.ink : c.paper;
  const toneClass = tone === "ink" ? " sv-cta-ink" : "";
  const vmlWidth = Math.min(520, Math.max(200, Math.round(label.length * 9.2 + 92)));
  const html = `<!--[if mso]><v:rect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${escapeHtml(url)}" style="height:56px;v-text-anchor:middle;width:${vmlWidth}px;" stroked="f" fillcolor="${bg}"><w:anchorlock/><center style="color:${fg};font-family:Arial,sans-serif;font-size:16px;font-weight:bold;">${escapeHtml(label)} &rarr;</center></v:rect><![endif]--><!--[if !mso]><!--><a class="sv-cta${toneClass}" href="${escapeHtml(url)}" style="display:inline-block;padding:18px 28px;border-radius:999px;background-color:${bg};color:${fg};font-family:${font.text.replace(/"/g, "'")};font-size:16px;line-height:20px;font-weight:600;text-decoration:none;mso-hide:all;">${escapeHtml(label)}&nbsp;&nbsp;&rarr;</a><!--<![endif]-->`;
  return (
    <table role="presentation" cellPadding={0} cellSpacing={0} border={0} className="sv-cta-table" style={{ borderCollapse: "collapse" }}><tbody><tr>
      <td className={`sv-cta-cell${toneClass}`} dangerouslySetInnerHTML={{ __html: html }} style={{ borderRadius: 999, backgroundColor: bg }} />
    </tr></tbody></table>
  );
}

/**
 * The Setuvara object: Ink (Paper in dark mode) with the single 60° cut in its top-right
 * corner. The cut is a canvas-coloured PNG; blocked images and Outlook show a square corner.
 */
function SetuvaraObject({ children, cut = true }: { children: ReactNode; cut?: boolean }) {
  return (
    <Table className="sv-object" style={{ backgroundColor: c.ink, borderRadius: 20, borderTopRightRadius: cut ? 0 : 20 }}>
      <tr>
        <td className="sv-object-pad" style={{ padding: "28px 4px 28px 28px", color: c.paper }} valign="top">{children}</td>
        <td valign="top" style={{ width: 30, verticalAlign: "top" }} width={30}>
          {cut ? <>
            <Img alt="" className="sv-cut-light" height="52" src={`${ASSETS}/cut-paper.png`} style={{ display: "block", width: 30, height: 52, backgroundColor: c.ink, fontSize: 0, lineHeight: 0 }} width="30" />
            <Img alt="" className="sv-cut-dark" height="52" src={`${ASSETS}/cut-ink.png`} style={{ display: "none", width: 30, height: 52, backgroundColor: c.paper, fontSize: 0, lineHeight: 0, msoHide: "all" } as React.CSSProperties} width="30" />
          </> : null}
        </td>
      </tr>
    </Table>
  );
}

function Surface({ children, padding = "18px 20px" }: { children: ReactNode; padding?: string }) {
  return <Table className="sv-surface" style={{ backgroundColor: c.surface, border: `1px solid ${c.hairline}`, borderRadius: 14 }}><tr><td style={{ padding }}>{children}</td></tr></Table>;
}

function Avatar({ name, size = 52, fill = c.coral }: { name: string; size?: number; fill?: string }) {
  return (
    <table role="presentation" cellPadding={0} cellSpacing={0} border={0} style={{ borderCollapse: "collapse" }}><tbody><tr>
      <td align="center" valign="middle" style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: fill, color: c.ink, fontFamily: font.display, fontSize: Math.round(size * 0.38), fontWeight: 700, letterSpacing: "-0.5px", lineHeight: `${size}px`, textAlign: "center" }}>{initials(name)}</td>
    </tr></tbody></table>
  );
}

function ObjectFacts({ facts }: { facts: Fact[] }) {
  if (!facts.length) return null;
  const width = `${Math.floor(100 / facts.length)}%`;
  return (
    <Table className="sv-object-line" style={{ borderTop: `1px solid ${c.objectLine}` }}>
      <tr>
        {facts.map((fact, index) => (
          <td className={`sv-stack${index ? " sv-stack-gap" : ""}`} key={fact.label} valign="top" width={width} style={{ paddingTop: 18, paddingRight: index < facts.length - 1 ? 14 : 0 }}>
            <Mono className="sv-object-muted" color={c.objectMuted} size={11} spacing={1.6}>{fact.label}</Mono><br />
            <span className="sv-object-text" style={{ display: "block", marginTop: 6, fontFamily: font.text, fontSize: 16, lineHeight: "22px", fontWeight: 600, color: c.paper, wordBreak: "break-word" }}>{fact.value}</span>
          </td>
        ))}
      </tr>
    </Table>
  );
}

function DetailRows({ rows }: { rows: Fact[] }) {
  return (
    <Surface padding="4px 20px">
      <Table>
        {rows.map((row, index) => (
          <tr key={`${row.label}:${index}`}>
            <td className={`sv-stack${index ? " sv-line" : ""}`} valign="top" width={130} style={{ padding: "14px 16px 14px 0", borderTop: index ? `1px solid ${c.hairline}` : undefined }}><Mono size={11} spacing={1.5}>{row.label}</Mono></td>
            <td className={`sv-stack sv-primary${index ? " sv-line" : ""}`} valign="top" style={{ padding: "14px 0", borderTop: index ? `1px solid ${c.hairline}` : undefined, fontFamily: font.text, fontSize: 15, lineHeight: "22px", fontWeight: 600, color: c.ink, wordBreak: "break-word" }}>{row.value}</td>
          </tr>
        ))}
      </Table>
    </Surface>
  );
}

// Place names must never split mid-word, so the stamp title steps down by length.
const stampSizes = [[56, 44], [48, 34], [40, 28], [30, 22], [24, 17]] as const;
const stampTier = (title: string) => {
  const longest = Math.max(...title.split(/\s+/).map((word) => word.length));
  return longest <= 6 ? 0 : longest <= 9 ? 1 : longest <= 12 ? 2 : longest <= 16 ? 3 : 4;
};

const stampFills: Record<string, string> = { city: c.coral, event: c.blue, country: c.lime, milestone: c.lime };

function ObjectView({ object }: { object: EmailObject }) {
  switch (object.kind) {
    case "identity":
      return (
        <Surface>
          <Mono size={11}>{object.label}</Mono><br />
          <span className="sv-primary" style={{ display: "block", marginTop: 6, fontFamily: font.mono, fontSize: 18, lineHeight: "26px", color: c.ink, wordBreak: "break-all" }}>setuvara.com/<strong style={{ fontWeight: 600 }}>{object.handle}</strong></span>
        </Surface>
      );
    case "code":
      return (
        <Surface padding="22px 20px">
          <Mono size={11}>Verification code</Mono><br />
          <span className="sv-primary" style={{ display: "block", marginTop: 8, fontFamily: font.mono, fontSize: 38, lineHeight: "44px", letterSpacing: "10px", fontWeight: 500, color: c.ink }}>{object.code}</span>
        </Surface>
      );
    case "details":
      return <DetailRows rows={object.rows} />;
    case "connection":
      return (
        <SetuvaraObject>
          <Table>
            <tr>
              <td width={68} valign="middle" style={{ width: 68 }}><Avatar name={object.name} /></td>
              <td valign="middle">
                <span className="sv-object-text sv-object-name" style={{ display: "block", fontFamily: font.display, fontSize: 32, lineHeight: "33px", fontWeight: 700, letterSpacing: "-1.1px", color: c.paper, wordBreak: "break-word" }}>{object.name}</span>
                {object.line ? <span className="sv-object-muted" style={{ display: "block", marginTop: 6, fontFamily: font.text, fontSize: 15, lineHeight: "21px", color: c.objectMuted, wordBreak: "break-word" }}>{object.line}</span> : null}
              </td>
            </tr>
          </Table>
          {object.chip ? <Table><Spacer height={16} /><tr><td><span style={{ display: "inline-block", padding: "6px 11px", borderRadius: 999, backgroundColor: c.lime, color: c.ink, fontFamily: font.mono, fontSize: 11, lineHeight: "14px", letterSpacing: "1.4px" }}>{object.chip}</span></td></tr></Table> : null}
          {object.facts.length ? <><div style={{ height: 22, lineHeight: "22px", fontSize: 0 }}>&nbsp;</div><ObjectFacts facts={object.facts} /></> : null}
        </SetuvaraObject>
      );
    case "recap":
      return (
        <SetuvaraObject>
          <span className="sv-object-text sv-numeral" style={{ display: "block", fontFamily: font.display, fontSize: 120, lineHeight: "100px", fontWeight: 800, letterSpacing: "-6px", color: c.paper }}>{object.count}</span>
          <Mono className="sv-object-muted" color={c.objectMuted} size={12} spacing={1.8} style={{ display: "block", marginTop: 10 }}>{object.label}</Mono>
          <Table style={{ marginTop: 18 }}>
            <tr>
              {object.people.map((person, index) => <td key={`${person}:${index}`} width={46} style={{ width: 46, paddingTop: 18 }}><Avatar fill={[c.coral, c.blue, c.lime, c.paper, c.coral][index % 5]} name={person} size={38} /></td>)}
              {object.more ? <td style={{ paddingTop: 18 }}><Mono className="sv-object-text" color={c.paper} size={13} spacing={1}>{object.more}</Mono></td> : <td />}
            </tr>
          </Table>
          {object.facts.length ? <><div style={{ height: 22, lineHeight: "22px", fontSize: 0 }}>&nbsp;</div><ObjectFacts facts={object.facts} /></> : null}
        </SetuvaraObject>
      );
    case "milestone":
      return (
        <>
          <SetuvaraObject>
            <Table>
              <tr>
                <td><Mono className="sv-object-muted" color={c.objectMuted} size={11} spacing={1.6}>Passport · {object.index}</Mono></td>
                <td align="right">{object.date ? <Mono className="sv-object-muted" color={c.objectMuted} size={11} spacing={1.6}>{object.date}</Mono> : null}</td>
              </tr>
            </Table>
            <span className="sv-object-text sv-numeral" style={{ display: "block", marginTop: 14, fontFamily: font.display, fontSize: object.threshold.length > 3 ? 112 : 136, lineHeight: "112px", fontWeight: 800, letterSpacing: "-7px", color: c.paper }}>{object.threshold}</span>
            <div style={{ width: 56, height: 6, marginTop: 18, backgroundColor: c.coral, fontSize: 0, lineHeight: 0 }}>&nbsp;</div>
            <span className="sv-object-text" style={{ display: "block", marginTop: 16, fontFamily: font.mono, fontSize: 14, lineHeight: "20px", letterSpacing: "2px", color: c.paper }}>{object.tier.toUpperCase()}</span>
            <Mono className="sv-object-muted" color={c.objectMuted} size={11} spacing={1.5} style={{ display: "block", marginTop: 4 }}>{object.threshold} unique connections</Mono>
          </SetuvaraObject>
          {object.rewards.length ? (
            <>
              <div style={{ height: 16, lineHeight: "16px", fontSize: 0 }}>&nbsp;</div>
              <Surface padding="6px 20px">
                <Table>
                  {object.rewards.map((reward, index) => (
                    <tr key={reward.name}>
                      <td valign="middle" width={46} className={index ? "sv-line" : undefined} style={{ width: 46, padding: "14px 0", borderTop: index ? `1px solid ${c.hairline}` : undefined }}>
                        <div style={{ width: 34, height: 34, borderRadius: 9, backgroundColor: index % 2 ? c.lime : c.coral, fontSize: 0, lineHeight: 0 }}>&nbsp;</div>
                      </td>
                      <td valign="middle" className={index ? "sv-line" : undefined} style={{ padding: "14px 0", borderTop: index ? `1px solid ${c.hairline}` : undefined }}>
                        <span className="sv-primary" style={{ display: "block", fontFamily: font.display, fontSize: 19, lineHeight: "22px", fontWeight: 700, letterSpacing: "-0.4px", color: c.ink }}>{reward.name}</span>
                        <Mono size={10} spacing={1.4} style={{ display: "block", marginTop: 4 }}>{reward.kind} · {reward.rarity}</Mono>
                      </td>
                    </tr>
                  ))}
                </Table>
              </Surface>
            </>
          ) : null}
        </>
      );
    case "stamp": {
      const fill = stampFills[object.type] ?? c.coral;
      return (
        <Table style={{ backgroundColor: fill, borderRadius: 6 }}>
          <tr>
            <td style={{ padding: 8 }}>
              <Table style={{ border: `2px dashed rgba(13,13,13,0.38)`, borderRadius: 4 }}>
                <tr>
                  <td style={{ padding: "18px 20px 0" }}>
                    <Table><tr>
                      <td><span style={{ fontFamily: font.mono, fontSize: 11, lineHeight: "14px", letterSpacing: "2px", color: c.ink }}>SETUVARA PASSPORT</span></td>
                      <td align="right" width={24}><Img alt="" height="20" src={`${ASSETS}/setuvara-mark.png`} style={{ display: "block", width: 20, height: 20, fontSize: 0, lineHeight: 0 }} width="20" /></td>
                    </tr></Table>
                  </td>
                </tr>
                <tr><td style={{ padding: "26px 20px 0" }}><span className={`sv-stamp-${stampTier(object.title)}`} style={{ display: "block", fontFamily: font.display, fontSize: stampSizes[stampTier(object.title)][0], lineHeight: `${stampSizes[stampTier(object.title)][0]}px`, overflowWrap: "anywhere", fontWeight: 800, letterSpacing: "-2.4px", color: c.ink, textTransform: "uppercase", wordBreak: "break-word" }}>{object.title}</span></td></tr>
                {object.subtitle ? <tr><td style={{ padding: "10px 20px 0", fontFamily: font.text, fontSize: 15, lineHeight: "21px", fontWeight: 600, color: c.ink }}>{object.subtitle}</td></tr> : null}
                <tr>
                  <td style={{ padding: "22px 20px 18px" }}>
                    <Table style={{ borderTop: `2px dashed rgba(13,13,13,0.38)` }}><tr>
                      <td style={{ paddingTop: 12 }}><span style={{ fontFamily: font.mono, fontSize: 11, lineHeight: "14px", letterSpacing: "1.8px", color: c.ink }}>{object.type.toUpperCase()} STAMP</span></td>
                      <td align="right" style={{ paddingTop: 12 }}>{object.date ? <span style={{ fontFamily: font.mono, fontSize: 11, lineHeight: "14px", letterSpacing: "1.8px", color: c.ink }}>{object.date.toUpperCase()}</span> : null}</td>
                    </tr></Table>
                  </td>
                </tr>
              </Table>
            </td>
          </tr>
        </Table>
      );
    }
    case "steps":
      return (
        <>
          {object.handle ? <><ObjectView object={{ kind: "identity", label: "Your Setuvara", handle: object.handle }} /><div style={{ height: 24, lineHeight: "24px", fontSize: 0 }}>&nbsp;</div></> : null}
          <Table className="sv-line" style={{ borderTop: `1.5px solid ${c.ink}` }}>
            {object.steps.map((step, index) => (
              <tr key={step.title}>
                <td valign="top" width={46} className="sv-line" style={{ width: 46, padding: "16px 0", borderBottom: `1px solid ${c.hairline}` }}><Mono size={12} spacing={1.2}>{String(index + 1).padStart(2, "0")}</Mono></td>
                <td valign="top" className="sv-line" style={{ padding: "14px 0 16px", borderBottom: `1px solid ${c.hairline}` }}>
                  <span className="sv-primary" style={{ display: "block", fontFamily: font.display, fontSize: 22, lineHeight: "26px", fontWeight: 700, letterSpacing: "-0.6px", color: c.ink }}>{step.title}</span>
                  <span className="sv-body" style={{ display: "block", marginTop: 4, fontFamily: font.text, fontSize: 15, lineHeight: "22px", color: c.body }}>{step.line}</span>
                </td>
              </tr>
            ))}
          </Table>
        </>
      );
    case "creator": {
      const approved = object.status === "approved";
      return (
        <SetuvaraObject>
          <span style={{ display: "inline-block", padding: "6px 11px", borderRadius: 999, backgroundColor: approved ? c.lime : c.blue, color: c.ink, fontFamily: font.mono, fontSize: 11, lineHeight: "14px", letterSpacing: "1.4px" }}>{approved ? "APPROVED" : "IN REVIEW"}</span>
          <span className="sv-object-text sv-object-name" style={{ display: "block", marginTop: 18, fontFamily: font.display, fontSize: 32, lineHeight: "33px", fontWeight: 700, letterSpacing: "-1.1px", color: c.paper, wordBreak: "break-word" }}>@{object.handle}</span>
          {object.niche ? <span className="sv-object-muted" style={{ display: "block", marginTop: 6, fontFamily: font.text, fontSize: 15, lineHeight: "21px", color: c.objectMuted }}>{object.niche}</span> : null}
          {object.platforms ? <><div style={{ height: 22, lineHeight: "22px", fontSize: 0 }}>&nbsp;</div><ObjectFacts facts={[{ label: approved ? "Verified platforms" : "Platforms", value: object.platforms }]} /></> : null}
        </SetuvaraObject>
      );
    }
    case "collab":
      return (
        <>
          <DetailRows rows={object.rows} />
          {object.message ? (
            <>
              <div style={{ height: 16, lineHeight: "16px", fontSize: 0 }}>&nbsp;</div>
              <Table><tr>
                <td style={{ width: 3, backgroundColor: c.coral, fontSize: 0, lineHeight: 0 }} width={3}>&nbsp;</td>
                <td className="sv-body" style={{ padding: "4px 0 4px 16px", fontFamily: font.text, fontSize: 16, lineHeight: "25px", color: c.body }}>“{object.message}”</td>
              </tr></Table>
            </>
          ) : null}
        </>
      );
    case "actions":
      return (
        <Surface padding="4px 20px">
          <Table>
            {object.rows.map((row, index) => (
              <tr key={`${row.who}:${index}`}>
                <td valign="middle" width={52} className={index ? "sv-line" : undefined} style={{ width: 52, padding: "14px 0", borderTop: index ? `1px solid ${c.hairline}` : undefined }}><Avatar fill={[c.coral, c.blue, c.lime][index % 3]} name={row.who} size={38} /></td>
                <td valign="middle" className={index ? "sv-line" : undefined} style={{ padding: "14px 0", borderTop: index ? `1px solid ${c.hairline}` : undefined }}>
                  <span className="sv-primary" style={{ display: "block", fontFamily: font.text, fontSize: 15, lineHeight: "21px", color: c.ink }}><strong>{row.who}</strong> {row.what}</span>
                  {row.when ? <Mono size={10} spacing={1.4} style={{ display: "block", marginTop: 3 }}>{row.when}</Mono> : null}
                </td>
              </tr>
            ))}
          </Table>
        </Surface>
      );
  }
}

function Footer({ category, unsubscribeUrl, preferencesUrl, supportUrl }: { category: EmailCategory; unsubscribeUrl?: string; preferencesUrl?: string; supportUrl?: string }) {
  const links = category === "security" ? [] : [
    preferencesUrl ? { href: preferencesUrl, label: "Email preferences" } : null,
    unsubscribeUrl ? { href: unsubscribeUrl, label: "Unsubscribe" } : null,
    supportUrl ? { href: supportUrl, label: "Support" } : null,
  ].filter((link): link is { href: string; label: string } => Boolean(link));
  return (
    <Table>
      <tr>
        <td className="sv-gutter sv-line" style={{ padding: "28px 48px 40px", borderTop: `1px solid ${c.hairline}` }}>
          <Table>
            <tr>
              <td valign="bottom"><span className="sv-primary" style={{ fontFamily: font.display, fontSize: 26, lineHeight: "28px", fontWeight: 800, letterSpacing: "-1.3px", color: c.ink }}>setuvara</span></td>
              <td align="right" valign="bottom" className="sv-footer-tag"><Mono size={10} spacing={1.8}>Meet once. Stay connected.</Mono></td>
            </tr>
          </Table>
          {links.length ? (
            <p style={{ margin: "20px 0 0", fontFamily: font.text, fontSize: 13, lineHeight: "24px" }}>
              {links.map((link, index) => <React.Fragment key={link.label}>{index ? <span className="sv-muted" style={{ color: c.muted }}>&nbsp;&nbsp;·&nbsp;&nbsp;</span> : null}<Link className="sv-link" href={link.href} style={{ color: c.ink, textDecoration: "underline" }}>{link.label}</Link></React.Fragment>)}
            </p>
          ) : null}
          <p className="sv-muted" style={{ margin: "16px 0 0", fontFamily: font.text, fontSize: 12, lineHeight: "18px", color: c.muted }}>{reasons[category]} © 2026 Setuvara</p>
        </td>
      </tr>
    </Table>
  );
}

export function EmailDocument({ content }: { content: EmailContent }) {
  const actionUrl = content.action ? safeUrl(content.action.url) : undefined;
  const tone = content.actionTone ?? signals[content.category].cta;
  const object = content.object ?? (content.details?.length ? { kind: "details" as const, rows: content.details } : undefined);
  return (
    <Html lang="en">
      <Head>
        <meta content="light dark" name="color-scheme" />
        <meta content="light dark" name="supported-color-schemes" />
        <meta content="width=device-width, initial-scale=1" name="viewport" />
        {/* Brand fonts for Apple Mail / iOS; every other client gets the Helvetica fallbacks at the same sizes. */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800&family=Geist:wght@400;500;600&family=Geist+Mono:wght@400;500&display=swap" rel="stylesheet" />
        <style>{styles}</style>
      </Head>
      <Preview>{content.preview}</Preview>
      <Body className="sv-canvas" style={{ margin: 0, padding: 0, backgroundColor: c.paper, color: c.ink, fontFamily: font.text }}>
        <Container className="sv-canvas" style={{ width: "100%", maxWidth: 600, margin: "0 auto", backgroundColor: c.paper }}>
          <Header category={content.category} />
          <Table>
            <tr>
              <td className="sv-gutter" style={{ padding: "44px 48px 48px" }}>
                <Eyebrow>{content.eyebrow.toUpperCase()}</Eyebrow>
                <div style={{ height: 18, lineHeight: "18px", fontSize: 0 }}>&nbsp;</div>
                <Headline>{content.headline}</Headline>
                {content.paragraphs.map((paragraph, index) => <React.Fragment key={`${index}:${paragraph}`}><div style={{ height: index ? 12 : 22, lineHeight: `${index ? 12 : 22}px`, fontSize: 0 }}>&nbsp;</div><BodyText>{paragraph}</BodyText></React.Fragment>)}
                {object ? <><div style={{ height: 28, lineHeight: "28px", fontSize: 0 }}>&nbsp;</div><ObjectView object={object} /></> : null}
                {content.support?.map((line, index) => <React.Fragment key={`support:${index}`}><div style={{ height: index ? 10 : 24, lineHeight: `${index ? 10 : 24}px`, fontSize: 0 }}>&nbsp;</div><BodyText>{line}</BodyText></React.Fragment>)}
                {actionUrl && content.action ? <><div style={{ height: 32, lineHeight: "32px", fontSize: 0 }}>&nbsp;</div><Cta label={content.action.label} tone={tone} url={actionUrl} /></> : null}
                {content.note ? <><div style={{ height: 22, lineHeight: "22px", fontSize: 0 }}>&nbsp;</div><BodyText muted size={13}>{content.note}</BodyText></> : null}
                {actionUrl ? (
                  <>
                    <div className="sv-line" style={{ height: 1, margin: "28px 0 18px", borderTop: `1px solid ${c.hairline}`, fontSize: 0, lineHeight: 0 }}>&nbsp;</div>
                    <BodyText muted size={13}>Button not working? Paste this link into your browser:</BodyText>
                    <p style={{ margin: "6px 0 0", fontFamily: font.mono, fontSize: 12, lineHeight: "18px", wordBreak: "break-all" }}><Link className="sv-link" href={actionUrl} style={{ color: c.ink, textDecoration: "underline", wordBreak: "break-all" }}>{actionUrl}</Link></p>
                  </>
                ) : null}
              </td>
            </tr>
          </Table>
          <Footer category={content.category} preferencesUrl={content.preferencesUrl ? safeUrl(content.preferencesUrl) : undefined} supportUrl={content.supportUrl ? safeUrl(content.supportUrl) : undefined} unsubscribeUrl={content.unsubscribeUrl ? safeUrl(content.unsubscribeUrl) : undefined} />
        </Container>
      </Body>
    </Html>
  );
}

export async function renderEmail(content: EmailContent) {
  const element = <EmailDocument content={content} />;
  const [html, text] = await Promise.all([render(element), render(element, { plainText: true })]);
  return { html, text };
}

// ── Content ──────────────────────────────────────────────────────────────────
const handlePattern = /^[a-z0-9_]{3,24}$/;

export function contentForAuth(input: { template: EmailTemplateKey; url?: string; code?: string; handle?: string; email?: string; userName?: string }): EmailContent {
  const handle = input.handle && handlePattern.test(input.handle) ? input.handle : undefined;
  const action = (label: string) => (input.url ? { label, url: input.url } : undefined);
  const base = { category: "security" as const, paragraphs: [] as string[], actionTone: "ink" as const };
  switch (input.template) {
    case "signup":
      return {
        ...base,
        subject: "Confirm your Setuvara",
        preview: handle ? `Confirm your email and setuvara.com/${handle} is yours.` : "Confirm your email to finish creating your Setuvara.",
        eyebrow: "Confirm your email",
        headline: "One more step.",
        paragraphs: [handle ? "Confirm your email and it’s yours." : "Confirm your email to finish creating your Setuvara."],
        object: handle ? { kind: "identity", label: "Your Setuvara", handle } : undefined,
        action: action("Confirm my email"),
        note: "Didn’t create a Setuvara? You can ignore this email.",
      };
    case "invite":
      return { ...base, subject: "You’re invited to Setuvara", preview: "Accept your invitation and claim your name.", eyebrow: "Your invitation", headline: "Your Setuvara\nis waiting.", paragraphs: ["Accept your invitation to create your identity."], action: action("Accept invitation"), note: "Not expecting this? You can ignore this email." };
    case "magiclink":
      return { ...base, subject: "Your Setuvara sign-in link", preview: "One tap and you’re back in.", eyebrow: "Sign in", headline: "Back to your\nSetuvara.", paragraphs: ["Use this link to sign in. It works once."], action: action("Sign in"), note: "Didn’t try to sign in? You can ignore this email." };
    case "recovery":
      return {
        ...base,
        subject: "Reset your Setuvara password",
        preview: "Choose a new password. The link works once.",
        eyebrow: "Password reset",
        headline: "Reset your\npassword.",
        paragraphs: ["Choose a new password for your Setuvara. This link works once."],
        object: input.email ? { kind: "details", rows: [{ label: "Account", value: input.email }] } : undefined,
        action: action("Reset password"),
        note: "Didn’t ask for this? Ignore this email and your password stays the same.",
      };
    case "email_change":
      return { ...base, subject: "Confirm your new email", preview: "Confirm the change to your Setuvara email.", eyebrow: "Email change", headline: "Confirm your\nnew email.", paragraphs: ["Confirm this address to finish changing the email on your Setuvara."], object: input.email ? { kind: "details", rows: [{ label: "Account", value: input.email }] } : undefined, action: action("Confirm email change"), note: "Didn’t ask for this? Ignore this email. Nothing changes until you confirm." };
    case "reauthentication":
      return { ...base, subject: "Your Setuvara verification code", preview: "Enter this code to confirm it’s you.", eyebrow: "Security check", headline: "Confirm it’s you.", paragraphs: ["Enter this code in Setuvara to continue."], object: input.code ? { kind: "code", code: input.code } : undefined, note: "Didn’t ask for a code? Someone may know your password. Change it in Setuvara." };
    default:
      return { ...base, subject: "Your Setuvara account was updated", preview: "A security update on your account.", eyebrow: "Account security", headline: "Your account\nwas updated.", paragraphs: ["A security setting on your Setuvara changed. If this wasn’t you, reset your password right away."] };
  }
}

// Mirrors the app's milestone ladder and rewards (src/lib/passport/rewards.ts); kept in
// sync by a test, because Edge Functions can't import from the Next.js app.
export const EMAIL_MILESTONES: { threshold: number; name: string; rewards: { name: string; kind: string; rarity: string }[] }[] = [
  { threshold: 5, name: "First Circle", rewards: [{ name: "First Circle", kind: "Stamp style", rarity: "Common" }, { name: "Paper Passport", kind: "Passport cover", rarity: "Common" }] },
  { threshold: 10, name: "Ten Met", rewards: [{ name: "Signal Accent", kind: "Profile accent", rarity: "Uncommon" }, { name: "Signal Share", kind: "Share treatment", rarity: "Uncommon" }] },
  { threshold: 25, name: "In Motion", rewards: [{ name: "Editorial Profile", kind: "Profile treatment", rarity: "Rare" }] },
  { threshold: 50, name: "Signal 50", rewards: [{ name: "Signal 50", kind: "Profile mark", rarity: "Signature" }, { name: "Coral Frame", kind: "QR frame", rarity: "Signature" }] },
  { threshold: 100, name: "Century", rewards: [{ name: "Century Cover", kind: "Passport cover", rarity: "Rare" }, { name: "Century Profile", kind: "Profile treatment", rarity: "Rare" }] },
  { threshold: 250, name: "Connector", rewards: [{ name: "Connector", kind: "Profile treatment", rarity: "Signature" }] },
  { threshold: 500, name: "Network 500", rewards: [{ name: "Network Share", kind: "Share treatment", rarity: "Legendary" }] },
  { threshold: 1000, name: "Thousand Met", rewards: [{ name: "Thousand Met", kind: "Profile mark", rarity: "Legendary" }, { name: "Thousand Cover", kind: "Passport cover", rarity: "Legendary" }] },
];

const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function formatDate(value?: string) {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]} ${months[Number(match[2]) - 1]} ${match[1]}` : value;
}
function listNames(names: string[], more = 0) {
  if (!names.length) return "";
  if (more > 0) return `${names.join(", ")} and ${more} ${more === 1 ? "other" : "others"}`;
  return names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

const welcomeSteps = [
  { title: "Build your identity", line: "Your name, photo and links, in one place." },
  { title: "Choose your Mode", line: "Personal, Event or Business. Show what fits the moment." },
  { title: "Share", line: "A link or a QR. They see the version you chose." },
  { title: "Connect", line: "One tap. They don’t need an account." },
  { title: "Remember", line: "Where and when, saved for both of you." },
];

export function contentForNotification(input: { template: EmailTemplateKey; userName: string; profileUrl: string; details?: Fact[]; unsubscribeUrl?: string; preferencesUrl: string }): EmailContent {
  const get = (label: string) => input.details?.find((detail) => detail.label === label)?.value?.trim() || undefined;
  const all = (label: string) => (input.details ?? []).filter((detail) => detail.label === label).map((detail) => detail.value);
  const footer = { unsubscribeUrl: input.unsubscribeUrl, preferencesUrl: input.preferencesUrl, supportUrl: undefined };
  const to = (path: string) => `${input.profileUrl}${path}`;
  const owner = firstName(input.userName) || "there";

  switch (input.template) {
    case "new_connection": {
      const name = get("name") ?? "Someone";
      const first = firstName(name);
      const where = [get("event"), get("city")].filter(Boolean).join(" · ");
      const when = get("date");
      const line = [get("role"), get("company")].filter(Boolean).join(" · ");
      const facts = [where && { label: "Where", value: where }, when && { label: "When", value: when }, get("mode") && { label: "Mode", value: get("mode")! }].filter(Boolean) as Fact[];
      return {
        category: "connection",
        subject: `You met ${first}`,
        preview: where ? `Connected at ${where}${when ? `, ${when}` : ""}. Add a note while it’s fresh.` : "Saved to your Connections. Add a note while it’s fresh.",
        eyebrow: "You met someone",
        headline: `You met ${first}.`,
        paragraphs: [],
        object: { kind: "connection", name, line: line || undefined, facts },
        support: ["Add a private note while it’s fresh. Only you can see it."],
        action: { label: "View connection", url: to("/app/connections") },
        ...footer,
      };
    }
    case "connection_recap": {
      const people0 = [1, 2, 3, 4, 5].map((index) => get(`person ${index}`)).filter(Boolean) as string[];
      const count = get("count") ?? String(people0.length);
      const event = get("event");
      const people = people0;
      const moreCount = Number((get("more") ?? "").replace(/\D/g, "")) || 0;
      const facts = [event && { label: "Event", value: event }, get("city") && { label: "City", value: get("city")! }, get("dates") && { label: "Dates", value: get("dates")! }].filter(Boolean) as Fact[];
      const names = listNames(people.map(firstName), moreCount);
      return {
        category: "connection",
        subject: event ? `${count} people from ${event} are now in your Connections` : `${count} new people are in your Connections`,
        preview: names ? `${names}. Each is saved with where you met.` : "Each is saved with where you met.",
        eyebrow: event ? `${event} recap` : "Your connections",
        headline: event ? `${count} people\nfrom ${event}.` : `${count} new\nconnections.`,
        paragraphs: [],
        support: ["Each one is saved with where and when you met. Add a note while it’s fresh."],
        object: { kind: "recap", count, label: event ? `People met at ${event}` : "People met", people, more: moreCount ? `+${moreCount}` : undefined, facts },
        action: { label: "See who you met", url: to("/app/connections") },
        ...footer,
      };
    }
    case "guest_claimed": {
      const name = get("name") ?? "Someone you met";
      const first = firstName(name);
      const handle = get("username");
      return {
        category: "connection",
        subject: `${first} claimed their Setuvara`,
        preview: "Your connection now points to their full identity.",
        eyebrow: "They joined",
        headline: `${first} is on\nSetuvara.`,
        paragraphs: [],
        object: { kind: "connection", name, line: handle, facts: [], chip: "NOW ON SETUVARA" },
        support: ["Your connection now points to their full identity, with every Mode they choose to share."],
        action: { label: "View connection", url: to("/app/connections") },
        ...footer,
      };
    }
    case "passport_milestone": {
      const threshold = Number((get("milestone") ?? "").replace(/\D/g, "")) || 0;
      const index = EMAIL_MILESTONES.findIndex((milestone) => milestone.threshold === threshold);
      const milestone = EMAIL_MILESTONES[index];
      const tier = milestone?.name ?? `${threshold} connections`;
      return {
        category: "reward",
        subject: `${tier} unlocked`,
        preview: milestone?.rewards.length ? "Your newest Passport milestone, and a reward to go with it." : "Your newest Passport milestone.",
        eyebrow: "Passport milestone",
        headline: `${threshold} connections.\nUnlocked.`,
        paragraphs: [],
        object: { kind: "milestone", threshold: String(threshold), tier, index: String(index + 1).padStart(2, "0"), date: formatDate(get("unlocked")), rewards: milestone?.rewards ?? [] },
        support: [milestone?.rewards.length ? "Your rewards are waiting in Passport. Wear them whenever you like." : "Every real connection moves your Passport forward."],
        action: { label: "Open Passport", url: to("/app/passport") },
        ...footer,
      };
    }
    case "passport_stamp": {
      const titles = all("stamp");
      const title = titles[0] ?? "A new place";
      return {
        category: "reward",
        subject: `New stamp: ${title}`,
        preview: titles.length > 1 ? `${title} and ${titles.length - 1} more in your Passport.` : `${title} is in your Passport now.`,
        eyebrow: "New stamp",
        headline: `${title},\nstamped.`,
        paragraphs: [],
        object: { kind: "stamp", title, subtitle: get("stamp_subtitle"), type: (get("stamp_type") ?? "city").toLowerCase(), date: formatDate(get("stamp_date")) },
        support: ["Every place you meet someone ends up in your Collection."],
        action: { label: "Open Passport", url: to("/app/passport") },
        ...(titles.length > 1 ? { note: `Also new in your Collection: ${listNames(titles.slice(1))}.` } : {}),
        ...footer,
      };
    }
    case "creator_application": {
      const handle = (get("handle") ?? input.userName).replace(/^@/, "");
      return { category: "product", subject: "We’ve got your Creator application", preview: `@${handle} is in review. We’ll email you either way.`, eyebrow: "Creator access", headline: "Application\nreceived.", paragraphs: ["We review every application by hand. We’ll email you either way."], object: { kind: "creator", handle, niche: get("niche"), platforms: get("platforms"), status: "review" }, action: { label: "Open Setuvara", url: to("/app") }, ...footer };
    }
    case "creator_approved": {
      const handle = (get("handle") ?? input.userName).replace(/^@/, "");
      return { category: "reward", subject: "Creator access approved", preview: "Creator Mode is now live on your Setuvara.", eyebrow: "Creator access", headline: "Approved.", paragraphs: [`@${handle}, Creator Mode is unlocked.`], object: { kind: "creator", handle, niche: get("niche"), platforms: get("platforms"), status: "approved" }, action: { label: "Open Creator Mode", url: to("/app/identity") }, ...footer };
    }
    case "creator_collaboration": {
      const brand = get("brand") ?? "A brand";
      const rows = (["project", "budget", "format", "timing"] as const).map((key) => get(key) && { label: key, value: get(key)! }).filter(Boolean) as Fact[];
      return { category: "connection", subject: `Collab request from ${brand}`, preview: [get("budget"), get("format"), get("timing")].filter(Boolean).join(" · ") || "A new collaboration request.", eyebrow: "Collab request", headline: `${brand}\nwants to collab.`, paragraphs: [], object: { kind: "collab", rows: [{ label: "From", value: brand }, ...rows], message: get("message") }, action: { label: "Review request", url: to("/app") }, ...footer };
    }
    case "business_action": {
      const rows = all("action").map((value) => {
        const [who = "Someone", what = "", when] = value.split("|").map((part) => part.trim());
        return { who, what, when };
      });
      const count = rows.length || Number(get("count") ?? 0);
      return { category: "product", subject: `${count} new ${count === 1 ? "action" : "actions"} on your Business Mode`, preview: rows.map((row) => `${row.who} ${row.what}`).join(", ") || "New activity on your Business Mode.", eyebrow: "Business Mode", headline: `${count} new\n${count === 1 ? "action" : "actions"}.`, paragraphs: [], object: rows.length ? { kind: "actions", rows } : undefined, action: { label: "Open Business Mode", url: to("/app/identity") }, ...footer };
    }
    default: {
      const handle = (get("username") ?? "").replace(/^setuvara\.com\//, "");
      return {
        category: "lifecycle",
        subject: "Your Setuvara starts here",
        preview: "Build your identity, pick a Mode, meet someone.",
        eyebrow: `Welcome, ${owner}`,
        headline: "Your Setuvara\nstarts here.",
        paragraphs: ["One identity, with the right version of you for every room. Here’s the loop."],
        object: { kind: "steps", handle: handlePattern.test(handle) ? handle : undefined, steps: welcomeSteps },
        action: { label: "Build your identity", url: to("/app/identity") },
        ...footer,
      };
    }
  }
}
