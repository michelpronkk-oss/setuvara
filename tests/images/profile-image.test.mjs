import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { after, before, test } from "node:test";
import { build } from "esbuild";

const root = resolve(import.meta.dirname, "../..");
const cache = join(root, "node_modules/.cache");
mkdirSync(cache, { recursive: true });
const out = mkdtempSync(join(cache, "setuvara-profile-image-"));
let ProfileImage;
let renderToStaticMarkup;

before(async () => {
  await build({
    entryPoints: [join(root, "src/components/profile/profile-image.tsx")],
    bundle: true,
    format: "cjs",
    platform: "node",
    jsx: "automatic",
    external: ["react"],
    plugins: [{
      name: "next-image-test-double",
      setup(buildContext) {
        buildContext.onResolve({ filter: /^next\/image$/ }, () => ({ path: "next-image", namespace: "test" }));
        buildContext.onLoad({ filter: /.*/, namespace: "test" }, () => ({
          contents: `
            export function getImageProps(options) {
              globalThis.__profileImageOptions.push(options);
              return { props: {
                src: "/_next/image?width=960&quality=100",
                srcSet: "/_next/image?width=480&quality=100 480w, /_next/image?width=960&quality=100 960w",
                sizes: options.sizes,
                loading: options.loading,
                fetchPriority: options.fetchPriority,
              } };
            }
          `,
          loader: "js",
        }));
      },
    }],
    outfile: join(out, "profile-image.cjs"),
    logLevel: "silent",
  });
  ProfileImage = createRequire(import.meta.url)(join(out, "profile-image.cjs")).ProfileImage;
  ({ renderToStaticMarkup } = createRequire(import.meta.url)("react-dom/server"));
});

after(() => rmSync(out, { recursive: true, force: true }));

test("private profile media uses responsive optimizer props and the requested LCP priority", () => {
  globalThis.__profileImageOptions = [];
  const React = createRequire(import.meta.url)("react");
  const html = renderToStaticMarkup(React.createElement(ProfileImage, {
    alt: "Profile portrait",
    priority: true,
    sizes: "(max-width: 480px) 100vw, 656px",
    src: "https://setuvara.supabase.co/storage/v1/object/sign/profile-media/member/hero.webp?token=fake",
  }));

  assert.equal(globalThis.__profileImageOptions.length, 1);
  assert.equal(globalThis.__profileImageOptions[0].quality, 100);
  assert.equal(globalThis.__profileImageOptions[0].fill, true);
  assert.equal(globalThis.__profileImageOptions[0].sizes, "(max-width: 480px) 100vw, 656px");
  assert.match(html, /srcSet="[^"]*480w,[^"]*960w/);
  assert.match(html, /sizes="\(max-width: 480px\) 100vw, 656px"/);
  assert.match(html, /loading="eager"/);
  assert.match(html, /fetchPriority="high"/);
});

test("legacy and non-profile image URLs remain direct image sources", () => {
  globalThis.__profileImageOptions = [];
  const React = createRequire(import.meta.url)("react");
  const src = "https://assets.example.test/legacy.png";
  const html = renderToStaticMarkup(React.createElement(ProfileImage, { alt: "Legacy photo", src }));

  assert.equal(globalThis.__profileImageOptions.length, 0);
  assert.match(html, new RegExp(`src="${src.replaceAll(".", "\\.")}"`));
  assert.doesNotMatch(html, /srcSet=/);
});
