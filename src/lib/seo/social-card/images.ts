import "server-only";

import sharp from "sharp";

const MAX_SOURCE_BYTES = 4 * 1024 * 1024;

/**
 * Card-ready picture from raw bytes. Member photos are stored as WebP, which Satori cannot draw,
 * so every picture is decoded, bounded and re-encoded as JPEG. Anything unreadable is dropped.
 */
export async function cardImage(bytes: Uint8Array, width: number, height: number): Promise<string | null> {
  if (!bytes.byteLength || bytes.byteLength > MAX_SOURCE_BYTES) return null;
  try {
    const jpeg = await sharp(bytes, { failOn: "error", limitInputPixels: 40_000_000 })
      .rotate()
      .resize({ width, height, fit: "inside", withoutEnlargement: true })
      .flatten({ background: "#2A2622" })
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer();
    return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
  } catch {
    return null;
  }
}

/** Fetch a signed Storage URL with a size cap and a short timeout, then make it card-ready. */
export async function fetchCardImage(url: string, allowedOrigin: string, width: number, height: number): Promise<string | null> {
  try {
    const target = new URL(url);
    if (target.origin !== allowedOrigin || !target.pathname.startsWith("/storage/v1/object/sign/")) return null;
    const response = await fetch(target, { cache: "no-store", redirect: "error", signal: AbortSignal.timeout(2500) });
    if (!response.ok || !response.body) return null;
    const length = Number(response.headers.get("content-length"));
    if (Number.isFinite(length) && length > MAX_SOURCE_BYTES) return null;

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_SOURCE_BYTES) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
    return cardImage(Buffer.concat(chunks), width, height);
  } catch {
    return null;
  }
}
