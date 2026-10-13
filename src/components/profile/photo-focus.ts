/**
 * Where a Mode photo's subject sits, so every surface frames the same face.
 *
 * Photos are saved already cropped to 4:5. The focus is a point inside that saved photo, in
 * percent (0–100) of its width and height, picked in the crop dialog. Every frame that shows the
 * photo (profile heroes, wide Event/Business bands, avatars, cards) is `object-fit: cover`, and
 * positions it so the focus lands as close to the frame's centre as the photo allows. It can
 * never leave the frame.
 */
export type PhotoFocus = { x: number; y: number };

/** Saved Mode photos are cropped to this aspect (width / height). */
export const PHOTO_ASPECT = 4 / 5;

/** Photos saved before a focus existed: faces usually sit in the upper third of a portrait. */
export const DEFAULT_FOCUS: PhotoFocus = { x: 50, y: 30 };

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));

/** A focus from the stored columns, falling back to the default for missing or bad values. */
export function readFocus(x: unknown, y: unknown): PhotoFocus {
  const valid = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100;
  return { x: valid(x) ? x : DEFAULT_FOCUS.x, y: valid(y) ? y : DEFAULT_FOCUS.y };
}

/** A Mode row's focus. */
export function modeFocus(mode: { image_focus_x?: number | null; image_focus_y?: number | null }): PhotoFocus {
  return readFocus(mode.image_focus_x, mode.image_focus_y);
}

/**
 * The part of the photo a cover frame of `frameAspect` shows, as fractions of the photo
 * (x, y, width, height in 0–1), centred on the focus where the photo allows.
 */
export function visibleWindow(focus: PhotoFocus, frameAspect: number, photoAspect = PHOTO_ASPECT) {
  const fx = clamp(focus.x / 100);
  const fy = clamp(focus.y / 100);
  if (frameAspect >= photoAspect) {
    // Wider frame: full width shows, the height is trimmed.
    const height = photoAspect / frameAspect;
    return { x: 0, y: clamp(fy - height / 2, 0, 1 - height), width: 1, height };
  }
  const width = frameAspect / photoAspect;
  return { x: clamp(fx - width / 2, 0, 1 - width), y: 0, width, height: 1 };
}

/**
 * CSS `object-position` for a cover frame. With the frame's aspect it centres the focus exactly;
 * without it (frame size unknown on the server) the focus percentages themselves still keep the
 * focus inside the frame at any size.
 */
export function focusPosition(focus: PhotoFocus, frameAspect?: number | null, photoAspect = PHOTO_ASPECT): string {
  if (!frameAspect || !Number.isFinite(frameAspect) || frameAspect <= 0) return `${round(focus.x)}% ${round(focus.y)}%`;
  const view = visibleWindow(focus, frameAspect, photoAspect);
  const x = view.width >= 1 ? 50 : (view.x / (1 - view.width)) * 100;
  const y = view.height >= 1 ? 50 : (view.y / (1 - view.height)) * 100;
  return `${round(x)}% ${round(y)}%`;
}

const round = (value: number) => Math.round(value * 100) / 100;

// ---------------------------------------------------------------- Framing from the original

/**
 * Mode photos keep the original upload (size-capped) next to the saved 4:5 crop. The crop is
 * metadata on the original: a rectangle in fractions (0–1) of its width and height, plus the
 * original's pixel size. Every surface frames itself from the original with `placePhoto`, so a
 * wide panel or a zoomed-out hero shows real pixels from beyond the crop instead of nothing.
 *
 * Photos saved before originals were kept have no crop metadata. They render from the saved
 * 4:5 photo as their own "original" (the whole of it is the crop); nothing beyond it exists.
 */
export type PhotoCrop = { x: number; y: number; w: number; h: number; width: number; height: number };

/** What a surface draws a Mode photo from. */
export type PhotoSource = {
  url: string;
  /** Width / height of the image at `url`. */
  aspect: number;
  /** The member's 4:5 crop in fractions of the image at `url`. */
  crop: { x: number; y: number; w: number; h: number };
  /** The face point, percent of the crop (image_focus_x/y). */
  focus: PhotoFocus;
  /** True when this is a kept original; false for photos saved before originals existed. */
  original: boolean;
};

export const FULL_CROP = { x: 0, y: 0, w: 1, h: 1 } as const;

/** The stored crop metadata, or null when missing or malformed. */
export function readCrop(value: unknown): PhotoCrop | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const crop = value as Record<string, unknown>;
  const num = (key: string) => (typeof crop[key] === "number" && Number.isFinite(crop[key]) ? crop[key] as number : NaN);
  const [x, y, w, h, width, height] = ["x", "y", "w", "h", "width", "height"].map(num);
  const unit = (n: number) => n >= 0 && n <= 1;
  if (![x, y, w, h].every(unit) || w <= 0 || h <= 0 || x + w > 1.0001 || y + h > 1.0001) return null;
  if (!(width >= 1 && height >= 1)) return null;
  return { x, y, w, h, width, height };
}

/** A Mode's photo source: its kept original when it has one, otherwise the saved 4:5 photo. */
export function photoSource(mode: { image_url?: string | null; image_original_url?: string | null; image_crop?: unknown; image_focus_x?: number | null; image_focus_y?: number | null }): PhotoSource | null {
  const focus = modeFocus(mode);
  const crop = readCrop(mode.image_crop);
  if (mode.image_original_url && crop) {
    return { url: mode.image_original_url, aspect: crop.width / crop.height, crop: { x: crop.x, y: crop.y, w: crop.w, h: crop.h }, focus, original: true };
  }
  return mode.image_url ? legacySource(mode.image_url, focus) : null;
}

/** A photo that is its own crop (saved 4:5 photos, slideshow photos). */
export function legacySource(url: string, focus: PhotoFocus, aspect = PHOTO_ASPECT): PhotoSource {
  return { url, aspect, crop: { ...FULL_CROP }, focus, original: false };
}

/** The face point in fractions of the whole image. */
export function sourceFocus(source: Pick<PhotoSource, "crop" | "focus">) {
  return { x: source.crop.x + source.crop.w * clamp(source.focus.x / 100), y: source.crop.y + source.crop.h * clamp(source.focus.y / 100) };
}

/** Where the image sits in a frame, in fractions of the frame (may run past its edges). */
export type PhotoPlacement = { left: number; top: number; width: number; height: number; covers: boolean };

/**
 * Frames a photo in a frame of `frameAspect` (width / height) at `zoom` (1 = 100%).
 *
 * At 100% the crop sets the scale and the composition: the crop's height fills the frame's height,
 * centred on the face within the crop. A 4:5 frame shows exactly the crop; a taller one part of it
 * (as before); a wide frame the whole crop plus real image beside it, from the original. Where the image runs out at 100%, it is scaled up only
 * as far as needed to fill the frame, so 100% never shows empty space.
 *
 * Zooming scales around where the face sits at 100%, so the face holds its place on screen. Zoomed
 * out, the window grows past the crop and reveals the original's real pixels; only beyond the
 * original itself is the frame left to the Appearance's atmosphere (`covers` is false), and that
 * space is always below the image, never above it: the top edge stays sharp.
 */
export function placePhoto(source: Pick<PhotoSource, "aspect" | "crop" | "focus">, frameAspect: number, zoom = 1, { cover = false }: { cover?: boolean } = {}): PhotoPlacement {
  const A = Number.isFinite(frameAspect) && frameAspect > 0 ? frameAspect : PHOTO_ASPECT;
  let z = Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
  // Work in image heights: the image is `aspect` wide and 1 tall.
  const W = source.aspect;
  const face = sourceFocus(source);
  const fx = face.x * W;
  const fy = face.y;
  let h = source.crop.h;
  let w = h * A;
  const fit = Math.min(W / w, 1 / h, 1);
  w *= fit;
  h *= fit;
  // At 100%: centred on the face, but kept to the member's crop (a window smaller than the crop
  // stays inside it; a larger one keeps the whole crop in view), and always inside the image.
  const cx = source.crop.x * W;
  const cw = source.crop.w * W;
  const x1 = clampRange(clampRange(fx - w / 2, cx, cx + cw - w), 0, W - w);
  const y1 = clampRange(clampRange(fy - h / 2, source.crop.y, source.crop.y + source.crop.h - h), 0, 1 - h);
  const u = (fx - x1) / w;
  const v = (fy - y1) / h;
  // A frame that must stay filled (a circle) zooms out only as far as the image reaches.
  if (cover) z = Math.max(z, w / W, h);
  const zw = w / z;
  const zh = h / z;
  const wx = clampRange(fx - u * zw, 0, W - zw);
  // Where the image runs out vertically, it stays on the frame's top edge: heads are never
  // dissolved into atmosphere, and the spare space goes below, behind the name and actions.
  const wy = zh > 1 ? 0 : clampRange(fy - v * zh, 0, 1 - zh);
  const left = -wx / zw || 0;
  const top = -wy / zh || 0;
  const width = W / zw;
  const height = 1 / zh;
  const e = 1e-6;
  return { left, top, width, height, covers: left <= e && top <= e && left + width >= 1 - e && top + height >= 1 - e };
}

/** Clamps to [min, max]; when the range is inverted (window larger than the image), to [max, min]. */
function clampRange(value: number, min: number, max: number) {
  return max >= min ? Math.min(max, Math.max(min, value)) : Math.min(min, Math.max(max, value));
}

