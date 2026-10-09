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
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100" fill="#0D0D0D"><path d="${extractPath("meetMarkTop")}"/><path d="${extractPath("meetMarkBottom")}"/></svg>`;
const outputDir = resolve(root, "public/email");
await mkdir(outputDir, { recursive: true });
await sharp(Buffer.from(svg)).resize(104, 104).png().toFile(resolve(outputDir, "setuvara-mark.png"));
console.log("Built the email mark from the existing Setuvara brand paths.");
