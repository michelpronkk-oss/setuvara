import type { SupabaseClient } from "@supabase/supabase-js";

export const CONTENT_IMAGE_BUCKET = "profile-media";
export const CONTENT_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES = {
  "image/jpeg": { extension: "jpg", signature: (bytes: Uint8Array) => bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff },
  "image/png": { extension: "png", signature: (bytes: Uint8Array) => bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a },
  "image/webp": { extension: "webp", signature: (bytes: Uint8Array) => String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP" },
} as const;

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

export function isOwnedContentImagePath(profileId: string, path: string): boolean {
  const match = new RegExp(`^(${UUID})/(${UUID})\\.(jpg|png|webp)$`, "i").exec(path);
  return Boolean(match && match[1].toLowerCase() === profileId.toLowerCase());
}

export async function validateContentImage(file: File): Promise<string | null> {
  if (!Object.hasOwn(IMAGE_TYPES, file.type)) return "Choose a JPEG, PNG or WebP image.";
  if (file.size <= 0) return "This image file is empty.";
  if (file.size > CONTENT_IMAGE_MAX_BYTES) return "Choose an image smaller than 5 MB.";

  const format = IMAGE_TYPES[file.type as keyof typeof IMAGE_TYPES];
  const signature = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (!format.signature(signature)) return "This file doesn’t match its image format. Choose a JPEG, PNG or WebP image.";

  const previewUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = previewUrl;
    await image.decode();
    const validSize = image.naturalWidth > 0 && image.naturalHeight > 0 && image.naturalWidth <= 12_000 && image.naturalHeight <= 12_000 && image.naturalWidth * image.naturalHeight <= 60_000_000;
    if (!validSize) return "Choose an image no larger than 12,000 pixels on either side.";
  } catch {
    return "This image couldn’t be opened. Try a different JPEG, PNG or WebP file.";
  } finally {
    URL.revokeObjectURL(previewUrl);
  }

  return null;
}

export async function uploadContentImage(supabase: SupabaseClient, profileId: string, file: File): Promise<{ path: string; url: string } | { error: string }> {
  const validationError = await validateContentImage(file);
  if (validationError) return { error: validationError };

  const format = IMAGE_TYPES[file.type as keyof typeof IMAGE_TYPES];
  const path = `${profileId}/${crypto.randomUUID()}.${format.extension}`;
  const bucket = supabase.storage.from(CONTENT_IMAGE_BUCKET);
  const { error: uploadError } = await bucket.upload(path, file, { contentType: file.type, upsert: false });
  if (uploadError) return { error: "The image couldn’t be uploaded. Check your connection and try again." };

  const { data, error: signedUrlError } = await bucket.createSignedUrl(path, 3600);
  if (signedUrlError || !data?.signedUrl) {
    await bucket.remove([path]);
    return { error: "The image uploaded but couldn’t be previewed. Try again." };
  }

  return { path, url: data.signedUrl };
}

/** Remove an uploaded asset only after confirming no owned row still references it. */
export async function removeContentImageIfUnused(supabase: SupabaseClient, profileId: string, path: string | null | undefined): Promise<void> {
  if (!path || !isOwnedContentImagePath(profileId, path)) return;

  const [modeRefs, blockRefs] = await Promise.all([
    supabase.from("profile_modes").select("id").eq("profile_id", profileId).eq("image_path", path).limit(1),
    supabase.from("profile_blocks").select("id").eq("profile_id", profileId).contains("data", { image_path: path }).limit(1),
  ]);
  // A failed reference check must never turn into an asset deletion.
  if (modeRefs.error || blockRefs.error || modeRefs.data?.length || blockRefs.data?.length) return;
  await supabase.storage.from(CONTENT_IMAGE_BUCKET).remove([path]);
}

export async function removePendingContentImages(supabase: SupabaseClient, profileId: string, paths: Iterable<string>): Promise<void> {
  await Promise.all([...new Set(paths)].map((path) => removeContentImageIfUnused(supabase, profileId, path)));
}
