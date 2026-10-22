import "server-only";

import { cache } from "react";

/**
 * Where to come back to after signing in, held per request. Studio loaders are cached per request
 * without the return path in the key, so a layout and its page share one load instead of running
 * every query twice just because they pass different paths.
 */
const box = cache(() => ({ value: "/app" }));

export function rememberNext(next: string) {
  box().value = next;
}

export function loginHref() {
  return `/login?next=${encodeURIComponent(box().value)}`;
}

/** The return path already set for this request, for a loader that calls another one. */
export function currentNext() {
  return box().value;
}
