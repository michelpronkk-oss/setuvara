"use client";

import { useEffect, useState } from "react";

/**
 * A soft wash of the photo's own colour under the Full Bleed hero.
 * Samples the lower half of the photo on a tiny canvas; renders nothing
 * until a colour is known, so a blocked or slow image just means no glow.
 */
export function PhotoGlow({ src, dark }: { src: string; dark: boolean }) {
  const [rgb, setRgb] = useState<[number, number, number] | null>(null);

  useEffect(() => {
    let cancelled = false;
    const image = new window.Image();
    image.crossOrigin = "anonymous";
    image.decoding = "async";
    image.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 12;
        canvas.height = 12;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) return;
        context.drawImage(image, 0, image.naturalHeight * 0.45, image.naturalWidth, image.naturalHeight * 0.55, 0, 0, 12, 12);
        const { data } = context.getImageData(0, 0, 12, 12);
        let r = 0, g = 0, b = 0, weight = 0;
        for (let index = 0; index < data.length; index += 4) {
          const [pr, pg, pb] = [data[index], data[index + 1], data[index + 2]];
          // Favour saturated pixels so a grey backdrop doesn't wash out the tint.
          const w = 0.15 + (Math.max(pr, pg, pb) - Math.min(pr, pg, pb)) / 255;
          r += pr * w; g += pg * w; b += pb * w; weight += w;
        }
        if (!cancelled && weight) setRgb([r / weight, g / weight, b / weight].map(Math.round) as [number, number, number]);
      } catch {
        // Cross-origin image without CORS: skip the glow.
      }
    };
    image.src = src;
    return () => { cancelled = true; image.onload = null; };
  }, [src]);

  if (!rgb) return null;
  const color = rgb.join(",");
  return <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[420px]" style={{ background: `radial-gradient(95% 70% at 50% 30%, rgba(${color},${dark ? 0.3 : 0.24}) 0%, rgba(${color},${dark ? 0.12 : 0.1}) 50%, transparent 80%)`, maskImage: "linear-gradient(to bottom, transparent 0%, #000 28%, #000 60%, transparent 100%)", WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, #000 28%, #000 60%, transparent 100%)" }} />;
}
