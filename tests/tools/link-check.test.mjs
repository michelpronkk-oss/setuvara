import { assertEquals } from "jsr:@std/assert@1";

import { isPrivateAddress } from "@/lib/net/safe-fetch.ts";
import { checkPage, scoreOf } from "@/lib/tools/link-check.ts";

const url = new URL("https://links.example.com/sena");
const byId = (checks) => Object.fromEntries(checks.map((check) => [check.id, check.status]));

Deno.test("a complete page passes every check", () => {
  const html = `<html><head><title>Sena Okafor</title><meta name="description" content="Music and film"><meta property="og:image" content="https://x.test/a.png"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="icon" href="/i.png"></head><body><a href="https://youtube.com/@sena">YouTube</a><a href="https://open.spotify.com/artist/1">Spotify</a></body></html>`;
  const checks = checkPage({ html, finalUrl: url, status: 200, ms: 300, truncated: false });
  assertEquals(Object.values(byId(checks)).every((status) => status === "pass"), true);
  assertEquals(scoreOf(checks), 100);
});

Deno.test("missing basics fail, and same-site links don't count as outbound", () => {
  const html = `<html><head></head><body><a href="/about">About</a></body></html>`;
  const result = byId(checkPage({ html, finalUrl: new URL("http://links.example.com/"), status: 200, ms: 2500, truncated: true }));
  assertEquals(result, { reachable: "pass", https: "fail", speed: "fail", title: "fail", description: "warn", preview: "fail", mobile: "fail", icon: "warn", links: "warn", weight: "fail" });
});

Deno.test("too many links is a warning, not a failure", () => {
  const anchors = Array.from({ length: 20 }, (_, i) => `<a href="https://site${i}.test/">${i}</a>`).join("");
  assertEquals(byId(checkPage({ html: `<head><title>x</title></head>${anchors}`, finalUrl: url, status: 200, ms: 100, truncated: false })).links, "warn");
});

Deno.test("private and reserved addresses are blocked", () => {
  for (const address of ["127.0.0.1", "10.1.2.3", "169.254.169.254", "192.168.0.1", "172.16.0.1", "100.64.0.1", "::1", "fd00::1", "::ffff:127.0.0.1"]) assertEquals(isPrivateAddress(address), true, address);
  for (const address of ["93.184.216.34", "2606:4700::1111"]) assertEquals(isPrivateAddress(address), false, address);
});
