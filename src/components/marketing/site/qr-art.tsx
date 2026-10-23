"use client";

import { QRCodeSVG } from "qrcode.react";

/** A real, scannable code for the product visuals (it opens an example page). */
export function QrArt({ size, value = "https://setuvara.com/aanya" }: { size: number; value?: string }) {
  return <QRCodeSVG bgColor="#FFFFFF" fgColor="#0D0D0D" level="M" marginSize={0} size={size} style={{ display: "block" }} value={value} />;
}
