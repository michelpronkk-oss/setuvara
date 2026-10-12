import type { SupabaseClient } from "@supabase/supabase-js";
import type { SlideImage, SlidePhoto } from "@/components/profile/types";

/** The stored slideshow photos of a Mode row, ignoring anything malformed. */
export function parseSlidePhotos(value: unknown): SlidePhoto[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is SlidePhoto => Boolean(item) && typeof item === "object"
    && typeof (item as SlidePhoto).path === "string"
    && typeof (item as SlidePhoto).x === "number"
    && typeof (item as SlidePhoto).y === "number");
}

/** Signed URLs for the first `limit` slideshow photos, in order; a photo that can't be signed is skipped. */
export async function signSlidePhotos(supabase: SupabaseClient, photos: SlidePhoto[], limit = photos.length): Promise<SlideImage[]> {
  const signed = await Promise.all(photos.slice(0, limit).map(async (photo) => {
    const { data } = await supabase.storage.from("profile-media").createSignedUrl(photo.path, 3600);
    return data?.signedUrl ? { url: data.signedUrl, x: photo.x, y: photo.y } : null;
  }));
  return signed.filter((slide): slide is SlideImage => slide !== null);
}
