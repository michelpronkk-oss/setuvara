import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

const SIGNED_IMAGE_URL_SECONDS = 60 * 60;
const SIGNED_IMAGE_REUSE_MS = 5 * 60 * 1000;
const MAX_CACHED_URLS = 512;

type SignedImage = { url: string; reuseUntil: number };

// Warm Function instances can reuse the same short-lived bearer URL, allowing the browser and
// Vercel Image Optimization cache to reuse immutable object bytes across immediate reloads.
// The cache expires far before the existing one-hour Storage URL lifetime.
const signedImages = new Map<string, SignedImage>();
const signingImages = new Map<string, Promise<string | null>>();

export async function createPublicProfileImageUrl(supabase: SupabaseClient, path: string): Promise<string | null> {
  const now = Date.now();
  const cached = signedImages.get(path);
  if (cached && cached.reuseUntil > now) {
    signedImages.delete(path);
    signedImages.set(path, cached);
    return cached.url;
  }
  signedImages.delete(path);

  const signing = signingImages.get(path);
  if (signing) return signing;

  const request = supabase.storage.from("profile-media").createSignedUrl(path, SIGNED_IMAGE_URL_SECONDS)
    .then(({ data, error }) => {
      if (error || !data?.signedUrl) return null;
      signedImages.set(path, { url: data.signedUrl, reuseUntil: Date.now() + SIGNED_IMAGE_REUSE_MS });
      while (signedImages.size > MAX_CACHED_URLS) {
        const oldest = signedImages.keys().next().value;
        if (oldest === undefined) break;
        signedImages.delete(oldest);
      }
      return data.signedUrl;
    })
    .finally(() => signingImages.delete(path));
  signingImages.set(path, request);
  return request;
}
