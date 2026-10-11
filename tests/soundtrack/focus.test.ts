/// <reference lib="deno.ns" />
/// <reference lib="dom" />

import { mediaFocus } from "../../src/lib/soundtrack/focus.ts";

Deno.test("soundtrack stays blocked until the last active media releases", () => {
  const first = `video-a-${crypto.randomUUID()}`;
  const second = `video-b-${crypto.randomUUID()}`;
  mediaFocus.claim(first, () => {});
  mediaFocus.claim(second, () => {});

  if (!mediaFocus.busy()) throw new Error("Both active media claims should block the soundtrack");
  mediaFocus.release(first);
  if (!mediaFocus.busy()) throw new Error("Stopping one of two media sources must keep the soundtrack blocked");
  mediaFocus.release(first);
  if (!mediaFocus.busy()) throw new Error("A duplicate release must not clear the second media claim");
  mediaFocus.release(second);
  if (mediaFocus.busy()) throw new Error("The final media release should unblock the soundtrack");
});

Deno.test("explicit Sound on requests controlled media to pause and waits for its real release", () => {
  const id = `tracked-video-${crypto.randomUUID()}`;
  let pauseRequested = false;
  mediaFocus.claim(id, () => { pauseRequested = true; });
  mediaFocus.yield();

  if (!pauseRequested) throw new Error("The active player should receive a pause request");
  if (!mediaFocus.busy()) throw new Error("The blocker must remain until its pause event releases it");
  mediaFocus.release(id);
  if (mediaFocus.busy()) throw new Error("The actual pause release should unblock playback");
});

Deno.test("explicit Sound on yields untracked embeds without an API", () => {
  const id = `untracked-embed-${crypto.randomUUID()}`;
  mediaFocus.claim(id);
  mediaFocus.yield();
  if (mediaFocus.busy()) throw new Error("An explicit Sound on choice yields untracked embed focus");
});
