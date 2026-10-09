import { ImageResponse } from "next/og";

export const alt = "Setuvara — One identity. Every version of you.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div style={{ background: "#f5f4ef", color: "#0d0d0d", display: "flex", flexDirection: "column", height: "100%", justifyContent: "space-between", padding: 72, width: "100%" }}>
        <div style={{ display: "flex", fontSize: 25, fontWeight: 700, letterSpacing: "0.16em", textTransform: "lowercase" }}>setuvara</div>
        <div style={{ display: "flex", flexDirection: "column", maxWidth: 950 }}>
          <div style={{ background: "#ff5a4f", height: 8, marginBottom: 28, width: 96 }} />
          <div style={{ display: "flex", flexDirection: "column", fontSize: 76, fontWeight: 600, letterSpacing: "-0.055em", lineHeight: 1.08 }}>
            <div style={{ display: "flex" }}>One identity.</div>
            <div style={{ display: "flex" }}>Every version of you.</div>
          </div>
        </div>
        <div style={{ color: "rgba(13,13,13,0.58)", display: "flex", fontSize: 20 }}>Your identity. Your connections.</div>
      </div>
    ),
    { ...size },
  );
}
