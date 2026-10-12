export const FEEDBACK_KINDS = ["bug", "confusing", "idea", "other"] as const;
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number];

export const FEEDBACK_MAX_MESSAGE = 4000;
// Stays under the 4.5 MB Vercel request limit; larger pictures are shrunk in the browser first.
export const FEEDBACK_MAX_SCREENSHOT = 4 * 1024 * 1024;

/** Mode the member is looking at, read from the app URL (`?mode=` or `/app/identity/<mode>`). */
export function feedbackMode(pathname: string, search: string): "personal" | "event" | "business" | undefined {
  const fromQuery = new URLSearchParams(search).get("mode");
  const fromPath = /^\/app\/[^/]+\/(personal|event|business)(?:\/|$)/.exec(pathname)?.[1];
  const mode = fromQuery ?? fromPath;
  return mode === "personal" || mode === "event" || mode === "business" ? mode : undefined;
}

/** Identifies a screenshot by its bytes, never by the name or type the browser sent. */
export function sniffScreenshot(bytes: Uint8Array): { extension: "png" | "jpg" | "webp"; contentType: string } | null {
  const starts = (...values: number[]) => values.every((value, index) => bytes[index] === value);
  if (starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return { extension: "png", contentType: "image/png" };
  if (starts(0xff, 0xd8, 0xff)) return { extension: "jpg", contentType: "image/jpeg" };
  if (starts(0x52, 0x49, 0x46, 0x46) && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return { extension: "webp", contentType: "image/webp" };
  return null;
}
