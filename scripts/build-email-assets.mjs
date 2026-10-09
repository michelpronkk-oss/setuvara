import { mkdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import sharp from "sharp";

const root = process.cwd();
const source = await readFile(resolve(root, "src/components/marketing/brand.tsx"), "utf8");
const extractPath = (name) => {
  const match = source.match(new RegExp(`export const ${name} = "([^"]+)";`));
  if (!match) throw new Error(`Could not read the locked Setuvara ${name} path`);
  return match[1];
};
// The coral mark reads on both Paper and Ink, so it never needs a dark-mode swap.
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100" fill="#FF5A4F"><path d="${extractPath("meetMarkTop")}"/><path d="${extractPath("meetMarkBottom")}"/></svg>`;
const outputDir = resolve(root, "public/email");
await mkdir(outputDir, { recursive: true });
await sharp(Buffer.from(svg)).resize(104, 104).png().toFile(resolve(outputDir, "setuvara-mark.png"));

// The 60° cut: a 30×52 corner (shown at @2x) filled with the canvas colour, transparent
// elsewhere, placed in an object's top-right cell. Blocked images fall back to a square corner.
const cut = (fill) => `<svg xmlns="http://www.w3.org/2000/svg" width="60" height="104" viewBox="0 0 60 104"><path d="M0 0H60V104Z" fill="${fill}"/></svg>`;
await sharp(Buffer.from(cut("#F5F4EF"))).png().toFile(resolve(outputDir, "cut-paper.png"));
await sharp(Buffer.from(cut("#0D0D0D"))).png().toFile(resolve(outputDir, "cut-ink.png"));
console.log("Built the coral email mark and 60° cut corners from the Setuvara brand paths.");
