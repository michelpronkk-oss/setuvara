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
