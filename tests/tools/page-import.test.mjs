import { assertEquals } from "jsr:@std/assert@1";

import { readPage } from "@/lib/tools/page-import.ts";

const url = new URL("https://linktr.ee/sena");

Deno.test("a link-in-bio page gives a name, line, picture and outbound links", () => {
  const html = `<html><head><meta property="og:title" content="Sena Okafor | Linktree"><meta property="og:description" content="Late-night sets &amp; live sessions"><meta property="og:image" content="/avatar.png"></head><body>
    <a href="https://youtube.com/@sena"><span>YouTube</span></a>
    <a href="https://open.spotify.com/artist/1">Spotify</a>
    <a href="https://open.spotify.com/artist/1">Spotify again</a>
    <a href="/sena/privacy">Privacy</a>
    <a href="https://linktr.ee/s/about">Explore</a>
    <a href="mailto:hi@sena.test">Email</a>
  </body></html>`;
  const page = readPage(html, url);
  assertEquals(page.name, "Sena Okafor");
  assertEquals(page.bio, "Late-night sets & live sessions");
  assertEquals(page.image, "https://linktr.ee/avatar.png");
  assertEquals(page.links, [{ title: "YouTube", url: "https://youtube.com/@sena" }, { title: "Spotify", url: "https://open.spotify.com/artist/1" }]);
});

Deno.test("links without text fall back to the host, and the list is capped", () => {
  const anchors = Array.from({ length: 12 }, (_, i) => `<a href="https://site${i}.test/"></a>`).join("");
  const page = readPage(`<html><head><title>@aanya · Beacons</title></head><body>${anchors}</body></html>`, url);
  assertEquals(page.name, "aanya");
  assertEquals(page.links.length, 8);
  assertEquals(page.links[0], { title: "site0.test", url: "https://site0.test/" });
});
