import { Upload } from "tus-js-client";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseConfig } from "@/lib/supabase/config";

export const CONTENT_IMAGE_BUCKET = "profile-media";
export const CONTENT_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const CONTENT_VIDEO_MAX_BYTES = 50 * 1024 * 1024;
export const CONTENT_VIDEO_TUS_CHUNK_BYTES = 6 * 1024 * 1024;

const IMAGE_TYPES = {
  "image/jpeg": { extension: "jpg", signature: (bytes: Uint8Array) => bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff },
  "image/png": { extension: "png", signature: (bytes: Uint8Array) => bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a },
  "image/webp": { extension: "webp", signature: (bytes: Uint8Array) => String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP" },
} as const;

const VIDEO_TYPES = {
  "video/mp4": {
    extension: "mp4",
    signature: (bytes: Uint8Array) => bytes.length >= 8 && String.fromCharCode(...bytes.slice(4, 8)) === "ftyp",
  },
  "video/webm": {
    extension: "webm",
    signature: (bytes: Uint8Array) => bytes.length >= 4 && bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3,
  },
} as const;

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

export function isOwnedContentImagePath(profileId: string, path: string): boolean {
  const match = new RegExp(`^(${UUID})/(${UUID})\\.(jpg|png|webp)$`, "i").exec(path);
  return Boolean(match && match[1].toLowerCase() === profileId.toLowerCase());
}

export function isOwnedContentVideoPath(profileId: string, path: string): boolean {
  const match = new RegExp(`^(${UUID})/(${UUID})\\.(mp4|webm)$`, "i").exec(path);
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

export async function validateContentVideo(file: File): Promise<string | null> {
  if (!Object.hasOwn(VIDEO_TYPES, file.type)) return "Choose an MP4 or WebM video.";
  if (file.size <= 0) return "This video file is empty.";
  if (file.size > CONTENT_VIDEO_MAX_BYTES) return "Choose a video smaller than 50 MB.";

  const format = VIDEO_TYPES[file.type as keyof typeof VIDEO_TYPES];
  const extension = file.name.split(".").at(-1)?.toLowerCase();
  if (extension !== format.extension) return `Choose a .${format.extension} file with a matching video type.`;

  const signature = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  if (!format.signature(signature)) return "This file doesn’t match its video format. Choose an MP4 or WebM video.";
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

function resumableEndpoint(projectUrl: string): string {
  const url = new URL(projectUrl);
  if (url.hostname.endsWith(".supabase.co") && !url.hostname.endsWith(".storage.supabase.co")) {
    url.hostname = `${url.hostname.slice(0, -".supabase.co".length)}.storage.supabase.co`;
  }
  return `${url.origin}/storage/v1/upload/resumable`;
}

export async function uploadContentVideo(
  supabase: SupabaseClient,
  profileId: string,
  file: File,
  onProgress: (percentage: number) => void,
): Promise<{ path: string; url: string; mimeType: "video/mp4" | "video/webm" } | { error: string }> {
  const validationError = await validateContentVideo(file);
  if (validationError) return { error: validationError };

  const config = getSupabaseConfig();
  if (!config) return { error: "The video couldn’t be uploaded. Check your connection and try again." };
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) return { error: "Sign in again before uploading a video." };

  const format = VIDEO_TYPES[file.type as keyof typeof VIDEO_TYPES];
  const path = `${profileId}/${crypto.randomUUID()}.${format.extension}`;
  const bucket = supabase.storage.from(CONTENT_IMAGE_BUCKET);

  try {
    await new Promise<void>((resolve, reject) => {
      const upload = new Upload(file, {
        endpoint: resumableEndpoint(config.url),
        headers: {
          apikey: config.publishableKey,
          authorization: `Bearer ${session.access_token}`,
          "x-upsert": "false",
        },
        metadata: {
          bucketName: CONTENT_IMAGE_BUCKET,
          objectName: path,
          contentType: file.type,
          cacheControl: "3600",
        },
        chunkSize: CONTENT_VIDEO_TUS_CHUNK_BYTES,
        retryDelays: [0, 3000, 5000, 10000, 20000],
        uploadDataDuringCreation: true,
        removeFingerprintOnSuccess: true,
        storeFingerprintForResuming: false,
        onProgress: (uploaded, total) => onProgress(Math.min(100, Math.floor((uploaded / total) * 100))),
        onError: reject,
        onSuccess: () => resolve(),
      });
      upload.start();
    });
  } catch {
    await removeContentMediaIfUnused(supabase, profileId, path);
    return { error: "The video couldn’t be uploaded. Check your connection and try again." };
  }

  const { data, error: signedUrlError } = await bucket.createSignedUrl(path, 3600);
  if (signedUrlError || !data?.signedUrl) {
    await removeContentMediaIfUnused(supabase, profileId, path);
    return { error: "The video uploaded but couldn’t be previewed. Try again." };
  }

  return { path, url: data.signedUrl, mimeType: file.type as "video/mp4" | "video/webm" };
}

/** Remove an uploaded asset only after confirming no owned row still references it. */
export async function removeContentMediaIfUnused(supabase: SupabaseClient, profileId: string, path: string | null | undefined): Promise<void> {
  if (!path || (!isOwnedContentImagePath(profileId, path) && !isOwnedContentVideoPath(profileId, path))) return;

  const [modeRefs, imageBlockRefs, videoBlockRefs] = await Promise.all([
    supabase.from("profile_modes").select("id").eq("profile_id", profileId).eq("image_path", path).limit(1),
    supabase.from("profile_blocks").select("id").eq("profile_id", profileId).contains("data", { image_path: path }).limit(1),
    supabase.from("profile_blocks").select("id").eq("profile_id", profileId).contains("data", { video_path: path }).limit(1),
  ]);
  // A failed reference check must never turn into an asset deletion.
  if (modeRefs.error || imageBlockRefs.error || videoBlockRefs.error || modeRefs.data?.length || imageBlockRefs.data?.length || videoBlockRefs.data?.length) return;
  await supabase.storage.from(CONTENT_IMAGE_BUCKET).remove([path]);
}

export async function removePendingContentMedia(supabase: SupabaseClient, profileId: string, paths: Iterable<string>): Promise<void> {
  await Promise.all([...new Set(paths)].map((path) => removeContentMediaIfUnused(supabase, profileId, path)));
}

/** Kept as an image-named alias for existing profile image callsites. */
export async function removeContentImageIfUnused(supabase: SupabaseClient, profileId: string, path: string | null | undefined): Promise<void> {
  if (!path || !isOwnedContentImagePath(profileId, path)) return;
  await removeContentMediaIfUnused(supabase, profileId, path);
}

export async function removePendingContentImages(supabase: SupabaseClient, profileId: string, paths: Iterable<string>): Promise<void> {
  await removePendingContentMedia(supabase, profileId, paths);
}
