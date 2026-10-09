import { ImageResponse } from "next/og";

import { meetMarkBottom, meetMarkTop } from "@/components/marketing/brand";

export const alt = "Setuvara | One identity. Every version of you.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div style={{ background: "#f5f4ef", color: "#0d0d0d", display: "flex", height: "100%", position: "relative", width: "100%", overflow: "hidden" }}>
        <svg height="560" style={{ position: "absolute", right: -90, bottom: -110 }} viewBox="0 0 100 100" width="560">
          <path d={meetMarkTop} fill="#ff5a4f" />
          <path d={meetMarkBottom} fill="#ff5a4f" />
        </svg>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, width: "100%" }}>
          <div style={{ alignItems: "center", display: "flex", fontSize: 34, fontWeight: 700, gap: 14, letterSpacing: "-0.04em" }}>
            <svg height="40" viewBox="0 0 100 100" width="40"><path d={meetMarkTop} fill="#0d0d0d" /><path d={meetMarkBottom} fill="#0d0d0d" /></svg>
            setuvara
          </div>
          <div style={{ display: "flex", flexDirection: "column", fontSize: 96, fontWeight: 700, letterSpacing: "-0.06em", lineHeight: 0.95, maxWidth: 820 }}>
            <div style={{ display: "flex" }}>One identity.</div>
            <div style={{ display: "flex" }}>Every version of you.</div>
          </div>
          <div style={{ display: "flex", fontSize: 22, gap: 16, letterSpacing: "0.12em", textTransform: "uppercase" }}>
            <span>Personal</span><span style={{ color: "#ff5a4f" }}>·</span><span>Event</span><span style={{ color: "#ff5a4f" }}>·</span><span>Business</span>
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
