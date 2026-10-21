import "server-only";

import { readFile } from "node:fs/promises";
import { join } from "node:path";

type CardFont = { name: string; data: Buffer; weight: 400 | 500 | 600 | 700 | 800; style: "normal" };

// Static TTF instances of the brand faces (Satori reads ttf/otf/woff, not woff2). See assets/og/README.md.
const FILES = [
  ["Bricolage Grotesque", "Bricolage-Bold.ttf", 700],
  ["Bricolage Grotesque", "Bricolage-ExtraBold.ttf", 800],
  ["Geist", "Geist-Regular.ttf", 400],
  ["Geist", "Geist-Medium.ttf", 500],
  ["Geist", "Geist-SemiBold.ttf", 600],
  ["Geist Mono", "GeistMono-Medium.ttf", 500],
] as const;

let loading: Promise<CardFont[]> | null = null;

/** Read once per instance; a failed read is retried on the next card. */
export function socialCardFonts(): Promise<CardFont[]> {
  loading ??= Promise.all(FILES.map(async ([name, file, weight]) => ({
    name,
    data: await readFile(join(process.cwd(), "assets/og", file)),
    weight,
    style: "normal" as const,
  }))).catch((error) => {
    loading = null;
    throw error;
  });
  return loading;
}
