/* eslint-disable @next/next/no-img-element -- static example portraits inside fixed illustrations */
import type { CSSProperties } from "react";

import { nameFontClasses } from "@/components/profile/name-fonts";

import { CastPhone } from "../home/mode-phone";
import { FitCanvas } from "./fit-canvas";
import { QrArt } from "./qr-art";

/**
 * Product visuals for the feature pages, from the Claude Design canvas ("Hero visual · …"). Each is
 * drawn on a fixed 1200×800 canvas and zoomed to its frame (see FeatureVisual), so the composition
 * holds at every width. Phones are live renders of the example cast's pages; every figure is an
 * example and the copy only states what ships.
 */

/** The example cast's page on a phone, scaled to the frame the composition gives it. */
function LivePhone({ slug, left, top, height, transform }: { slug: "personal" | "event"; left: number; top: number; height: number; transform?: string }) {
  const scale = height / 580;
  const style: CSSProperties = { position: "absolute", left, top, width: 280 * scale, height, transform, filter: "drop-shadow(0 50px 60px rgba(13,13,13,.45))" };
  return (
    <div aria-hidden="true" className={nameFontClasses} inert style={style}>
      <div style={{ transform: `scale(${scale})`, transformOrigin: "top left" }}><CastPhone slug={slug} /></div>
    </div>
  );
}

export function ActionsVisual() {
  return (
<div role="img" aria-label="Actions: a sign-up card on Aanya's page and the responses landing in one inbox" style={{ position: "relative", width: "1200px", height: "800px", overflow: "hidden", borderRadius: "32px", background: "#DCE8FA", fontFamily: "var(--font-geist),system-ui,sans-serif", color: "#0D0D0D", isolation: "isolate" }}>
  <span style={{ position: "absolute", left: "-15%", top: "-25%", width: "70%", height: "90%", borderRadius: "50%", background: "#72A7E7", opacity: ".9", filter: "blur(80px)" }}></span>
  <span style={{ position: "absolute", right: "-20%", bottom: "-30%", width: "70%", height: "90%", borderRadius: "50%", background: "#B9D4FB", opacity: ".9", filter: "blur(90px)" }}></span>
  <span style={{ position: "absolute", left: "30%", bottom: "-20%", width: "40%", height: "60%", borderRadius: "50%", background: "#FF7D70", opacity: ".55", filter: "blur(80px)" }}></span>
  <svg aria-hidden="true" width="100%" height="100%" style={{ position: "absolute", inset: "0", opacity: ".22", mixBlendMode: "soft-light" }}><filter id="van"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" stitchTiles="stitch" /></filter><rect width="100%" height="100%" filter="url(#van)" /></svg>

  <LivePhone height={654} left={110} slug="personal" top={70} />
  {/* action card on page */}
  <div style={{ position: "absolute", left: "250px", top: "540px", width: "330px", boxSizing: "border-box", background: "#FFFFFF", borderRadius: "24px", padding: "22px", boxShadow: "0 40px 70px -30px rgba(13,13,13,.5)" }}>
    <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ font: "500 10px var(--font-geist-mono),monospace", letterSpacing: ".16em", color: "#FF5A4F" }}>NEWSLETTER</span><span style={{ font: "500 10px var(--font-geist-mono),monospace", letterSpacing: ".16em", color: "rgba(13,13,13,.4)" }}>ON AANYA’S PAGE</span></div>
    <div style={{ fontFamily: "var(--font-bricolage),sans-serif", fontWeight: "800", fontSize: "28px", letterSpacing: "-0.05em", lineHeight: ".95", marginTop: "12px" }}>Sunday run club, every week.</div>
    <div style={{ display: "flex", gap: "8px", marginTop: "16px" }}><span style={{ flex: "1", height: "44px", borderRadius: "12px", background: "#F5F4EF", display: "flex", alignItems: "center", padding: "0 12px", fontSize: "14px", color: "rgba(13,13,13,.5)" }}>you@email.com</span><span style={{ height: "44px", borderRadius: "999px", background: "#0D0D0D", color: "#F5F4EF", display: "flex", alignItems: "center", padding: "0 16px", fontSize: "14px", fontWeight: "600" }}>Join</span></div>
  </div>

  {/* inbox */}
  <div style={{ position: "absolute", right: "80px", top: "110px", width: "500px", boxSizing: "border-box", background: "#0D0D0D", color: "#F5F4EF", borderRadius: "28px", padding: "28px", boxShadow: "0 60px 100px -40px rgba(13,13,13,.7)" }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}><span style={{ fontFamily: "var(--font-bricolage),sans-serif", fontWeight: "800", fontSize: "34px", letterSpacing: "-0.05em" }}>Actions</span><span style={{ font: "500 10px var(--font-geist-mono),monospace", letterSpacing: ".16em", color: "rgba(245,244,239,.5)" }}>ONE INBOX</span></div>
    <div style={{ display: "flex", gap: "6px", marginTop: "18px" }}><span style={{ background: "#F5F4EF", color: "#0D0D0D", borderRadius: "999px", padding: "7px 13px", fontSize: "13px", fontWeight: "600" }}>All 48</span><span style={{ background: "rgba(245,244,239,.08)", borderRadius: "999px", padding: "7px 13px", fontSize: "13px" }}>Newsletter 31</span><span style={{ background: "rgba(245,244,239,.08)", borderRadius: "999px", padding: "7px 13px", fontSize: "13px" }}>Booking 9</span><span style={{ background: "rgba(245,244,239,.08)", borderRadius: "999px", padding: "7px 13px", fontSize: "13px" }}>Giveaway 8</span></div>
    <div style={{ marginTop: "14px", background: "#1B1B1B", borderRadius: "18px", padding: "4px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "14px 0", borderBottom: "1px solid rgba(245,244,239,.08)" }}><img src="/pricing/theo-close.webp" alt="" style={{ width: "38px", height: "38px", borderRadius: "50%", objectFit: "cover", objectPosition: "50% 25%" }} /><div style={{ flex: "1" }}><div style={{ fontSize: "15px", fontWeight: "600" }}>Theo Laurent</div><div style={{ fontSize: "12px", color: "rgba(245,244,239,.5)", marginTop: "2px" }}>Joined the newsletter · confirmed</div></div><span style={{ font: "500 10px var(--font-geist-mono),monospace", color: "rgba(245,244,239,.4)" }}>2m</span></div>
      <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "14px 0", borderBottom: "1px solid rgba(245,244,239,.08)" }}><img src="/pricing/noor-close.webp" alt="" style={{ width: "38px", height: "38px", borderRadius: "50%", objectFit: "cover", objectPosition: "50% 25%" }} /><div style={{ flex: "1" }}><div style={{ fontSize: "15px", fontWeight: "600" }}>Noor Haddad</div><div style={{ fontSize: "12px", color: "rgba(245,244,239,.5)", marginTop: "2px" }}>Booking request · Sat 18, 09:00</div></div><span style={{ font: "500 10px var(--font-geist-mono),monospace", color: "#FF5A4F" }}>NEW</span></div>
      <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "14px 0" }}><img src="/pricing/sena-close.webp" alt="" style={{ width: "38px", height: "38px", borderRadius: "50%", objectFit: "cover", objectPosition: "50% 25%" }} /><div style={{ flex: "1" }}><div style={{ fontSize: "15px", fontWeight: "600" }}>Sena Okafor</div><div style={{ fontSize: "12px", color: "rgba(245,244,239,.5)", marginTop: "2px" }}>Entered the giveaway</div></div><span style={{ font: "500 10px var(--font-geist-mono),monospace", color: "rgba(245,244,239,.4)" }}>1h</span></div>
    </div>
    <div style={{ display: "flex", justifyContent: "space-between", marginTop: "18px", fontSize: "13px", color: "rgba(245,244,239,.55)" }}><span>Sign-ups join your Audience</span><span style={{ color: "#F5F4EF", fontWeight: "600" }}>Open inbox →</span></div>
  </div>
  <div style={{ position: "absolute", right: "120px", bottom: "70px", background: "#FFFFFF", borderRadius: "999px", padding: "12px 18px", fontSize: "14px", fontWeight: "500", boxShadow: "0 20px 40px -20px rgba(13,13,13,.4)", display: "flex", gap: "10px", alignItems: "center" }}><span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#FF5A4F" }}></span>Form · Newsletter · Booking · Submission · Collab · Giveaway</div>
</div>

  );
}

export function BuilderVisual() {
  return (
<div role="img" aria-label="Builder: a public roadmap with votes beside a verified revenue chart" style={{ position: "relative", width: "1200px", height: "800px", overflow: "hidden", borderRadius: "32px", background: "#F1EBE4", fontFamily: "var(--font-geist),system-ui,sans-serif", color: "#0D0D0D", isolation: "isolate" }}>
  <span style={{ position: "absolute", left: "-15%", top: "-20%", width: "70%", height: "90%", borderRadius: "50%", background: "#FF8A7A", opacity: ".85", filter: "blur(80px)" }}></span>
  <span style={{ position: "absolute", right: "-20%", bottom: "-25%", width: "80%", height: "90%", borderRadius: "50%", background: "#DDD2C4", opacity: ".85", filter: "blur(90px)" }}></span>
  <span style={{ position: "absolute", left: "35%", top: "30%", width: "40%", height: "50%", borderRadius: "50%", background: "#FFF7EF", opacity: ".6", filter: "blur(70px)" }}></span>
  <svg aria-hidden="true" width="100%" height="100%" style={{ position: "absolute", inset: "0", opacity: ".22", mixBlendMode: "soft-light" }}><filter id="vbn"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" stitchTiles="stitch" /></filter><rect width="100%" height="100%" filter="url(#vbn)" /></svg>

  {/* roadmap */}
  <div style={{ position: "absolute", left: "64px", top: "88px", width: "620px", height: "600px", background: "#FFFFFF", borderRadius: "28px", padding: "32px", boxSizing: "border-box", boxShadow: "0 50px 90px -50px rgba(13,13,13,.5)" }}>
    <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
      <span style={{ width: "48px", height: "48px", borderRadius: "14px", background: "#0D0D0D", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="26" height="26" viewBox="0 0 100 100" fill="#FF5A4F" aria-hidden="true"><path d="M66.62 10.38A26 26 0 1 0 37 52.89L43.25 56.49L52.25 40.91L46 37.3A8 8 0 1 1 57.15 26.78Z" /><path d="M33.38 89.62A26 26 0 1 0 63 47.11L56.75 43.51L47.75 59.09L54 62.7A8 8 0 1 1 42.85 73.22Z" /></svg></span>
      <div style={{ flex: "1" }}><div style={{ fontFamily: "var(--font-bricolage),sans-serif", fontWeight: "800", fontSize: "26px", letterSpacing: "-0.05em", lineHeight: "1" }}>Setuvara Teams</div><div style={{ fontSize: "13px", color: "rgba(13,13,13,.5)", marginTop: "4px" }}>SaaS · Launched Mar 2026 · setuvara.com/teams</div></div>
      <span style={{ font: "500 10px var(--font-geist-mono),monospace", letterSpacing: ".16em", textTransform: "uppercase", color: "#FF5A4F" }}>Roadmap</span>
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: "12px", marginTop: "28px" }}>
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", font: "500 10px var(--font-geist-mono),monospace", letterSpacing: ".16em", textTransform: "uppercase", color: "rgba(13,13,13,.5)", paddingBottom: "10px", borderBottom: "2px solid rgba(13,13,13,.12)" }}><span>Planned</span><span>4</span></div>
        <div style={{ marginTop: "12px", background: "#F5F4EF", borderRadius: "16px", padding: "14px" }}><div style={{ fontSize: "14px", fontWeight: "600", lineHeight: "1.3" }}>Shared event pages</div><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "12px" }}><span style={{ fontSize: "12px", color: "rgba(13,13,13,.5)" }}>Events</span><span style={{ background: "#0D0D0D", color: "#F5F4EF", borderRadius: "999px", padding: "4px 10px", fontSize: "12px", fontWeight: "600" }}>▲ 214</span></div></div>
        <div style={{ marginTop: "10px", background: "#F5F4EF", borderRadius: "16px", padding: "14px" }}><div style={{ fontSize: "14px", fontWeight: "600", lineHeight: "1.3" }}>Calendar sync</div><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "12px" }}><span style={{ fontSize: "12px", color: "rgba(13,13,13,.5)" }}>Leads</span><span style={{ border: "1px solid rgba(13,13,13,.18)", borderRadius: "999px", padding: "4px 10px", fontSize: "12px", fontWeight: "600" }}>▲ 96</span></div></div>
        <div style={{ marginTop: "10px", background: "#F5F4EF", borderRadius: "16px", padding: "14px" }}><div style={{ fontSize: "14px", fontWeight: "600", lineHeight: "1.3" }}>Badge printing</div><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "12px" }}><span style={{ fontSize: "12px", color: "rgba(13,13,13,.5)" }}>Events</span><span style={{ border: "1px solid rgba(13,13,13,.18)", borderRadius: "999px", padding: "4px 10px", fontSize: "12px", fontWeight: "600" }}>▲ 40</span></div></div>
      </div>
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", font: "500 10px var(--font-geist-mono),monospace", letterSpacing: ".16em", textTransform: "uppercase", color: "#FF5A4F", paddingBottom: "10px", borderBottom: "2px solid #FF5A4F" }}><span>In progress</span><span>2</span></div>
        <div style={{ marginTop: "12px", background: "#0D0D0D", color: "#F5F4EF", borderRadius: "16px", padding: "14px" }}><div style={{ fontSize: "14px", fontWeight: "600", lineHeight: "1.3" }}>Team leads inbox</div><div style={{ height: "4px", borderRadius: "2px", background: "rgba(245,244,239,.15)", marginTop: "12px" }}><div style={{ width: "70%", height: "4px", borderRadius: "2px", background: "#FF5A4F" }}></div></div><div style={{ display: "flex", justifyContent: "space-between", marginTop: "10px", fontSize: "12px" }}><span style={{ color: "rgba(245,244,239,.55)" }}>70%</span><b>▲ 128</b></div></div>
        <div style={{ marginTop: "10px", background: "#F5F4EF", borderRadius: "16px", padding: "14px" }}><div style={{ fontSize: "14px", fontWeight: "600", lineHeight: "1.3" }}>CSV export for Leads</div><div style={{ height: "4px", borderRadius: "2px", background: "rgba(13,13,13,.1)", marginTop: "12px" }}><div style={{ width: "35%", height: "4px", borderRadius: "2px", background: "#0D0D0D" }}></div></div><div style={{ display: "flex", justifyContent: "space-between", marginTop: "10px", fontSize: "12px" }}><span style={{ color: "rgba(13,13,13,.5)" }}>35%</span><b>▲ 71</b></div></div>
      </div>
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", font: "500 10px var(--font-geist-mono),monospace", letterSpacing: ".16em", textTransform: "uppercase", color: "rgba(13,13,13,.5)", paddingBottom: "10px", borderBottom: "2px solid rgba(13,13,13,.12)" }}><span>Shipped</span><span>9</span></div>
        <div style={{ marginTop: "12px", borderRadius: "16px", padding: "14px", boxShadow: "inset 0 0 0 1px rgba(13,13,13,.1)" }}><div style={{ fontSize: "14px", fontWeight: "600", lineHeight: "1.3", color: "rgba(13,13,13,.55)" }}>Quick QR</div><div style={{ fontSize: "12px", color: "rgba(13,13,13,.45)", marginTop: "10px" }}>✓ 12 Oct</div></div>
        <div style={{ marginTop: "10px", borderRadius: "16px", padding: "14px", boxShadow: "inset 0 0 0 1px rgba(13,13,13,.1)" }}><div style={{ fontSize: "14px", fontWeight: "600", lineHeight: "1.3", color: "rgba(13,13,13,.55)" }}>Guest Connect</div><div style={{ fontSize: "12px", color: "rgba(13,13,13,.45)", marginTop: "10px" }}>✓ 28 Sep</div></div>
      </div>
    </div>
    <div style={{ position: "absolute", left: "32px", right: "32px", bottom: "28px", display: "flex", gap: "16px", alignItems: "center", borderTop: "1px solid rgba(13,13,13,.08)", paddingTop: "18px" }}><span style={{ background: "#FF5A4F", borderRadius: "999px", padding: "9px 16px", fontSize: "13px", fontWeight: "600" }}>Suggest a feature</span><span style={{ fontSize: "13px", color: "rgba(13,13,13,.55)" }}>Visitors vote on what’s next</span></div>
  </div>

  {/* revenue */}
  <div style={{ position: "absolute", right: "64px", top: "196px", width: "540px", height: "480px", background: "#0D0D0D", color: "#F5F4EF", borderRadius: "28px", padding: "32px", boxSizing: "border-box", boxShadow: "0 60px 100px -40px rgba(13,13,13,.7)" }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><span style={{ font: "500 10px var(--font-geist-mono),monospace", letterSpacing: ".16em", textTransform: "uppercase", color: "rgba(245,244,239,.55)" }}>Verified revenue</span><span style={{ display: "flex", alignItems: "center", gap: "8px", background: "rgba(245,244,239,.08)", borderRadius: "999px", padding: "7px 12px", fontSize: "12px", fontWeight: "500" }}><span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#C7FF4A", boxShadow: "0 0 0 3px rgba(199,255,74,.2)" }}></span>Stripe · read-only</span></div>
    <div style={{ display: "flex", alignItems: "baseline", gap: "12px", marginTop: "22px" }}><span style={{ fontFamily: "var(--font-bricolage),sans-serif", fontWeight: "800", fontSize: "96px", letterSpacing: "-0.06em", lineHeight: ".85" }}>$48.2k</span><span style={{ fontSize: "15px", color: "rgba(245,244,239,.55)" }}>MRR</span></div>
    <div style={{ fontSize: "14px", marginTop: "12px" }}><b style={{ color: "#C7FF4A" }}>+18.4%</b> <span style={{ color: "rgba(245,244,239,.55)" }}>vs September · updated daily</span></div>
    <svg viewBox="0 0 476 170" width="476" height="170" aria-hidden="true" style={{ display: "block", marginTop: "28px" }}>
      <line x1="0" y1="56" x2="476" y2="56" stroke="rgba(245,244,239,.08)" /><line x1="0" y1="112" x2="476" y2="112" stroke="rgba(245,244,239,.08)" /><line x1="0" y1="168" x2="476" y2="168" stroke="rgba(245,244,239,.18)" />
      <g fill="rgba(245,244,239,.16)">
        <rect x="0" y="108" width="28" height="60" rx="5" /><rect x="40" y="101" width="28" height="67" rx="5" /><rect x="80" y="99" width="28" height="69" rx="5" /><rect x="120" y="90" width="28" height="78" rx="5" /><rect x="160" y="87" width="28" height="81" rx="5" /><rect x="200" y="76" width="28" height="92" rx="5" /><rect x="240" y="70" width="28" height="98" rx="5" /><rect x="280" y="61" width="28" height="107" rx="5" /><rect x="320" y="55" width="28" height="113" rx="5" /><rect x="360" y="46" width="28" height="122" rx="5" /><rect x="400" y="37" width="28" height="131" rx="5" />
      </g>
      <rect x="440" y="24" width="28" height="144" rx="5" fill="#FF5A4F" />
    </svg>
    <div style={{ display: "flex", justifyContent: "space-between", marginTop: "10px", font: "500 10px var(--font-geist-mono),monospace", letterSpacing: ".12em", color: "rgba(245,244,239,.4)" }}><span>NOV</span><span>FEB</span><span>MAY</span><span>AUG</span><span style={{ color: "#FF5A4F" }}>OCT</span></div>
  </div>
  <div style={{ position: "absolute", right: "96px", top: "122px", background: "#FFFFFF", borderRadius: "999px", padding: "10px 16px", fontSize: "13px", fontWeight: "500", boxShadow: "0 20px 40px -20px rgba(13,13,13,.4)", display: "flex", gap: "8px", alignItems: "center" }}><span style={{ font: "500 10px var(--font-geist-mono),monospace", letterSpacing: ".16em", color: "#FF5A4F" }}>PLUS</span>Read from your provider, not typed</div>
</div>

  );
}

export function AnalyticsVisual() {
  return (
<div role="img" aria-label="Analytics: views, scans and connections by Mode and source over 30 days" style={{ position: "relative", width: "1200px", height: "800px", overflow: "hidden", borderRadius: "32px", background: "#EFFFC9", fontFamily: "var(--font-geist),system-ui,sans-serif", color: "#0D0D0D", isolation: "isolate" }}>
  <span style={{ position: "absolute", left: "-15%", top: "-25%", width: "70%", height: "90%", borderRadius: "50%", background: "#C5FF47", opacity: ".9", filter: "blur(80px)" }}></span>
  <span style={{ position: "absolute", right: "-20%", bottom: "-30%", width: "70%", height: "90%", borderRadius: "50%", background: "#8FDC4E", opacity: ".75", filter: "blur(90px)" }}></span>
  <span style={{ position: "absolute", left: "40%", top: "20%", width: "40%", height: "60%", borderRadius: "50%", background: "#FBFFE8", opacity: ".7", filter: "blur(70px)" }}></span>
  <svg aria-hidden="true" width="100%" height="100%" style={{ position: "absolute", inset: "0", opacity: ".22", mixBlendMode: "soft-light" }}><filter id="vnn"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" stitchTiles="stitch" /></filter><rect width="100%" height="100%" filter="url(#vnn)" /></svg>

  <div style={{ position: "absolute", left: "56px", top: "72px", width: "780px", height: "656px", background: "#0D0D0D", color: "#F5F4EF", borderRadius: "28px", padding: "32px", boxSizing: "border-box", boxShadow: "0 60px 100px -40px rgba(13,13,13,.6)" }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><span style={{ fontFamily: "var(--font-bricolage),sans-serif", fontWeight: "800", fontSize: "32px", letterSpacing: "-0.05em" }}>Analytics</span><div style={{ display: "flex", gap: "4px", background: "rgba(245,244,239,.08)", borderRadius: "999px", padding: "4px" }}><span style={{ padding: "6px 12px", fontSize: "12px", color: "rgba(245,244,239,.6)" }}>7d</span><span style={{ padding: "6px 12px", fontSize: "12px", background: "#F5F4EF", color: "#0D0D0D", borderRadius: "999px", fontWeight: "600" }}>30d</span><span style={{ padding: "6px 12px", fontSize: "12px", color: "rgba(245,244,239,.6)" }}>90d</span></div></div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: "10px", marginTop: "24px" }}>
      <div style={{ background: "#1B1B1B", borderRadius: "18px", padding: "16px" }}><div style={{ font: "500 10px var(--font-geist-mono),monospace", letterSpacing: ".14em", color: "rgba(245,244,239,.5)" }}>VIEWS</div><div style={{ fontFamily: "var(--font-bricolage),sans-serif", fontWeight: "800", fontSize: "38px", letterSpacing: "-0.05em", marginTop: "8px" }}>2,418</div><div style={{ fontSize: "12px", color: "#C7FF4A", marginTop: "4px" }}>+21%</div></div>
      <div style={{ background: "#1B1B1B", borderRadius: "18px", padding: "16px" }}><div style={{ font: "500 10px var(--font-geist-mono),monospace", letterSpacing: ".14em", color: "rgba(245,244,239,.5)" }}>SCANS</div><div style={{ fontFamily: "var(--font-bricolage),sans-serif", fontWeight: "800", fontSize: "38px", letterSpacing: "-0.05em", marginTop: "8px" }}>612</div><div style={{ fontSize: "12px", color: "#C7FF4A", marginTop: "4px" }}>+34%</div></div>
      <div style={{ background: "#1B1B1B", borderRadius: "18px", padding: "16px" }}><div style={{ font: "500 10px var(--font-geist-mono),monospace", letterSpacing: ".14em", color: "rgba(245,244,239,.5)" }}>LINK TAPS</div><div style={{ fontFamily: "var(--font-bricolage),sans-serif", fontWeight: "800", fontSize: "38px", letterSpacing: "-0.05em", marginTop: "8px" }}>944</div><div style={{ fontSize: "12px", color: "rgba(245,244,239,.5)", marginTop: "4px" }}>+3%</div></div>
      <div style={{ background: "#C7FF4A", color: "#0D0D0D", borderRadius: "18px", padding: "16px" }}><div style={{ font: "500 10px var(--font-geist-mono),monospace", letterSpacing: ".14em", color: "rgba(13,13,13,.6)" }}>CONNECTIONS</div><div style={{ fontFamily: "var(--font-bricolage),sans-serif", fontWeight: "800", fontSize: "38px", letterSpacing: "-0.05em", marginTop: "8px" }}>87</div><div style={{ fontSize: "12px", marginTop: "4px", fontWeight: "600" }}>3.6% of views</div></div>
    </div>
    <div style={{ marginTop: "22px", display: "flex", gap: "16px", fontSize: "12px", color: "rgba(245,244,239,.65)" }}><span style={{ display: "flex", alignItems: "center", gap: "6px" }}><span style={{ width: "14px", height: "3px", borderRadius: "2px", background: "#C7FF4A" }}></span>Event</span><span style={{ display: "flex", alignItems: "center", gap: "6px" }}><span style={{ width: "14px", height: "3px", borderRadius: "2px", background: "#AFCBFF" }}></span>Business</span><span style={{ display: "flex", alignItems: "center", gap: "6px" }}><span style={{ width: "14px", height: "3px", borderRadius: "2px", background: "#FF5A4F" }}></span>Personal</span></div>
    <svg viewBox="0 0 716 230" width="716" height="230" aria-hidden="true" style={{ display: "block", marginTop: "12px" }}>
      <line x1="0" y1="76" x2="716" y2="76" stroke="rgba(245,244,239,.07)" /><line x1="0" y1="152" x2="716" y2="152" stroke="rgba(245,244,239,.07)" /><line x1="0" y1="228" x2="716" y2="228" stroke="rgba(245,244,239,.18)" />
      <rect x="420" y="0" width="96" height="228" fill="rgba(199,255,74,.07)" />
      <polyline points="0,200 48,196 96,198 144,190 192,192 240,184 288,186 336,178 384,170 432,92 480,40 528,110 576,160 624,166 672,162 716,158" fill="none" stroke="#C7FF4A" strokeWidth="2.5" strokeLinejoin="round" />
      <polyline points="0,170 48,164 96,168 144,158 192,150 240,152 288,140 336,142 384,134 432,128 480,120 528,124 576,112 624,106 672,100 716,94" fill="none" stroke="#AFCBFF" strokeWidth="2.5" strokeLinejoin="round" />
      <polyline points="0,206 48,208 96,200 144,204 192,198 240,202 288,196 336,200 384,194 432,198 480,192 528,196 576,190 624,194 672,188 716,190" fill="none" stroke="#FF5A4F" strokeWidth="2.5" strokeLinejoin="round" />
      <circle cx="480" cy="40" r="6" fill="#C7FF4A" />
    </svg>
    <div style={{ display: "flex", justifyContent: "space-between", marginTop: "8px", font: "500 10px var(--font-geist-mono),monospace", letterSpacing: ".12em", color: "rgba(245,244,239,.4)" }}><span>SEP 23</span><span>OCT 1</span><span>OCT 8</span><span style={{ color: "#C7FF4A" }}>SLUSH WEEK</span><span>OCT 22</span></div>
    <div style={{ position: "absolute", left: "458px", top: "268px", background: "#F5F4EF", color: "#0D0D0D", borderRadius: "12px", padding: "8px 12px", fontSize: "12px", fontWeight: "600", boxShadow: "0 10px 20px -10px rgba(0,0,0,.6)" }}>Event Mode · 214 scans</div>
  </div>

  <div style={{ position: "absolute", right: "56px", top: "150px", width: "280px", boxSizing: "border-box", background: "#FFFFFF", borderRadius: "24px", padding: "24px", boxShadow: "0 50px 80px -40px rgba(13,13,13,.45)" }}>
    <div style={{ font: "500 10px var(--font-geist-mono),monospace", letterSpacing: ".16em", color: "rgba(13,13,13,.5)" }}>WHERE THEY CAME FROM</div>
    <div style={{ marginTop: "18px", display: "flex", flexDirection: "column", gap: "14px" }}>
      <div><div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px" }}><span style={{ fontWeight: "600" }}>QR code</span><span>41%</span></div><div style={{ height: "8px", borderRadius: "4px", background: "#F5F4EF", marginTop: "6px" }}><div style={{ width: "41%", height: "8px", borderRadius: "4px", background: "#0D0D0D" }}></div></div></div>
      <div><div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px" }}><span style={{ fontWeight: "600" }}>Link</span><span>27%</span></div><div style={{ height: "8px", borderRadius: "4px", background: "#F5F4EF", marginTop: "6px" }}><div style={{ width: "27%", height: "8px", borderRadius: "4px", background: "#0D0D0D" }}></div></div></div>
      <div><div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px" }}><span style={{ fontWeight: "600" }}>Setuvara Tap</span><span>19%</span></div><div style={{ height: "8px", borderRadius: "4px", background: "#F5F4EF", marginTop: "6px" }}><div style={{ width: "19%", height: "8px", borderRadius: "4px", background: "#FF5A4F" }}></div></div></div>
      <div><div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px" }}><span style={{ fontWeight: "600" }}>Quick QR</span><span>13%</span></div><div style={{ height: "8px", borderRadius: "4px", background: "#F5F4EF", marginTop: "6px" }}><div style={{ width: "13%", height: "8px", borderRadius: "4px", background: "#0D0D0D" }}></div></div></div>
    </div>
  </div>
  <div style={{ position: "absolute", right: "56px", top: "470px", width: "280px", boxSizing: "border-box", background: "#FFFFFF", borderRadius: "20px", padding: "18px", boxShadow: "0 40px 70px -35px rgba(13,13,13,.45)" }}>
    <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ font: "500 10px var(--font-geist-mono),monospace", letterSpacing: ".16em", color: "#FF5A4F" }}>MONDAY SUMMARY</span><span style={{ fontSize: "12px", color: "rgba(13,13,13,.45)" }}>Email</span></div>
    <div style={{ fontSize: "15px", fontWeight: "600", lineHeight: "1.35", marginTop: "10px" }}>Last week: 612 scans and 87 connections, up 34% on the week before.</div>
  </div>
  <div style={{ position: "absolute", right: "120px", bottom: "80px", background: "#0D0D0D", color: "#F5F4EF", borderRadius: "999px", padding: "11px 16px", fontSize: "13px", fontWeight: "500", display: "flex", gap: "8px", alignItems: "center" }}><span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#C7FF4A" }}></span>Never shows who viewed you</div>
</div>

  );
}

export function TapVisual() {
  return (
<div role="img" aria-label="Setuvara Tap: a phone touching an NFC card opens Theo's Event page; Quick QR beside it" style={{ position: "relative", width: "1200px", height: "800px", overflow: "hidden", borderRadius: "32px", background: "#0D0D0D", fontFamily: "var(--font-geist),system-ui,sans-serif", color: "#F5F4EF", isolation: "isolate" }}>
  <span style={{ position: "absolute", left: "20%", top: "10%", width: "60%", height: "80%", borderRadius: "50%", background: "#C5FF47", opacity: ".28", filter: "blur(110px)" }}></span>
  <span style={{ position: "absolute", right: "-10%", bottom: "-30%", width: "50%", height: "70%", borderRadius: "50%", background: "#FF5A4F", opacity: ".35", filter: "blur(110px)" }}></span>
  <svg aria-hidden="true" width="100%" height="100%" style={{ position: "absolute", inset: "0", opacity: ".18", mixBlendMode: "soft-light" }}><filter id="vtn"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" stitchTiles="stitch" /></filter><rect width="100%" height="100%" filter="url(#vtn)" /></svg>

  {/* ripples */}
  <span style={{ position: "absolute", left: "540px", top: "450px", width: "120px", height: "120px", margin: "-60px 0 0 -60px", borderRadius: "50%", boxShadow: "0 0 0 1.5px rgba(199,255,74,.7)" }}></span>
  <span style={{ position: "absolute", left: "540px", top: "450px", width: "220px", height: "220px", margin: "-110px 0 0 -110px", borderRadius: "50%", boxShadow: "0 0 0 1.5px rgba(199,255,74,.4)" }}></span>
  <span style={{ position: "absolute", left: "540px", top: "450px", width: "340px", height: "340px", margin: "-170px 0 0 -170px", borderRadius: "50%", boxShadow: "0 0 0 1.5px rgba(199,255,74,.18)" }}></span>

  {/* NFC card */}
  <div style={{ position: "absolute", left: "150px", top: "390px", width: "440px", height: "277px", borderRadius: "22px", background: "linear-gradient(135deg,#232120,#0D0D0D)", boxShadow: "0 60px 90px -30px rgba(0,0,0,.9),inset 0 0 0 1px rgba(255,255,255,.08)", transform: "rotate(-12deg)", padding: "30px", boxSizing: "border-box", display: "flex", flexDirection: "column" }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}><svg width="40" height="40" viewBox="0 0 100 100" fill="#FF5A4F" aria-hidden="true"><path d="M66.62 10.38A26 26 0 1 0 37 52.89L43.25 56.49L52.25 40.91L46 37.3A8 8 0 1 1 57.15 26.78Z" /><path d="M33.38 89.62A26 26 0 1 0 63 47.11L56.75 43.51L47.75 59.09L54 62.7A8 8 0 1 1 42.85 73.22Z" /></svg><svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="rgba(245,244,239,.6)" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"><path d="M8.5 8a6 6 0 0 1 0 8" /><path d="M12 5.5a10 10 0 0 1 0 13" /><path d="M15.5 3a14 14 0 0 1 0 18" /></svg></div>
    <div style={{ marginTop: "auto" }}><div style={{ fontFamily: "var(--font-bricolage),sans-serif", fontWeight: "800", fontSize: "34px", letterSpacing: "-0.05em" }}>Theo Laurent</div><div style={{ font: "500 11px var(--font-geist-mono),monospace", letterSpacing: ".16em", color: "rgba(245,244,239,.5)", marginTop: "8px" }}>SETUVARA TAP · ANY NFC CARD</div></div>
  </div>

  {/* phone */}
  <LivePhone height={612} left={470} slug="event" top={70} transform="rotate(9deg)" />

  {/* Quick QR */}
  <div style={{ position: "absolute", right: "90px", top: "110px", width: "250px", background: "#F5F4EF", color: "#0D0D0D", borderRadius: "26px", padding: "20px", boxShadow: "0 40px 70px -30px rgba(0,0,0,.8)" }}>
    <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ font: "500 10px var(--font-geist-mono),monospace", letterSpacing: ".16em" }}>QUICK QR</span><span style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "11px", fontWeight: "600" }}><span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#C7FF4A", boxShadow: "0 0 0 1px rgba(13,13,13,.2)" }}></span>Event</span></div>
    <div style={{ background: "#FFFFFF", borderRadius: "14px", padding: "16px", marginTop: "14px" }}><QrArt size={178} /></div>
    <div style={{ fontSize: "13px", color: "rgba(13,13,13,.6)", marginTop: "12px" }}>From the lock screen, in one tap</div>
  </div>
  <div style={{ position: "absolute", right: "90px", top: "470px", width: "250px", background: "#1B1B1B", borderRadius: "22px", padding: "18px", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.06)" }}>
    <div style={{ font: "500 10px var(--font-geist-mono),monospace", letterSpacing: ".16em", color: "rgba(245,244,239,.5)" }}>CARD OPENS</div>
    <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "12px", fontSize: "14px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "9px 12px", borderRadius: "12px", color: "rgba(245,244,239,.55)" }}><span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#FF5A4F" }}></span>Personal</div>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "9px 12px", borderRadius: "12px", background: "#C7FF4A", color: "#0D0D0D", fontWeight: "600" }}><span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#0D0D0D" }}></span>Event · Slush</div>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "9px 12px", borderRadius: "12px", color: "rgba(245,244,239,.55)" }}><span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#AFCBFF" }}></span>Business</div>
    </div>
  </div>
  <div style={{ position: "absolute", left: "72px", top: "64px", font: "500 11px var(--font-geist-mono),monospace", letterSpacing: ".16em", color: "rgba(245,244,239,.55)" }}>TAP · SCAN · CONNECT</div>
  <div style={{ position: "absolute", left: "72px", bottom: "56px", fontSize: "14px", color: "rgba(245,244,239,.6)" }}>Switch the Mode, never reprint the card.</div>
</div>

  );
}

export function WalletVisual() {
  return (
<div role="img" aria-label="Wallet: Aanya's Setuvara pass with her QR, in a phone wallet, beside the premium pass in her Look's colours" style={{ position: "relative", width: "1200px", height: "800px", overflow: "hidden", borderRadius: "32px", background: "#F1E6FB", fontFamily: "var(--font-geist),system-ui,sans-serif", color: "#0D0D0D", isolation: "isolate" }}>
  <span style={{ position: "absolute", left: "-15%", top: "-25%", width: "70%", height: "90%", borderRadius: "50%", background: "#E8A6FF", opacity: ".9", filter: "blur(80px)" }}></span>
  <span style={{ position: "absolute", right: "-20%", bottom: "-30%", width: "70%", height: "90%", borderRadius: "50%", background: "#C9B6F5", opacity: ".85", filter: "blur(90px)" }}></span>
  <span style={{ position: "absolute", left: "45%", top: "10%", width: "40%", height: "60%", borderRadius: "50%", background: "#FFD7C9", opacity: ".7", filter: "blur(80px)" }}></span>
  <svg aria-hidden="true" width="100%" height="100%" style={{ position: "absolute", inset: "0", opacity: ".22", mixBlendMode: "soft-light" }}><filter id="vwn"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" stitchTiles="stitch" /></filter><rect width="100%" height="100%" filter="url(#vwn)" /></svg>

  {/* copy */}
  <div style={{ position: "absolute", left: "80px", top: "96px", width: "380px" }}>
    <span style={{ display: "inline-flex", alignItems: "center", gap: "8px", background: "#0D0D0D", color: "#F5F4EF", borderRadius: "999px", padding: "8px 14px", font: "500 10px var(--font-geist-mono),monospace", letterSpacing: ".16em" }}>COMING SOON</span>
    <div style={{ fontFamily: "var(--font-bricolage),sans-serif", fontWeight: "800", fontSize: "76px", letterSpacing: "-0.055em", lineHeight: ".88", marginTop: "24px" }}>Your QR, one swipe away.</div>
    <div style={{ fontSize: "18px", lineHeight: "1.5", color: "rgba(13,13,13,.68)", marginTop: "22px" }}>Apple Wallet and Google Wallet. Ready on the lock screen, even without signal.</div>
    <div style={{ display: "flex", gap: "8px", marginTop: "28px" }}><span style={{ background: "#0D0D0D", color: "#F5F4EF", borderRadius: "12px", padding: "12px 16px", fontSize: "13px", fontWeight: "600" }}>Add to Apple Wallet</span><span style={{ background: "#FFFFFF", borderRadius: "12px", padding: "12px 16px", fontSize: "13px", fontWeight: "600", boxShadow: "inset 0 0 0 1px rgba(13,13,13,.12)" }}>Save to Google Wallet</span></div>
  </div>

  {/* phone */}
  <div style={{ position: "absolute", left: "560px", top: "56px", width: "330px", height: "690px", borderRadius: "56px", background: "#1B1B1B", padding: "11px", boxSizing: "border-box", boxShadow: "0 60px 100px -40px rgba(13,13,13,.6),inset 0 0 0 1.5px rgba(255,255,255,.08)" }}>
    <div style={{ position: "relative", width: "100%", height: "100%", borderRadius: "46px", overflow: "hidden", background: "#101010" }}>
      <span style={{ position: "absolute", left: "50%", top: "12px", marginLeft: "-48px", width: "96px", height: "28px", borderRadius: "999px", background: "#000" }}></span>
      {/* pass behind */}
      <div style={{ position: "absolute", left: "14px", right: "14px", top: "62px", height: "90px", borderRadius: "16px", background: "#2A2622" }}></div>
      <div style={{ position: "absolute", left: "14px", right: "14px", top: "82px", height: "90px", borderRadius: "16px", background: "#E8A6FF" }}></div>
      {/* main pass */}
      <div style={{ position: "absolute", left: "14px", right: "14px", top: "104px", bottom: "24px", borderRadius: "18px", background: "#FF5A4F", padding: "18px", boxSizing: "border-box", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><div style={{ display: "flex", alignItems: "center", gap: "8px" }}><svg width="22" height="22" viewBox="0 0 100 100" fill="#0D0D0D" aria-hidden="true"><path d="M66.62 10.38A26 26 0 1 0 37 52.89L43.25 56.49L52.25 40.91L46 37.3A8 8 0 1 1 57.15 26.78Z" /><path d="M33.38 89.62A26 26 0 1 0 63 47.11L56.75 43.51L47.75 59.09L54 62.7A8 8 0 1 1 42.85 73.22Z" /></svg><span style={{ fontFamily: "var(--font-bricolage),sans-serif", fontWeight: "700", fontSize: "17px", letterSpacing: "-0.05em" }}>setuvara</span></div><div style={{ textAlign: "right" }}><div style={{ font: "500 8px var(--font-geist-mono),monospace", letterSpacing: ".14em", opacity: ".65" }}>MODE</div><div style={{ fontSize: "13px", fontWeight: "700" }}>Event</div></div></div>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: "22px" }}><img src="/pricing/aanya-close.webp" alt="" style={{ width: "52px", height: "52px", borderRadius: "50%", objectFit: "cover", objectPosition: "50% 25%", boxShadow: "0 0 0 2px #0D0D0D" }} /><div><div style={{ fontFamily: "var(--font-bricolage),sans-serif", fontWeight: "800", fontSize: "30px", letterSpacing: "-0.05em", lineHeight: ".9" }}>Aanya Rao</div><div style={{ fontSize: "11px", marginTop: "5px", opacity: ".75" }}>Lisbon</div></div></div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginTop: "18px" }}><div><div style={{ font: "500 8px var(--font-geist-mono),monospace", letterSpacing: ".14em", opacity: ".65" }}>LIVE AT</div><div style={{ fontSize: "13px", fontWeight: "700", marginTop: "3px" }}>Slush 2026</div></div><div><div style={{ font: "500 8px var(--font-geist-mono),monospace", letterSpacing: ".14em", opacity: ".65" }}>UNTIL</div><div style={{ fontSize: "13px", fontWeight: "700", marginTop: "3px" }}>20 Nov</div></div></div>
        <div style={{ margin: "auto auto 0", background: "#FFFFFF", borderRadius: "14px", padding: "14px", textAlign: "center" }}><QrArt size={150} /><div style={{ font: "500 10px var(--font-geist-mono),monospace", marginTop: "8px", color: "rgba(13,13,13,.6)" }}>setuvara.com/aanya</div></div>
      </div>
    </div>
  </div>
</div>

  );
}

const VISUALS = { actions: ActionsVisual, builder: BuilderVisual, analytics: AnalyticsVisual, "qr-and-tap": TapVisual, wallet: WalletVisual } as const;
export type VisualKey = keyof typeof VISUALS;

/** One visual, zoomed to fit: 1200×800 drawn once, --z set per breakpoint. */
export function FeatureVisual({ name, className = "" }: { name: VisualKey; className?: string }) {
  const Visual = VISUALS[name];
  return (
    <div className={`mx-auto w-fit [--z:.285] min-[400px]:[--z:.3] sm:[--z:.48] md:[--z:.586] lg:[--z:.76] xl:[--z:.97] min-[1440px]:[--z:1] ${className}`}>
      <div style={{ width: "calc(1200px * var(--z))", height: "calc(800px * var(--z))" }}>
        <div style={{ width: 1200, zoom: "var(--z)" } as CSSProperties}><Visual /></div>
      </div>
    </div>
  );
}

/** The same visual filling a 3:2 banner exactly (blog cards and article heads). */
export function BannerVisual({ name, className = "" }: { name: VisualKey; className?: string }) {
  const Visual = VISUALS[name];
  return <FitCanvas className={`rounded-[24px] sm:rounded-[32px] ${className}`}><Visual /></FitCanvas>;
}
